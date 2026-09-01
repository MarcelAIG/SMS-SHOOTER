import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useParams, useLocation, Navigate } from 'react-router-dom';
import { doc, onSnapshot, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';
import { db } from '../../db/firebase';
import { Campaign } from '../../types';
import { ArrowLeft, Play, Pause, Square, XCircle } from 'lucide-react';
import CampaignLeads from './tabs/CampaignLeads';
import CampaignSequences from './tabs/CampaignSequences';
import CampaignSchedule from './tabs/CampaignSchedule';
import CampaignOptions from './tabs/CampaignOptions';

export default function CampaignWorkspace() {
  const { id } = useParams();
  const location = useLocation();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState({ leads: 0, sent: 0, replies: 0, remaining: 0 });

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'campaigns', id), (snap) => {
      if (snap.exists()) {
        setCampaign(snap.data() as Campaign);
      }
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    async function loadStats() {
      // Basic stats loading. In prod, use aggregations.
      const rcptsSnap = await getDocs(query(collection(db, 'campaignRecipients'), where('campaignId', '==', id)));
      let leads = rcptsSnap.size;
      let sent = 0;
      let remaining = 0;
      for (const r of rcptsSnap.docs) {
        const status = r.data().status;
        if (['Sent', 'Delivered'].includes(status)) sent++;
        if (['Pending', 'Scheduled', 'Queued'].includes(status)) remaining++;
      }
      setStats({ leads, sent, replies: 0, remaining });
    }
    loadStats();
    // Refresh stats every 10s while in workspace
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    if (!id) return;
    try {
      await updateDoc(doc(db, 'campaigns', id), { status: newStatus });
    } catch (e) {
      console.error(e);
      alert('Failed to update status');
    }
  };

  if (!campaign) {
    return <div className="p-8 text-neutral-400">Loading campaign workspace...</div>;
  }

  const tabs = [
    { name: 'Leads', path: `/campaign/${id}/leads` },
    { name: 'Sequences', path: `/campaign/${id}/sequences` },
    { name: 'Schedule', path: `/campaign/${id}/schedule` },
    { name: 'Options', path: `/campaign/${id}/options` }
  ];

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Header */}
      <div className="bg-neutral-950 border-b border-neutral-800 shrink-0">
        <div className="max-w-[1400px] mx-auto px-8 py-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <Link to="/campaign" className="inline-flex items-center text-[13px] font-medium text-neutral-400 hover:text-white transition-colors mb-3">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Campaigns
              </Link>
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-white tracking-tight">{campaign.name}</h1>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border
                  ${campaign.status === 'RUNNING' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                    campaign.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                    campaign.status === 'DRAFT' ? 'bg-neutral-800 text-neutral-300 border-neutral-700' :
                    'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                  {campaign.status}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Status Controls */}
              {['DRAFT', 'PAUSED', 'STOPPED', 'SCHEDULED'].includes(campaign.status) && (
                <button onClick={() => updateStatus('RUNNING')} className="inline-flex items-center px-4 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-neutral-200 transition-colors">
                  <Play className="w-4 h-4 mr-2" />
                  Start Campaign
                </button>
              )}
              {campaign.status === 'RUNNING' && (
                <button onClick={() => updateStatus('PAUSED')} className="inline-flex items-center px-4 py-2 bg-amber-500 text-black text-sm font-bold rounded-lg hover:bg-amber-400 transition-colors">
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </button>
              )}
              {['RUNNING', 'PAUSED', 'SCHEDULED'].includes(campaign.status) && (
                <button onClick={() => { if(confirm('Stop campaign? It will not send any more messages.')) updateStatus('STOPPED') }} className="inline-flex items-center px-3 py-2 bg-neutral-900 border border-neutral-800 text-neutral-300 text-sm font-medium rounded-lg hover:bg-neutral-800 transition-colors">
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </button>
              )}
              <button onClick={() => { if(confirm('Cancel campaign? Unsent messages will be cancelled.')) updateStatus('CANCELLED') }} className="inline-flex items-center px-3 py-2 bg-neutral-900 border border-red-900/30 text-red-400 text-sm font-medium rounded-lg hover:bg-red-950 transition-colors">
                <XCircle className="w-4 h-4 mr-2" />
                Cancel
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-8 text-sm">
            <div>
              <span className="text-neutral-500 mr-2">Leads:</span>
              <span className="text-white font-mono font-medium">{stats.leads}</span>
            </div>
            <div>
              <span className="text-neutral-500 mr-2">Sent:</span>
              <span className="text-white font-mono font-medium">{stats.sent}</span>
            </div>
            <div>
              <span className="text-neutral-500 mr-2">Replies:</span>
              <span className="text-white font-mono font-medium">{stats.replies}</span>
            </div>
            <div>
              <span className="text-neutral-500 mr-2">Remaining:</span>
              <span className="text-white font-mono font-medium">{stats.remaining}</span>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="max-w-[1400px] mx-auto px-8">
          <nav className="flex space-x-6">
            {tabs.map((tab) => {
              const isActive = location.pathname.startsWith(tab.path);
              return (
                <Link
                  key={tab.name}
                  to={tab.path}
                  className={`py-3 text-[13px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
                    isActive 
                      ? 'border-white text-white' 
                      : 'border-transparent text-neutral-500 hover:text-neutral-300'
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-8 h-full">
          <Routes>
            <Route path="/" element={<Navigate to="leads" replace />} />
            <Route path="leads" element={<CampaignLeads campaign={campaign} />} />
            <Route path="sequences" element={<CampaignSequences campaign={campaign} />} />
            <Route path="schedule" element={<CampaignSchedule campaign={campaign} />} />
            <Route path="options" element={<CampaignOptions campaign={campaign} />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
