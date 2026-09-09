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
      const camps = snap.docs
        .filter(d => d.id !== 'settings' && d.data().name)
        .map(d => d.data() as Campaign);
      setCampaigns(camps);

      // fetch stats for each campaign
      const statsObj: Record<string, any> = {};
      for (const camp of camps) {
        const rcpts = await getDocs(query(collection(db, 'campaignRecipients'), where('campaignId', '==', camp.id)));
        let sent = 0, remaining = 0, failed = 0, replies = 0;
        rcpts.forEach(r => {
          const data = r.data();
          const s = (data.status || '').toUpperCase();
          if (['SENT', 'DELIVERED'].includes(s)) sent++;
          else if (s === 'FAILED') failed++;
          else if (['QUEUED', 'PENDING', 'SCHEDULED', 'SENDING'].includes(s)) remaining++;
          else if (s === 'SKIPPED') sent++; // skipped is effectively done
          
          if (s === 'REPLIED' || data.hasReplied) {
             replies++;
             sent++; // counts as processed
          }
        });
        statsObj[camp.id] = { sent, remaining, failed, replies, total: rcpts.size };
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
            <StatCard title="Initial SMS Today" value={stats.initialSent} />
            <StatCard title="Unread SMS" value={stats.unread} valueColor={stats.unread > 0 ? "text-[#ff3b30]" : "text-white"} />
            <StatCard title="Replies Today" value={stats.replies} />
            <StatCard title="Interested" value={stats.interested} />
            <StatCard title="Follow Up Needed" value={stats.followUpNeeded} />
            <StatCard title="Calls Booked" value={stats.callsBooked} />
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

