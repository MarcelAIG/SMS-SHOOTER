import { DateTime } from 'luxon';
import express from 'express';
import path from 'path';
import twilio from 'twilio';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, orderBy, limit, writeBatch, runTransaction } from 'firebase/firestore';
import fs from 'fs';

dotenv.config();

const app = express();
const PORT = 3000;

// Need to handle URL encoded bodies for Twilio webhooks
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let configStr = '{}';
try {
  configStr = fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8');
} catch(e) {}
const firebaseConfig = JSON.parse(configStr);

// Initialize Firebase App
const firebaseApp = initializeApp(firebaseConfig);
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';
const db = getFirestore(firebaseApp, databaseId);

// Lazy load Twilio client
let twilioClient: twilio.Twilio | null = null;
function getTwilio() {
  if (!twilioClient) {
    if (!process.env.TWILIO_API_KEY_SID || !process.env.TWILIO_API_KEY_SECRET || !process.env.TWILIO_ACCOUNT_SID) {
      throw new Error("Missing Twilio credentials in environment");
    }
    twilioClient = twilio(
      process.env.TWILIO_API_KEY_SID,
      process.env.TWILIO_API_KEY_SECRET,
      {
        accountSid: process.env.TWILIO_ACCOUNT_SID
      }
    );
  }
  return twilioClient;
}

// Helpers
function normalizePhone(phone: string) {
  return '+' + phone.replace(/\D/g, '');
}

// API Routes
app.get('/api/health', (req, res) => {
  const isConfigured = !!(process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_PHONE_NUMBER);
  res.json({
    server: "ok",
    twilioConfigured: isConfigured,
    fromNumber: process.env.TWILIO_PHONE_NUMBER || "+16504871907"
  });
});

app.post('/api/send-sms', async (req, res) => {
  const { to, body } = req.body;

  if (!to || typeof to !== 'string' || !to.startsWith('+')) {
    return res.status(400).json({ error: '"to" must start with +' });
  }
  if (!body || typeof body !== 'string') {
    return res.status(400).json({ error: 'body cannot be empty' });
  }
  if (body.length > 1600) {
    return res.status(400).json({ error: 'body maximum 1600 characters' });
  }

  try {
    const client = getTwilio();
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!fromNumber) {
        throw new Error("TWILIO_PHONE_NUMBER not set in environment");
    }

    const normTo = normalizePhone(to);

    const message = await client.messages.create({
      from: fromNumber,
      to: normTo,
      body,
      statusCallback: `${process.env.APP_URL}/api/twilio/status`
    });

    const now = Date.now();
    
    const contactRef = doc(db, 'contacts', normTo);
    const contactDoc = await getDoc(contactRef);
    if (!contactDoc.exists()) {
      await setDoc(contactRef, {
        id: normTo,
        phone: normTo,
        businessName: 'Unknown Contact',
        status: 'NEW',
        dateAdded: now,
        lastMessageAt: now,
        followUpStage: 0,
        nextFollowUpAt: null
      });
    } else {
      await updateDoc(contactRef, {
        lastMessageAt: now
      });
    }

    const msgData = {
      id: message.sid,
      twilioSid: message.sid,
      contactId: normTo,
      from: message.from,
      to: message.to,
      body: message.body,
      direction: 'OUTBOUND',
      status: message.status,
      createdAt: now,
      errorCode: message.errorCode || null,
      errorMessage: message.errorMessage || null,
      isInitial: false
    };

    await setDoc(doc(db, 'messages', message.sid), msgData);

    res.json(msgData);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Twilio error" });
  }
});

