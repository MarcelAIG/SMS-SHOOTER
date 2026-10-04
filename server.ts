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
      ...(process.env.APP_URL && !process.env.APP_URL.includes('localhost') ? { statusCallback: `${process.env.APP_URL}/api/twilio/status` } : {})
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
        nextFollowUpAt: null,
        hasReplied: true,
        excludeFromInbox: false,
        excludeFromBlast: false
      });
    } else {
      await updateDoc(contactRef, {
        lastMessageAt: now,
        nextFollowUpAt: null,
        hasReplied: true,
        excludeFromInbox: false
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
app.post('/api/send-bulk-direct', async (req, res) => {
  const { contactIds, message } = req.body;
  if (!Array.isArray(contactIds) || contactIds.length === 0 || !message) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    let client;
    try {
      client = getTwilio();
    } catch (e: any) {
      return res.status(400).json({ error: e.message || 'Twilio not configured' });
    }
    
    const fromNumber = process.env.TWILIO_PHONE_NUMBER!;
    const now = Date.now();
    let sentCount = 0;
    let failedCount = 0;

    for (const cid of contactIds) {
      const contactDoc = await getDoc(doc(db, 'contacts', cid));
      const cData = contactDoc.exists() ? contactDoc.data() : null;

      let bodyWithVars = message;
      bodyWithVars = bodyWithVars.replace(/{{firstName}}/gi, cData?.firstName || '');
      bodyWithVars = bodyWithVars.replace(/{{businessName}}/gi, cData?.businessName || '');

      try {
        const twilioMsg = await client.messages.create({
          from: fromNumber,
          to: cid, // Assuming contact ID is phone number
          body: bodyWithVars,
          ...(process.env.APP_URL && !process.env.APP_URL.includes('localhost') ? { statusCallback: `${process.env.APP_URL}/api/twilio/status` } : {})
        });

        const msgData = {
          id: twilioMsg.sid,
          twilioSid: twilioMsg.sid,
          contactId: cid,
          from: twilioMsg.from,
          to: twilioMsg.to,
          body: twilioMsg.body,
          direction: 'OUTBOUND',
          status: twilioMsg.status,
          createdAt: now,
          errorCode: twilioMsg.errorCode || null,
          errorMessage: twilioMsg.errorMessage || null,
          isInitial: true // General blast
        };
        await setDoc(doc(db, 'messages', twilioMsg.sid), msgData);
        
        // update contact doc just so we know last sent
        if (contactDoc.exists()) {
          await updateDoc(doc(db, 'contacts', cid), {
             lastMessageAt: now
          });
        }
        
        sentCount++;
      } catch (err: any) {
        console.error('Failed direct send to', cid, err);
        failedCount++;
      }
    }

    res.json({ success: true, sent: sentCount, failed: failedCount });
  } catch (error: any) {
    console.error('Direct send error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaign/bulk-send', async (req, res) => {
  const { campaignId, recipientIds, step } = req.body;
  if (!campaignId || !Array.isArray(recipientIds) || recipientIds.length === 0 || !step) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  try {
    const campDoc = await getDoc(doc(db, 'campaigns', campaignId));
    if (!campDoc.exists()) return res.status(404).json({ error: 'Campaign not found' });
    const camp = campDoc.data();

    let client;
    try {
      client = getTwilio();
    } catch (e: any) {
      return res.status(400).json({ error: e.message || 'Twilio not configured' });
    }
    
    const fromNumber = process.env.TWILIO_PHONE_NUMBER!;
    const now = Date.now();
    let sentCount = 0;
    let failedCount = 0;

    for (const rid of recipientIds) {
      const qRef = doc(db, 'campaignRecipients', rid);
      const qDoc = await getDoc(qRef);
      if (!qDoc.exists()) continue;
      const qData = qDoc.data();
      
      const contactDoc = await getDoc(doc(db, 'contacts', qData.contactId));
      const cData = contactDoc.exists() ? contactDoc.data() : null;

      let msgTemplate = '';
      if (step === 'initial') msgTemplate = camp.settings?.initialMessage || '';
      else if (step === 'followup1') msgTemplate = camp.settings?.followUp1Message || '';
      else if (step === 'followup2') msgTemplate = camp.settings?.followUp2Message || '';

      if (!msgTemplate) {
        await updateDoc(qRef, { status: 'FAILED', errorMessage: 'Message sequence is empty' });
        failedCount++;
        continue;
      }

      let bodyWithVars = msgTemplate;
      bodyWithVars = bodyWithVars.replace(/{{firstName}}/gi, cData?.firstName || '');
      bodyWithVars = bodyWithVars.replace(/{{businessName}}/gi, cData?.businessName || '');

      await updateDoc(qRef, { status: 'SENDING' });

      try {
        const message = await client.messages.create({
          from: fromNumber,
          to: qData.contactId,
          body: bodyWithVars,
          ...(process.env.APP_URL && !process.env.APP_URL.includes('localhost') ? { statusCallback: `${process.env.APP_URL}/api/twilio/status` } : {})
        });

        const msgData = {
          id: message.sid,
          twilioSid: message.sid,
          contactId: qData.contactId,
          from: message.from,
          to: message.to,
          body: message.body,
          direction: 'OUTBOUND',
          status: message.status,
          createdAt: now,
          errorCode: message.errorCode || null,
          errorMessage: message.errorMessage || null,
          isInitial: step === 'initial'
        };
        await setDoc(doc(db, 'messages', message.sid), msgData);

        const updates: any = { status: 'SENT' };
        if (step === 'initial') updates.initialSentAt = now;
        else if (step === 'followup1') updates.followUp1SentAt = now;
        else if (step === 'followup2') updates.followUp2SentAt = now;

        await updateDoc(qRef, updates);
        
        await updateDoc(doc(db, 'contacts', qData.contactId), {
           lastMessageAt: now
        });
        
        sentCount++;
      } catch (err: any) {
        console.error('Failed bulk send to', qData.contactId, err);
        await updateDoc(qRef, { status: 'FAILED', errorMessage: err.message });
        failedCount++;
      }
    }

    res.json({ success: true, sent: sentCount, failed: failedCount });
  } catch (error: any) {
    console.error('Bulk send error:', error);
    res.status(500).json({ error: error.message });
  }
});


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
