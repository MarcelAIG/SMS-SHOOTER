import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, getDocs, where } from 'firebase/firestore';
import { db } from '../../db/firebase';
import { Campaign, CampaignRecipient } from '../../types';
import NewCampaignModal from '../../components/campaigns/NewCampaignModal';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState<(Campaign & { metrics: any })[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'campaigns'));
    const unsubscribe = onSnapshot(q, async (snap) => {
      const camps = snap.docs.map(d => d.data() as Campaign);
      
      const campaignsWithMetrics = await Promise.all(camps.map(async (camp) => {
        // Fetch metrics for each campaign
        const rcptsSnap = await getDocs(query(collection(db, 'campaignRecipients'), where('campaignId', '==', camp.id)));
        let sent = 0;
        let total = rcptsSnap.size;
        
        // This is a naive metric approach. In a production app you'd want aggregate documents.
        for (const r of rcptsSnap.docs) {
           const status = r.data().status;
           if (['Sent', 'Delivered'].includes(status)) sent++;
        }
        
        return {
          ...camp,
          metrics: {
            leads: total,
            sent,
            replies: 0, // Placeholder, calculating replies for all campaigns in list view is expensive without aggregates
            progress: total > 0 ? Math.round((sent / total) * 100) : 0
          }
        };
      }));
      
      // Sort by newest first
      campaignsWithMetrics.sort((a, b) => b.createdAt - a.createdAt);
      setCampaigns(campaignsWithMetrics);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-neutral-800 text-neutral-300 border-neutral-700';
      case 'SCHEDULED': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'RUNNING': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'PAUSED': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'COMPLETED': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'STOPPED':
      case 'CANCELLED':
      case 'FAILED': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-neutral-800 text-neutral-300 border-neutral-700';
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto w-full max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-[26px] font-bold text-white tracking-tight">Campaigns</h2>
        <button 
          onClick={() => setShowNewModal(true)}
          className="bg-white hover:bg-neutral-200 text-black font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          + New Campaign
        </button>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] text-neutral-300">
            <thead className="text-[11px] font-bold uppercase tracking-wider bg-neutral-900 border-b border-neutral-800 text-neutral-500">
              <tr>
                <th className="px-6 py-4">Campaign</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Leads</th>
                <th className="px-6 py-4">Sent</th>
                <th className="px-6 py-4">Replies</th>
                <th className="px-6 py-4">Timezone</th>
                <th className="px-6 py-4">Progress</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-neutral-500">Loading campaigns...</td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-neutral-500">
                    <div className="flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-3">
                        <span className="text-xl">🚀</span>
                      </div>
                      <p className="text-sm font-medium text-white mb-1">No campaigns yet</p>
                      <p className="text-xs">Create your first campaign to start outreach.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                campaigns.map(c => (
                  <tr 
                    key={c.id} 
                    onClick={() => navigate(`/campaign/${c.id}/leads`)}
                    className="hover:bg-neutral-800/40 cursor-pointer transition-colors group h-[52px]"
                  >
                    <td className="px-6 py-3 font-semibold text-white">{c.name}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono">{c.metrics.leads}</td>
                    <td className="px-6 py-3 font-mono">{c.metrics.sent}</td>
                    <td className="px-6 py-3 font-mono text-neutral-500">-</td>
                    <td className="px-6 py-3 text-neutral-400">{c.timezone}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                          <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${c.metrics.progress}%` }} />
                        </div>
                        <span className="text-xs text-neutral-400 font-mono">{c.metrics.progress}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-700 transition-colors opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); navigate(`/campaign/${c.id}/options`); }}>
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showNewModal && <NewCampaignModal onClose={() => setShowNewModal(false)} />}
    </div>
  );
}