app.post('/api/twilio/incoming', async (req, res) => {
  try {
    const { From, To, Body, MessageSid, SmsStatus } = req.body;
    
    if (!From || !MessageSid) {
      return res.status(400).send('Bad Request');
    }

    const normFrom = normalizePhone(From);
    const now = Date.now();

    const contactRef = doc(db, 'contacts', normFrom);
    const contactDoc = await getDoc(contactRef);
    
    if (!contactDoc.exists()) {
      await setDoc(contactRef, {
        id: normFrom,
        phone: normFrom,
        businessName: 'New Contact',
        status: 'NEW',
        dateAdded: now,
        lastMessageAt: now,
        followUpStage: 0,
        nextFollowUpAt: null
      });
    } else {
      await updateDoc(contactRef, {
        lastMessageAt: now,
        nextFollowUpAt: null
      });
      
      // Stop-on-reply per campaign
      const activeRcpts = await getDocs(query(collection(db, 'campaignRecipients'), where('contactId', '==', normFrom), where('status', 'in', ['Queued', 'Scheduled', 'Pending', 'Sent', 'Delivered'])));
      const batch = writeBatch(db);
      
      for (const d of activeRcpts.docs) {
         const rcptData = d.data();
         if (rcptData.campaignId) {
             const campDoc = await getDoc(doc(db, 'campaigns', rcptData.campaignId));
             const campData = campDoc.data();
             if (campData && campData.stopOnReply !== false) {
                 batch.update(d.ref, { status: 'REPLIED', hasReplied: true, repliedAt: now });
                 
                 // Cancel followups ONLY for this specific campaign
                 const schedQuery = query(collection(db, 'scheduledFollowUps'), where('contactId', '==', normFrom), where('campaignId', '==', rcptData.campaignId), where('status', '==', 'pending'));
                 const sched = await getDocs(schedQuery);
                 sched.forEach(s => {
                    batch.update(s.ref, { status: 'cancelled' });
                 });
             }
         }
      }
      
      await batch.commit();
    }

    await setDoc(doc(db, 'messages', MessageSid), {
      id: MessageSid,
      twilioSid: MessageSid,
      contactId: normFrom,
      from: From,
      to: To,
      body: Body,
      direction: 'INBOUND',
      status: SmsStatus || 'received',
      createdAt: now,
      errorCode: null,
      errorMessage: null,
      isInitial: false,
      read: false
    });

    const twiml = new twilio.twiml.MessagingResponse();
    res.type("text/xml").send(twiml.toString());
  } catch(e) {
    console.error("Webhook error:", e);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/twilio/status', async (req, res) => {
  try {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;
    
    if (MessageSid) {
      await updateDoc(doc(db, 'messages', MessageSid), {
        status: MessageStatus,
        errorCode: ErrorCode || null,
        errorMessage: ErrorMessage || null
      });
    }
    res.sendStatus(200);
  } catch(e) {
    console.error("Status Webhook error:", e);
    res.sendStatus(500);
  }
});

app.post('/api/campaign/start', async (req, res) => {
  const { contactIds, campaignName, timezone, startDate, startTime, sendWindowStart, sendWindowEnd, hasEndDate, endDate, endTime } = req.body;
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ error: 'No contacts provided' });
  }
  
  try {
    const { DateTime } = await import('luxon');
    
    // Parse start time in the given timezone
    const startDt = DateTime.fromFormat(`${startDate} ${startTime}`, 'yyyy-MM-dd HH:mm', { zone: timezone });
    const scheduledStart = startDt.toMillis();
    
    let endTimestamp = null;
    if (hasEndDate && endDate && endTime) {
      const endDt = DateTime.fromFormat(`${endDate} ${endTime}`, 'yyyy-MM-dd HH:mm', { zone: timezone });
      endTimestamp = endDt.toMillis();
    }

    const campaignRef = doc(collection(db, 'campaigns'));
    const now = Date.now();
    
    const batch = writeBatch(db);
    
    batch.set(campaignRef, {
      id: campaignRef.id,
      name: campaignName,
      timezone: timezone,
      scheduledStart,
      sendWindowStart,
      sendWindowEnd,
      endDate: endTimestamp,
      status: 'SCHEDULED',
      createdAt: now
    });

    for (const cid of contactIds) {
      const docRef = doc(collection(db, 'campaignRecipients'));
      batch.set(docRef, {
        id: docRef.id,
        campaignId: campaignRef.id,
        contactId: cid,
        status: 'Scheduled',
        queuedAt: now,
        sentAt: null
      });
    }
    
    await batch.commit();
    res.json({ success: true, campaignId: campaignRef.id, queued: contactIds.length });
  } catch(e: any) {
    console.error("Campaign start error:", e);
    res.status(500).json({ error: e.message });
  }
});


