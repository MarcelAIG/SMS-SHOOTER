const fs = require('fs');

let serverTs = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.post\('\/api\/campaign\/start', async \(req, res\) => \{[\s\S]*?res\.json\(\{ success: true, queued: contactIds\.length \}\);\n  \} catch\(e: any\) \{\n    res\.status\(500\)\.json\(\{ error: e\.message \}\);\n  \}\n\}\);/m;

const replacement = `app.post('/api/campaign/start', async (req, res) => {
  const { contactIds, campaignName, timezone, startDate, startTime, sendWindowStart, sendWindowEnd, hasEndDate, endDate, endTime } = req.body;
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return res.status(400).json({ error: 'No contacts provided' });
  }
  
  try {
    const { DateTime } = await import('luxon');
    
    // Parse start time in the given timezone
    const startDt = DateTime.fromFormat(\`\${startDate} \${startTime}\`, 'yyyy-MM-dd HH:mm', { zone: timezone });
    const scheduledStart = startDt.toMillis();
    
    let endTimestamp = null;
    if (hasEndDate && endDate && endTime) {
      const endDt = DateTime.fromFormat(\`\${endDate} \${endTime}\`, 'yyyy-MM-dd HH:mm', { zone: timezone });
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
});`;

serverTs = serverTs.replace(regex, replacement);

fs.writeFileSync('server.ts', serverTs);
console.log('updated server.ts endpoint');
