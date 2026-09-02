import React, { useState } from 'react';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../db/firebase';
import { X, Upload, Plus, Hash } from 'lucide-react';
import Papa from 'papaparse';

interface AddLeadsModalProps {
  campaignId: string;
  onClose: () => void;
  onAdded: (count: number) => void;
}

export default function AddLeadsModal({ campaignId, onClose, onAdded }: AddLeadsModalProps) {
  const [activeTab, setActiveTab] = useState<'CSV' | 'MANUAL' | 'PASTE'>('CSV');
  const [adding, setAdding] = useState(false);

  // CSV
  const [csvText, setCsvText] = useState('');

  // Manual
  const [singleContact, setSingleContact] = useState({ phone: '', businessName: '', firstName: '' });

  // Paste
  const [bulkNumbers, setBulkNumbers] = useState('');

  const [result, setResult] = useState<{ added: number; duplicates: number; invalid: number } | null>(null);

  const normalizePhone = (p: string) => '+' + p.replace(/\D/g, '');

  const addLeadToCampaign = async (phone: string, businessName: string, firstName: string) => {
    let added = 0; let duplicates = 0; let invalid = 0;
    const normPhone = normalizePhone(phone);
    if (normPhone.length < 5) return { added: 0, duplicates: 0, invalid: 1 };

    // Check if contact exists
    const contactRef = doc(db, 'contacts', normPhone);
    const snap = await getDoc(contactRef);
    if (!snap.exists()) {
      await setDoc(contactRef, {
        id: normPhone,
        phone: normPhone,
        businessName: businessName || 'Unknown',
        firstName: firstName || '',
        notes: '',
        status: 'NEW',
        dateAdded: Date.now(),
        lastMessageAt: Date.now(),
        followUpStage: 0,
        nextFollowUpAt: null
      });
    }

    // Check if already in campaign
    const rcptQ = query(collection(db, 'campaignRecipients'), where('campaignId', '==', campaignId), where('contactId', '==', normPhone));
    const rcptSnap = await getDocs(rcptQ);
    if (!rcptSnap.empty) {
      duplicates++;
    } else {
      const docRef = doc(collection(db, 'campaignRecipients'));
      await setDoc(docRef, {
        id: docRef.id,
        campaignId,
        contactId: normPhone,
        status: 'Scheduled',
        queuedAt: Date.now(),
        sentAt: null
      });
      added++;
    }
    return { added, duplicates, invalid };
  };

  const handleParseCsv = () => {
    if (!csvText.trim()) return;
    setAdding(true);
    setResult(null);
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let added = 0; let duplicates = 0; let invalid = 0;
        for (const row of results.data as any[]) {
          const phone = row.phone || row.Phone || row.PHONE;
          if (!phone) continue;
          const res = await addLeadToCampaign(phone, row.businessName || row.Business || 'Unknown', row.firstName || row.Name || '');
          added += res.added; duplicates += res.duplicates; invalid += res.invalid;
        }
        setResult({ added, duplicates, invalid });
        setAdding(false);
        if (added > 0) onAdded(added);
      }
    });
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleContact.phone.trim()) return;
    setAdding(true);
    setResult(null);
    const res = await addLeadToCampaign(singleContact.phone, singleContact.businessName, singleContact.firstName);
    setResult(res);
    setAdding(false);
    if (res.added > 0) {
      setSingleContact({ phone: '', businessName: '', firstName: '' });
      onAdded(res.added);
    }
  };

  const handleAddPaste = async () => {
    if (!bulkNumbers.trim()) return;
    setAdding(true);
    setResult(null);
    const lines = bulkNumbers.split('\n').map(l => l.trim()).filter(l => l);
    let added = 0; let duplicates = 0; let invalid = 0;
    for (const line of lines) {
      const res = await addLeadToCampaign(line, 'New Contact', '');
      added += res.added; duplicates += res.duplicates; invalid += res.invalid;
    }
    setResult({ added, duplicates, invalid });
    if (added > 0) {
      setBulkNumbers('');
      onAdded(added);
    }
    setAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-white">Add Leads to Campaign</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-neutral-800">
          <button onClick={() => setActiveTab('CSV')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'CSV' ? 'text-white border-b-2 border-white bg-neutral-800/50' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Upload className="w-4 h-4 mx-auto mb-1" /> CSV Upload
          </button>
          <button onClick={() => setActiveTab('MANUAL')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'MANUAL' ? 'text-white border-b-2 border-white bg-neutral-800/50' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Plus className="w-4 h-4 mx-auto mb-1" /> Manual
          </button>
          <button onClick={() => setActiveTab('PASTE')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'PASTE' ? 'text-white border-b-2 border-white bg-neutral-800/50' : 'text-neutral-500 hover:text-neutral-300'}`}>
            <Hash className="w-4 h-4 mx-auto mb-1" /> Paste Numbers
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {result && (
            <div className="mb-6 bg-neutral-800/50 border border-neutral-700 rounded-lg p-4 flex items-center justify-around text-center">
              <div><div className="text-2xl font-bold text-green-400">{result.added}</div><div className="text-[11px] text-neutral-400 uppercase font-bold tracking-wider">Added</div></div>
              <div><div className="text-2xl font-bold text-amber-400">{result.duplicates}</div><div className="text-[11px] text-neutral-400 uppercase font-bold tracking-wider">Duplicates</div></div>
              <div><div className="text-2xl font-bold text-red-400">{result.invalid}</div><div className="text-[11px] text-neutral-400 uppercase font-bold tracking-wider">Invalid</div></div>
            </div>
          )}

          {activeTab === 'CSV' && (
            <div className="space-y-4">
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide">Paste CSV Data</label>
              <textarea
                rows={6}
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="phone,businessName,firstName&#10;+1234567890,Acme Corp,John"
              />
              <button onClick={handleParseCsv} disabled={adding || !csvText.trim()} className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-neutral-200 disabled:opacity-50 transition-colors">
                {adding ? 'Processing...' : 'Import CSV Data'}
              </button>
            </div>
          )}

          {activeTab === 'MANUAL' && (
            <form onSubmit={handleAddManual} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Phone Number *</label>
                <input required value={singleContact.phone} onChange={e => setSingleContact({...singleContact, phone: e.target.value})} placeholder="+1234567890" className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Business Name *</label>
                <input required value={singleContact.businessName} onChange={e => setSingleContact({...singleContact, businessName: e.target.value})} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">First Name (Optional)</label>
                <input value={singleContact.firstName} onChange={e => setSingleContact({...singleContact, firstName: e.target.value})} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
              </div>
              <button type="submit" disabled={adding || !singleContact.phone.trim()} className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-neutral-200 disabled:opacity-50 transition-colors mt-2">
                {adding ? 'Adding...' : 'Add Lead'}
              </button>
            </form>
          )}

          {activeTab === 'PASTE' && (
            <div className="space-y-4">
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide">Paste Phone Numbers</label>
              <p className="text-xs text-neutral-500 mb-2">One number per line. Duplicates in this campaign will be skipped.</p>
              <textarea
                rows={8}
                value={bulkNumbers}
                onChange={e => setBulkNumbers(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-white/20"
                placeholder="+4791234567&#10;+4798877665&#10;+4744556677"
              />
              <button onClick={handleAddPaste} disabled={adding || !bulkNumbers.trim()} className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-neutral-200 disabled:opacity-50 transition-colors">
                {adding ? 'Processing...' : 'Add Numbers'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