let lastSendTime: Record<string, number> = {};


function isWithinWindow(timezone, windowStart, windowEnd) {
  if (!windowStart || !windowEnd) return true;
  
  const localNow = DateTime.local().setZone(timezone || 'UTC');
  const startDt = DateTime.fromFormat(windowStart, 'HH:mm', { zone: timezone || 'UTC' });
  const endDt = DateTime.fromFormat(windowEnd, 'HH:mm', { zone: timezone || 'UTC' });
  
  // If parsing fails, just allow it
  if (!startDt.isValid || !endDt.isValid) return true;
  
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
    // Find running campaigns
    const campaignsSnap = await getDocs(query(collection(db, 'campaigns'), where('status', '==', 'RUNNING')));
    
    for (const campDoc of campaignsSnap.docs) {
      const camp = campDoc.data();
      
      const intervalMinutes = camp.sendIntervalMinutes || 1;
      const intervalMs = intervalMinutes * 60 * 1000;
      const lastSent = lastSendTime[camp.id] || 0;

      if (now - lastSent < intervalMs) {
        continue;
      }

      // Check Active Days
      const localNow = DateTime.local().setZone(camp.timezone || 'UTC');
      const currentDay = localNow.weekdayLong; // e.g., 'Monday'
      const activeDays = camp.activeDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      
      if (!activeDays.includes(currentDay)) {
        continue;
      }

        
        // Has it reached start time?
        if (now < camp.scheduledStart) continue;

        // Has it reached hard cutoff?
        if (camp.endDate && now >= camp.endDate) {
          await updateDoc(campDoc.ref, { status: 'STOPPED' });
          
          // Mark all queued as skipped due to cutoff
          const allPending = await getDocs(query(collection(db, 'campaignRecipients'), where('campaignId', '==', camp.id), where('status', 'in', ['Queued', 'Scheduled', 'Pending'])));
          const batch = writeBatch(db);
          allPending.forEach(d => {
             batch.update(d.ref, { status: 'SKIPPED', errorMessage: 'Campaign Cutoff' });
          });
          
          const allPendingFu = await getDocs(query(collection(db, 'scheduledFollowUps'), where('campaignId', '==', camp.id), where('status', '==', 'pending')));
          allPendingFu.forEach(d => {
             batch.update(d.ref, { status: 'cancelled' });
          });
          
          await batch.commit();
          continue;
        }

        // Is it within send window?
        if (!isWithinWindow(camp.timezone, camp.sendWindowStart, camp.sendWindowEnd)) {
          continue;
        }

        // Check global 20 leads/day limit (Timezone Aware based on campaign)
        const tzStartOfDay = DateTime.local().setZone(camp.timezone || 'UTC').startOf('day').toMillis();
        const limitSetting = camp.dailyLeadLimit || 20;
        const todayInitialMsgs = await getDocs(query(collection(db, 'messages'), where('direction', '==', 'OUTBOUND'), where('isInitial', '==', true), where('createdAt', '>=', tzStartOfDay)));
        if (todayInitialMsgs.size >= limitSetting) {
           // We cannot send any initial messages today
           continue; 
        }

        // Get one queued recipient
        const queuedSnapshot = await getDocs(query(collection(db, 'campaignRecipients'), where('campaignId', '==', camp.id), where('status', 'in', ['Queued', 'Scheduled', 'Pending']), limit(1)));
        
        if (queuedSnapshot.empty) {
          // If no more queued, check if there are any failed/etc.
          const anyPending = await getDocs(query(collection(db, 'campaignRecipients'), where('campaignId', '==', camp.id), where('status', 'in', ['Queued', 'Scheduled', 'Pending', 'SENDING']), limit(1)));
          const anyPendingFu = await getDocs(query(collection(db, 'scheduledFollowUps'), where('campaignId', '==', camp.id), where('status', '==', 'pending'), limit(1)));
          
          if (anyPending.empty && anyPendingFu.empty) {
             await updateDoc(campDoc.ref, { status: 'COMPLETED' });
          }
          continue;
        }

        const queueDoc = queuedSnapshot.docs[0];
        const queueData = queueDoc.data();

        // Idempotency check: lock the document
        let acquired = false;
        try {
           await runTransaction(db, async (transaction) => {
              const freshDoc = await transaction.get(queueDoc.ref);
              const freshData = freshDoc.data();
              if (!freshDoc.exists() || !['Queued', 'Scheduled', 'Pending'].includes(freshData?.status)) {
                 throw new Error("ALREADY_PROCESSED");
              }
              transaction.update(queueDoc.ref, { status: 'SENDING', lastAttemptAt: Date.now() });
           });
           acquired = true;
        } catch (e: any) {
           if (e.message !== "ALREADY_PROCESSED") console.error("Transaction error:", e);
           continue; 
        }
        
        if (!acquired) continue;

        // Send Initial SMS
        try {
          const client = getTwilio();
          const fromNumber = process.env.TWILIO_PHONE_NUMBER!;
          
          const initialMessage = camp.initialMessage || settings!.initialMessage;

          const message = await client.messages.create({
            from: fromNumber,
            to: queueData.contactId,
            body: initialMessage,
            statusCallback: `${process.env.APP_URL}/api/twilio/status`
          });
          
          const sentTime = Date.now();
          lastSendTime[camp.id] = sentTime;

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
          await updateDoc(queueDoc.ref, { 
             status: 'SENT', 
             sentAt: sentTime,
             initialSentAt: sentTime,
             twilioMessageSid: message.sid
          });
          
          // Schedule Follow up and attach timezone/window
          const fu1DelayMinutes = camp.followUp1DelayMinutes ?? (settings!.followUp1Days * 24 * 60);
          const fuTime = sentTime + (fu1DelayMinutes * 60 * 1000);
          const fuRef = doc(collection(db, 'scheduledFollowUps'));
          await setDoc(fuRef, {
            id: fuRef.id,
            contactId: queueData.contactId,
            campaignId: camp.id,
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
          await updateDoc(queueDoc.ref, { 
             status: 'FAILED', 
             lastAttemptAt: Date.now(),
             errorMessage: err.message,
             errorCode: err.code 
          });
        }
    }

    // 2. Process Follow Ups
    // Find due followups
    const followupsSnapshot = await getDocs(query(collection(db, 'scheduledFollowUps'), where('status', '==', 'pending'), where('scheduledFor', '<=', now)));
    
    for (const fuDoc of followupsSnapshot.docs) {
      const fuData = fuDoc.data();
      
      let cData: any = null;
      let intervalMs = 60 * 1000; // default 1 min
      
      if (fuData.campaignId) {
        const cDoc = await getDoc(doc(db, 'campaigns', fuData.campaignId));
        if (cDoc.exists()) {
           cData = cDoc.data();
           const intervalMinutes = cData.sendIntervalMinutes || 1;
           intervalMs = intervalMinutes * 60 * 1000;
        }
      }

      const campId = fuData.campaignId || 'unknown';
      const lastSent = lastSendTime[campId] || 0;

      if (now - lastSent < intervalMs) {
        continue;
      }

      // If it has timezone bounds, check them
      if (fuData.timezone) {
        const localNow = DateTime.local().setZone(fuData.timezone);
        const currentDay = localNow.weekdayLong;
        const activeDays = cData?.activeDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        
        if (!activeDays.includes(currentDay)) {
          continue;
        }

        if (fuData.sendWindowStart && fuData.sendWindowEnd) {
          if (!isWithinWindow(fuData.timezone, fuData.sendWindowStart, fuData.sendWindowEnd)) {
            continue; // Not in window, try next one
          }
        }
      }

        const contactDoc = await getDoc(doc(db, 'contacts', fuData.contactId));
        const contact = contactDoc.data();
        
        if (contact && ['NOT INTERESTED', 'INTERESTED', 'CALL BOOKED'].includes(contact.status)) {
            await updateDoc(fuDoc.ref, { status: 'cancelled' });
            continue; // Go to next
        }

        const isStep1 = fuData.step === 1;
        let body = isStep1 ? settings!.followUp1Message : settings!.followUp2Message;
        
        if (cData) {
           if (isStep1 && cData.followUp1Message) body = cData.followUp1Message;
           if (!isStep1 && cData.followUp2Message) body = cData.followUp2Message;
        }
        
        // Skip if campaign has follow-ups disabled
        if (cData && cData.allowFollowUps === false) {
           await updateDoc(fuDoc.ref, { status: 'cancelled' });
           continue;
        }
        
        // Idempotency check: lock the follow up document
        let acquiredFu = false;
        try {
           await runTransaction(db, async (transaction) => {
              const freshDoc = await transaction.get(fuDoc.ref);
              const freshData = freshDoc.data();
              if (!freshDoc.exists() || freshData?.status !== 'pending') {
                 throw new Error("ALREADY_PROCESSED");
              }
              transaction.update(fuDoc.ref, { status: 'sending', lastAttemptAt: Date.now() });
           });
           acquiredFu = true;
        } catch (e: any) {
           if (e.message !== "ALREADY_PROCESSED") console.error("Transaction error:", e);
           continue; 
        }
        
        if (!acquiredFu) continue;
        
        try {
            const client = getTwilio();
            const fromNumber = process.env.TWILIO_PHONE_NUMBER!;
            
            const message = await client.messages.create({
              from: fromNumber,
              to: fuData.contactId,
              body,
              statusCallback: `${process.env.APP_URL}/api/twilio/status`
            });
            const sentTime = Date.now();
            lastSendTime[campId] = sentTime;
            
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
            
            await updateDoc(fuDoc.ref, { status: 'sent', sentAt: sentTime });
            
            // Also update the recipient document if part of a campaign
            if (fuData.campaignId) {
               const rcptSnap = await getDocs(query(collection(db, 'campaignRecipients'), where('campaignId', '==', fuData.campaignId), where('contactId', '==', fuData.contactId), limit(1)));
               if (!rcptSnap.empty) {
                  const rcptDoc = rcptSnap.docs[0];
                  if (isStep1) {
                     await updateDoc(rcptDoc.ref, { followUp1SentAt: sentTime });
                  } else {
                     await updateDoc(rcptDoc.ref, { followUp2SentAt: sentTime });
                  }
               }
            }
            
            if (isStep1) {
                const fu2DelayMinutes = cData?.followUp2DelayMinutes ?? (settings!.followUp2Days * 24 * 60);
                const fuTime = sentTime + (fu2DelayMinutes * 60 * 1000);
                const fuRef = doc(collection(db, 'scheduledFollowUps'));
                await setDoc(fuRef, {
                  id: fuRef.id,
                  contactId: fuData.contactId,
                  campaignId: fuData.campaignId || null,
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
        } catch(e: any) {
            console.error("Failed to send follow up SMS", e);
            await updateDoc(fuDoc.ref, { 
                status: 'failed', 
                lastAttemptAt: Date.now(),
                errorMessage: e.message,
                errorCode: e.code
            });
        }
      }

  } catch (error) {
    console.error("Worker error:", error);
  }
}, 5000);


async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
