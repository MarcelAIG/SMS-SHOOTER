import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, onSnapshot, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../db/firebase';
import { Campaign } from '../types';
import { DateTime } from 'luxon';
import { Play, Pause, Square, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    initialSent: 0,
    replies: 0,
    interested: 0,
    followUpNeeded: 0,
    callsBooked: 0,
    unread: 0
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignStats, setCampaignStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unreadQuery = query(collection(db, 'messages'), where('direction', '==', 'INBOUND'), where('read', '==', false));
    const unsubUnread = onSnapshot(unreadQuery, (snap) => {
      setStats(prev => ({ ...prev, unread: snap.size }));
    });

    const campaignsQuery = query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'));
    const unsubCampaigns = onSnapshot(campaignsQuery, async (snap) => {
      const camps = snap.docs.map(d => d.data() as Campaign);
      setCampaigns(camps);

      // fetch stats for each campaign
      const statsObj: Record<string, any> = {};
      for (const camp of camps) {
        const rcpts = await getDocs(query(collection(db, 'campaignRecipients'), where('campaignId', '==', camp.id)));
        let sent = 0, remaining = 0, failed = 0, replies = 0;
        rcpts.forEach(r => {
          const s = r.data().status;
          if (s === 'Sent' || s === 'Delivered') sent++;
          else if (s === 'Failed') failed++;
          else if (s === 'Queued' || s === 'Pending' || s === 'Scheduled') remaining++;
          else if (s === 'Skipped') sent++; // skipped is effectively done
        });
        const msgs = await getDocs(query(collection(db, 'messages'), where('direction', '==', 'INBOUND')));
        let campReplies = 0;
        rcpts.forEach(r => {
           const matches = msgs.docs.filter(d => d.data().contactId === r.data().contactId);
           if (matches.length > 0) campReplies++;
        });
        statsObj[camp.id] = { sent, remaining, failed, replies: campReplies, total: rcpts.size };
      }
      setCampaignStats(statsObj);
    });

    async function loadStats() {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startTs = startOfDay.getTime();

        const msgsRef = collection(db, 'messages');
        const initialQuery = query(msgsRef, where('direction', '==', 'OUTBOUND'), where('isInitial', '==', true), where('createdAt', '>=', startTs));
        const repliesQuery = query(msgsRef, where('direction', '==', 'INBOUND'), where('createdAt', '>=', startTs));
        
        const contactsRef = collection(db, 'contacts');
        const interestedQuery = query(contactsRef, where('status', '==', 'INTERESTED'));
        const followupNeededQuery = query(contactsRef, where('status', '==', 'FOLLOW UP NEEDED'));
        const callBookedQuery = query(contactsRef, where('status', '==', 'CALL BOOKED'));

        const [initialSnap, repliesSnap, intSnap, fuSnap, cbSnap] = await Promise.all([
          getDocs(initialQuery),
          getDocs(repliesQuery),
          getDocs(interestedQuery),
          getDocs(followupNeededQuery),
          getDocs(callBookedQuery)
        ]);

        setStats(prev => ({
          ...prev,
          initialSent: initialSnap.size,
          replies: repliesSnap.size,
          interested: intSnap.size,
          followUpNeeded: fuSnap.size,
          callsBooked: cbSnap.size
        }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
    
    const interval = setInterval(loadStats, 10000);
    return () => {
      clearInterval(interval);
      unsubUnread();
      unsubCampaigns();
    };
  }, []);

  const updateCampaignStatus = async (id: string, status: string, currentStart?: number) => {
    if (status === 'CANCELLED' && !confirm('Are you sure you want to cancel this campaign? Pending messages will not be sent.')) return;
    if (status === 'RUNNING' && currentStart && Date.now() < currentStart) {
      await updateDoc(doc(db, 'campaigns', id), { status, scheduledStart: Date.now() });
    } else {
      await updateDoc(doc(db, 'campaigns', id), { status });
    }
  };

  const formatLocalTime = (ts: number, tz: string) => {
    return DateTime.fromMillis(ts).setZone(tz).toFormat('LLL dd, HH:mm');
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2"><span>Dashboard</span><span className="bg-blue-600/20 text-blue-400 text-[10px] px-2 py-0.5 rounded font-mono border border-blue-500/30">v2 Updated</span></h2>
      
      {loading ? (
        <div className="text-neutral-500">Loading stats...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
            <StatCard title="Initial SMS Today" value={`${stats.initialSent} / 20`} />
            <StatCard title="Unread SMS" value={stats.unread} valueColor={stats.unread > 0 ? "text-[#ff3b30]" : "text-white"} />
            <StatCard title="Replies Today" value={stats.replies} />
            <StatCard title="Interested" value={stats.interested} />
            <StatCard title="Follow Up Needed" value={stats.followUpNeeded} />
            <StatCard title="Calls Booked" value={stats.callsBooked} />
          </div>

          <div>
            <h3 className="text-lg font-bold text-white mb-3">Active / Scheduled Campaigns</h3>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-sm text-neutral-300">
                  <thead className="text-xs uppercase bg-neutral-800/50 text-neutral-400 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2 font-medium">Campaign</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium">Timezone</th>
                      <th className="px-4 py-2 font-medium">Start</th>
                      <th className="px-4 py-2 font-medium">End/Cutoff</th>
                      <th className="px-4 py-2 font-medium">Sent</th>
                      <th className="px-4 py-2 font-medium">Remain</th>
                      <th className="px-4 py-2 font-medium">Replies</th>
                      <th className="px-4 py-2 font-medium">Progress</th>
                      <th className="px-4 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {campaigns.slice(0, 20).map(c => {
                      const cStat = campaignStats[c.id] || { sent: 0, remaining: 0, total: 0 };
                      const progress = cStat.total > 0 ? Math.round((cStat.sent / cStat.total) * 100) : 0;
                      return (
                        <tr key={c.id} className="hover:bg-neutral-800/30 cursor-pointer" onClick={() => navigate(`/campaign/${c.id}`)}>
                          <td className="px-4 py-2 font-medium text-white">{c.name}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              c.status === 'RUNNING' ? 'bg-green-500/20 text-green-400' :
                              c.status === 'PAUSED' ? 'bg-yellow-500/20 text-yellow-400' :
                              c.status === 'COMPLETED' ? 'bg-blue-500/20 text-blue-400' :
                              c.status === 'STOPPED' || c.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' :
                              'bg-neutral-700 text-neutral-300'
                            }`}>{c.status}</span>
                          </td>
                          <td className="px-4 py-2 text-xs">{c.timezone}</td>
                          <td className="px-4 py-2 text-xs">{formatLocalTime(c.scheduledStart, c.timezone)}</td>
                          <td className="px-4 py-2 text-xs">
                            {c.endDate ? formatLocalTime(c.endDate, c.timezone) : 'None'}
                          </td>
                          <td className="px-4 py-2">{cStat.sent}</td>
                          <td className="px-4 py-2">{cStat.remaining}</td>
                          <td className="px-4 py-2">{cStat.replies}</td>
                          <td className="px-4 py-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                <div className="h-full bg-white rounded-full" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-xs text-neutral-400">{progress}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end space-x-2">
                              {(c.status === 'SCHEDULED' || c.status === 'PAUSED' || c.status === 'DRAFT') && (
                                <button onClick={(e) => { e.stopPropagation(); updateCampaignStatus(c.id, 'RUNNING', c.scheduledStart); }} className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white" title="Start/Resume">
                                  <Play className="w-4 h-4" />
                                </button>
                              )}
                              {c.status === 'RUNNING' && (
                                <button onClick={(e) => { e.stopPropagation(); updateCampaignStatus(c.id, 'PAUSED'); }} className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white" title="Pause">
                                  <Pause className="w-4 h-4" />
                                </button>
                              )}
                              {(c.status === 'RUNNING' || c.status === 'PAUSED') && (
                                <button onClick={(e) => { e.stopPropagation(); updateCampaignStatus(c.id, 'STOPPED'); }} className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white" title="Stop">
                                  <Square className="w-4 h-4" />
                                </button>
                              )}
                              {['RUNNING', 'PAUSED', 'SCHEDULED', 'DRAFT'].includes(c.status) && (
                                <button onClick={(e) => { e.stopPropagation(); updateCampaignStatus(c.id, 'CANCELLED'); }} className="p-1 hover:bg-neutral-700 rounded text-red-500/70 hover:text-red-500" title="Cancel">
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {campaigns.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-6 text-center text-neutral-500">No campaigns found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, valueColor = "text-white" }: { title: string, value: string | number, valueColor?: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h3 className="text-neutral-400 text-[11px] font-medium uppercase tracking-wider mb-1">{title}</h3>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

