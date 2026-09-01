import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../../../db/firebase';
import { Campaign, CampaignRecipient, Contact } from '../../../types';
import AddLeadsModal from '../../../components/campaigns/AddLeadsModal';
import { Search, Filter, Plus } from 'lucide-react';
import { DateTime } from 'luxon';

interface CampaignLeadsProps {
  campaign: Campaign;
}

export default function CampaignLeads({ campaign }: CampaignLeadsProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');

  const loadLeads = async () => {
    setLoading(true);
    const rcptsSnap = await getDocs(query(collection(db, 'campaignRecipients'), where('campaignId', '==', campaign.id)));
    const rowData = [];
    
    for (const r of rcptsSnap.docs) {
      const rcpt = r.data() as CampaignRecipient;
      const cSnap = await getDoc(doc(db, 'contacts', rcpt.contactId));
      const contact = cSnap.exists() ? cSnap.data() as Contact : null;

      // Fetch messages
      const msgsSnap = await getDocs(query(collection(db, 'messages'), where('contactId', '==', rcpt.contactId)));
      const msgs = msgsSnap.docs.map(m => m.data());
      
      const inbound = msgs.filter(m => m.direction === 'INBOUND');
      const outbound = msgs.filter(m => m.direction === 'OUTBOUND').sort((a, b) => a.createdAt - b.createdAt);

      rowData.push({
        id: rcpt.id,
        businessName: contact?.businessName || 'Unknown',
        firstName: contact?.firstName || '',
        phone: contact?.phone || rcpt.contactId,
        seqStatus: rcpt.status,
        lastSmsAt: msgs.length > 0 ? Math.max(...msgs.map(m => m.createdAt)) : rcpt.queuedAt || 0,
        reply: inbound.length > 0 ? 'Yes' : 'No',
        leadStatus: contact?.status || 'Unknown'
      });
    }
    setRows(rowData.sort((a, b) => b.lastSmsAt - a.lastSmsAt));
    setLoading(false);
  };

  useEffect(() => {
    loadLeads();
  }, [campaign.id]);

  const getLeadStatusColor = (status: string) => {
    switch (status) {
      case 'INTERESTED': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'NOT INTERESTED': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'FOLLOW UP NEEDED': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'CALL BOOKED': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      default: return 'text-neutral-400 bg-neutral-800 border-neutral-700';
    }
  };

  const filteredRows = rows.filter(r => 
    r.businessName.toLowerCase().includes(search.toLowerCase()) || 
    r.phone.includes(search) || 
    r.firstName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search leads..." 
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-[13px] text-white focus:outline-none focus:ring-1 focus:ring-white/20 transition-all"
            />
          </div>
          <button className="flex items-center px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-[13px] font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-white text-black rounded-lg text-[13px] font-bold hover:bg-neutral-200 transition-colors"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Leads
        </button>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl flex-1 overflow-hidden flex flex-col shadow-sm">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-[13px] text-neutral-300">
            <thead className="text-[11px] font-bold uppercase tracking-wider bg-neutral-900 border-b border-neutral-800 text-neutral-500 sticky top-0 z-10">
              <tr>
                <th className="px-5 py-4 w-10">
                  <input type="checkbox" className="accent-white w-4 h-4 rounded border-neutral-700 bg-neutral-800" />
                </th>
                <th className="px-5 py-4">Business</th>
                <th className="px-5 py-4">First Name</th>
                <th className="px-5 py-4">Phone</th>
                <th className="px-5 py-4">Sequence Status</th>
                <th className="px-5 py-4">Last SMS</th>
                <th className="px-5 py-4">Reply</th>
                <th className="px-5 py-4">Lead Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-12 text-center text-neutral-500">Loading leads...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-neutral-500">
                      <div className="w-12 h-12 rounded-full bg-neutral-800/50 flex items-center justify-center mb-3 border border-neutral-800">
                        <Search className="w-5 h-5 text-neutral-600" />
                      </div>
                      <p className="text-sm font-medium text-white mb-1">No leads found</p>
                      <p className="text-xs">Add leads to this campaign to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map(r => (
                  <tr key={r.id} className="hover:bg-neutral-800/40 transition-colors h-[48px] group">
                    <td className="px-5 py-2">
                      <input type="checkbox" className="accent-white w-4 h-4 rounded border-neutral-700 bg-neutral-800" />
                    </td>
                    <td className="px-5 py-2 font-medium text-white">{r.businessName}</td>
                    <td className="px-5 py-2 text-neutral-400">{r.firstName || '-'}</td>
                    <td className="px-5 py-2 font-mono text-neutral-400">{r.phone}</td>
                    <td className="px-5 py-2">
                      <span className={`inline-flex items-center text-[11px] font-bold ${
                        r.seqStatus === 'Failed' ? 'text-red-400' :
                        r.seqStatus === 'Sent' || r.seqStatus === 'Delivered' ? 'text-green-400' : 'text-blue-400'
                      }`}>
                        {r.seqStatus}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-neutral-500 text-xs">
                      {r.lastSmsAt > 0 ? DateTime.fromMillis(r.lastSmsAt).toFormat('MMM d, HH:mm') : '-'}
                    </td>
                    <td className="px-5 py-2 font-medium">
                      {r.reply === 'Yes' ? <span className="text-green-400">Yes</span> : <span className="text-neutral-600">No</span>}
                    </td>
                    <td className="px-5 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase ${getLeadStatusColor(r.leadStatus)}`}>
                        {r.leadStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <AddLeadsModal 
          campaignId={campaign.id} 
          onClose={() => setShowAddModal(false)} 
          onAdded={(count) => {
            setShowAddModal(false);
            loadLeads();
          }} 
        />
      )}
    </div>
  );
}
