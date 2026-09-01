const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const regex = /let lastSendTime = 0;[\s\S]*setInterval\(async \(\) => \{[\s\S]*?\}, 5000\);/m;

const replacement = `
let lastSendTime = 0;

import { DateTime } from 'luxon';

function isWithinWindow(timezone, windowStart, windowEnd) {
  const localNow = DateTime.local().setZone(timezone);
  const startDt = DateTime.fromFormat(windowStart, 'HH:mm', { zone: timezone });
  const endDt = DateTime.fromFormat(windowEnd, 'HH:mm', { zone: timezone });
  
  const currentMinutes = localNow.hour * 60 + localNow.minute;
  const startMinutes = startDt.hour * 60 + startDt.minute;
  const endMinutes = endDt.hour * 60 + endDt.minute;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Crosses midnight (e.g. 22:00 to 02:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

setInterval(async () => {
  try {
    const settingsDoc = await getDoc(doc(db, 'campaigns', 'settings'));
    const settings = settingsDoc.exists() ? settingsDoc.data() : {
      delaySeconds: 60,
      initialMessage: 'Hi!',
      followUp1Message: 'Following up!',
      followUp1Days: 2,
      followUp2Message: 'Last try!',
      followUp2Days: 3
    };
    const delaySeconds = settings?.delaySeconds || 60;
    const now = Date.now();

    // 1. Check for active campaigns & process one recipient if possible
    if (now - lastSendTime >= delaySeconds * 1000) {
      // Find running campaigns
      const campaignsSnap = await getDocs(query(collection(db, 'campaigns'), where('status', '==', 'RUNNING')));
      
      let sentSomething = false;

      for (const campDoc of campaignsSnap.docs) {
        if (sentSomething) break;

        const camp = campDoc.data();
        
        // Has it reached start time?
        if (now < camp.scheduledStart) continue;

        // Has it reached hard cutoff?
        if (camp.endDate && now >= camp.endDate) {
          await updateDoc(campDoc.ref, { status: 'STOPPED' });
          continue;
        }

        // Is it within send window?
        if (!isWithinWindow(camp.timezone, camp.sendWindowStart, camp.sendWindowEnd)) {
          continue;
        }

        // Check global 20 leads/day limit
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todayInitialMsgs = await getDocs(query(collection(db, 'messages'), where('direction', '==', 'OUTBOUND'), where('isInitial', '==', true), where('createdAt', '>=', startOfDay.getTime())));
        if (todayInitialMsgs.size >= 20) {
           // We cannot send any initial messages today
           continue; 
        }

        // Get one queued recipient
        const queuedSnapshot = await getDocs(query(collection(db, 'campaignRecipients'), where('campaignId', '==', camp.id), where('status', 'in', ['Queued', 'Scheduled', 'Pending']), limit(1)));
        
        if (queuedSnapshot.empty) {
          // If no more queued, check if there are any failed/etc. Usually we can just mark COMPLETED if all are sent/skipped.
          // Let's count totals to be safe, or just mark completed if no scheduled are left.
          const anyPending = await getDocs(query(collection(db, 'campaignRecipients'), where('campaignId', '==', camp.id), where('status', 'in', ['Queued', 'Scheduled', 'Pending']), limit(1)));
          if (anyPending.empty) {
             await updateDoc(campDoc.ref, { status: 'COMPLETED' });
          }
          continue;
        }

        const queueDoc = queuedSnapshot.docs[0];
        const queueData = queueDoc.data();

        // Send Initial SMS
        try {
          const client = getTwilio();
          const fromNumber = process.env.TWILIO_PHONE_NUMBER!;
          
          const message = await client.messages.create({
            from: fromNumber,
            to: queueData.contactId,
            body: settings!.initialMessage,
            statusCallback: \`\${process.env.APP_URL}/api/twilio/status\`
          });
          
          const sentTime = Date.now();
          lastSendTime = sentTime;
          sentSomething = true;

          const msgData = {
            id: message.sid,
            twilioSid: message.sid,
            contactId: queueData.contactId,
            from: message.from,
            to: message.to,
            body: message.body,
            direction: 'OUTBOUND',
            status: message.status,
            createdAt: sentTime,
            errorCode: message.errorCode || null,
            errorMessage: message.errorMessage || null,
            isInitial: true
          };
          
          await setDoc(doc(db, 'messages', message.sid), msgData);
          await updateDoc(queueDoc.ref, { status: 'Sent', sentAt: sentTime });
          
          // Schedule Follow up and attach timezone/window
          const fuTime = sentTime + (settings!.followUp1Days * 24 * 60 * 60 * 1000);
          const fuRef = doc(collection(db, 'scheduledFollowUps'));
          await setDoc(fuRef, {
            id: fuRef.id,
            contactId: queueData.contactId,
            step: 1,
            scheduledFor: fuTime,
            status: 'pending',
            timezone: camp.timezone,
            sendWindowStart: camp.sendWindowStart,
            sendWindowEnd: camp.sendWindowEnd
          });
          
          await updateDoc(doc(db, 'contacts', queueData.contactId), {
            followUpStage: 1,
            nextFollowUpAt: fuTime,
            lastMessageAt: sentTime
          });
        } catch(err: any) {
          console.error("Failed to send initial SMS", err);
          await updateDoc(queueDoc.ref, { status: 'Failed', sentAt: Date.now() });
        }
      }
    }

    // 2. Process Follow Ups
    if (now - lastSendTime >= delaySeconds * 1000) {
      // Find due followups
      const followupsSnapshot = await getDocs(query(collection(db, 'scheduledFollowUps'), where('status', '==', 'pending'), where('scheduledFor', '<=', now)));
      
      for (const fuDoc of followupsSnapshot.docs) {
        const fuData = fuDoc.data();
        
        // If it has timezone bounds, check them
        if (fuData.timezone && fuData.sendWindowStart && fuData.sendWindowEnd) {
          if (!isWithinWindow(fuData.timezone, fuData.sendWindowStart, fuData.sendWindowEnd)) {
            continue; // Not in window, try next one
          }
        }

        const contactDoc = await getDoc(doc(db, 'contacts', fuData.contactId));
        const contact = contactDoc.data();
        
        if (contact && ['NOT INTERESTED', 'INTERESTED', 'CALL BOOKED'].includes(contact.status)) {
            await updateDoc(fuDoc.ref, { status: 'cancelled' });
            continue; // Go to next
        }

        const isStep1 = fuData.step === 1;
        const body = isStep1 ? settings!.followUp1Message : settings!.followUp2Message;
        
        try {
            const client = getTwilio();
            const fromNumber = process.env.TWILIO_PHONE_NUMBER!;
            
            const message = await client.messages.create({
              from: fromNumber,
              to: fuData.contactId,
              body,
              statusCallback: \`\${process.env.APP_URL}/api/twilio/status\`
            });
            const sentTime = Date.now();
            lastSendTime = sentTime;
            
            await setDoc(doc(db, 'messages', message.sid), {
              id: message.sid,
              twilioSid: message.sid,
              contactId: fuData.contactId,
              from: message.from,
              to: message.to,
              body: message.body,
              direction: 'OUTBOUND',
              status: message.status,
              createdAt: sentTime,
              errorCode: message.errorCode || null,
              errorMessage: message.errorMessage || null,
              isInitial: false
            });
            
            await updateDoc(fuDoc.ref, { status: 'sent' });
            
            if (isStep1) {
                const fuTime = sentTime + (settings!.followUp2Days * 24 * 60 * 60 * 1000);
                const fuRef = doc(collection(db, 'scheduledFollowUps'));
                await setDoc(fuRef, {
                  id: fuRef.id,
                  contactId: fuData.contactId,
                  step: 2,
                  scheduledFor: fuTime,
                  status: 'pending',
                  timezone: fuData.timezone || null,
                  sendWindowStart: fuData.sendWindowStart || null,
                  sendWindowEnd: fuData.sendWindowEnd || null
                });
                
                await updateDoc(doc(db, 'contacts', fuData.contactId), {
                  followUpStage: 2,
                  nextFollowUpAt: fuTime,
                  lastMessageAt: sentTime
                });
            } else {
                await updateDoc(doc(db, 'contacts', fuData.contactId), {
                  followUpStage: 3,
                  nextFollowUpAt: null,
                  lastMessageAt: sentTime
                });
            }
        } catch(e) {
            console.error("Failed to send follow up SMS", e);
            await updateDoc(fuDoc.ref, { status: 'failed' });
        }
        
        // Only process one message total per tick if we sent one
        break;
      }
    }

  } catch (error) {
    console.error("Worker error:", error);
  }
}, 5000);
`;

if (!code.includes('let lastSendTime = 0;')) {
  console.log("Could not find replacement anchor!");
} else {
  const newCode = code.replace(regex, replacement);
  fs.writeFileSync('server.ts', newCode);
  console.log('replaced loop in server.ts');
}
