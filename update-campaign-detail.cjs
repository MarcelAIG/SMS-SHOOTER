const fs = require('fs');
let code = fs.readFileSync('src/pages/CampaignDetail.tsx', 'utf8');

if (!code.includes("import { DateTime } from 'luxon';")) {
  code = code.replace(
    "import { ArrowLeft } from 'lucide-react';",
    "import { ArrowLeft } from 'lucide-react';\nimport { DateTime } from 'luxon';"
  );
}

const replacement = `
  const [stats, setStats] = useState({
    queued: 0, sent: 0, delivered: 0, failed: 0, replies: 0, total: 0
  });

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const campSnap = await getDoc(doc(db, 'campaigns', id));
        if (!campSnap.exists()) return;
        setCampaign(campSnap.data() as Campaign);

        const rcptsSnap = await getDocs(query(collection(db, 'campaignRecipients'), where('campaignId', '==', id)));
        
        const rowData = [];
        let qCount = 0, sCount = 0, dCount = 0, fCount = 0, rCount = 0;

        for (const r of rcptsSnap.docs) {
          const rcpt = r.data() as CampaignRecipient;
          const cSnap = await getDoc(doc(db, 'contacts', rcpt.contactId));
          const contact = cSnap.exists() ? cSnap.data() as Contact : null;

          // Fetch messages
          const msgsSnap = await getDocs(query(collection(db, 'messages'), where('contactId', '==', rcpt.contactId)));
          const msgs = msgsSnap.docs.map(m => m.data());
          
          const inbound = msgs.filter(m => m.direction === 'INBOUND');
          const outbound = msgs.filter(m => m.direction === 'OUTBOUND').sort((a, b) => a.createdAt - b.createdAt);

          if (inbound.length > 0) rCount++;
          
          const status = rcpt.status;
          if (status === 'Queued' || status === 'Scheduled' || status === 'Pending') qCount++;
          if (status === 'Sent') sCount++;
          if (status === 'Delivered') dCount++;
          if (status === 'Failed') fCount++;

          const initialMsg = outbound[0];
          const fu1 = outbound[1];
          const fu2 = outbound[2];

          rowData.push({
            id: rcpt.id,
            businessName: contact?.businessName || 'Unknown',
            phone: contact?.phone || rcpt.contactId,
            initialStatus: initialMsg ? initialMsg.status : rcpt.status,
            fu1Status: fu1 ? fu1.status : (contact?.followUpStage === 1 ? 'Pending' : (inbound.length > 0 ? 'Skipped' : '-')),
            fu2Status: fu2 ? fu2.status : (contact?.followUpStage === 2 ? 'Pending' : (inbound.length > 0 ? 'Skipped' : '-')),
            lastStatus: msgs.length > 0 ? msgs[msgs.length - 1].status : rcpt.status,
            reply: inbound.length > 0 ? 'Yes' : 'No',
            leadStatus: contact?.status || 'Unknown'
          });
        }
        setRows(rowData);
        setStats({ queued: qCount, sent: sCount, delivered: dCount, failed: fCount, replies: rCount, total: rcptsSnap.size });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const formatTime = (ts: number, tz: string) => DateTime.fromMillis(ts).setZone(tz).toFormat('LLL dd, yyyy HH:mm');

  if (loading) return <div className="p-8 text-neutral-400">Loading campaign...</div>;
  if (!campaign) return <div className="p-8 text-neutral-400">Campaign not found</div>;

  const progress = stats.total > 0 ? Math.round(((stats.sent + stats.delivered) / stats.total) * 100) : 0;
`;

code = code.replace(/  useEffect\(\(\) => \{[\s\S]*?if \(!campaign\) return <div className="p-8 text-neutral-400">Campaign not found<\/div>;/m, replacement);

const detailsReplacement = `
      <div className="mb-6 flex items-center space-x-4">
        <Link to="/" className="text-neutral-400 hover:text-white">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h2 className="text-2xl font-bold text-white">{campaign.name} Details</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
          <h3 className="text-neutral-400 text-sm font-medium mb-4">Progress</h3>
          <div className="flex justify-between items-end mb-2">
            <span className="text-3xl font-bold text-white">{stats.sent + stats.delivered} / {stats.total} sent</span>
            <span className="text-lg text-neutral-400">{progress}%</span>
          </div>
          <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-white rounded-full" style={{ width: \`\${progress}%\` }} />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-neutral-500">Queued</div>
              <div className="text-white font-medium">{stats.queued}</div>
            </div>
            <div>
              <div className="text-neutral-500">Sent</div>
              <div className="text-white font-medium">{stats.sent}</div>
            </div>
            <div>
              <div className="text-neutral-500">Delivered</div>
              <div className="text-white font-medium">{stats.delivered}</div>
            </div>
            <div>
              <div className="text-neutral-500">Failed</div>
              <div className="text-white font-medium">{stats.failed}</div>
            </div>
            <div>
              <div className="text-neutral-500">Replies</div>
              <div className="text-white font-medium">{stats.replies}</div>
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 md:col-span-2">
          <h3 className="text-neutral-400 text-sm font-medium mb-4">Campaign Info</h3>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-neutral-500 mb-1">Timezone</div>
              <div className="text-white font-medium">{campaign.timezone}</div>
            </div>
            <div>
              <div className="text-neutral-500 mb-1">Send Window</div>
              <div className="text-white font-medium">{campaign.sendWindowStart} - {campaign.sendWindowEnd}</div>
            </div>
            <div>
              <div className="text-neutral-500 mb-1">Started at</div>
              <div className="text-white font-medium">{formatTime(campaign.scheduledStart, campaign.timezone)}</div>
            </div>
            <div>
              <div className="text-neutral-500 mb-1">Status</div>
              <div className="text-white font-medium">{campaign.status}</div>
            </div>
            <div>
              <div className="text-neutral-500 mb-1">Estimated completion</div>
              <div className="text-white font-medium">
                {campaign.status === 'COMPLETED' ? 'Completed' : (stats.queued > 0 ? 'Calculating...' : 'N/A')}
              </div>
            </div>
            <div>
              <div className="text-neutral-500 mb-1">Cutoff (End Date)</div>
              <div className="text-white font-medium">
                {campaign.endDate ? formatTime(campaign.endDate, campaign.timezone) : 'None'}
              </div>
            </div>
          </div>
        </div>
      </div>
`;

code = code.replace(/      <div className="mb-6 flex items-center space-x-4">[\s\S]*?<h2 className="text-2xl font-bold text-white">\{campaign\.name\} Details<\/h2>\n      <\/div>/m, detailsReplacement);

fs.writeFileSync('src/pages/CampaignDetail.tsx', code);
