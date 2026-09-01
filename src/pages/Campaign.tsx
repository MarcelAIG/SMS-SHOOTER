import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../db/firebase';
import { Contact } from '../types';
import Papa from 'papaparse';
import { DateTime } from 'luxon';

export default function CampaignPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  
  const [singleContact, setSingleContact] = useState({ businessName: '', firstName: '', phone: '' });
  const [bulkNumbers, setBulkNumbers] = useState('');
  const [addingSingle, setAddingSingle] = useState(false);
  const [addingBulk, setAddingBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ added: number; duplicates: number; invalid: number } | null>(null);

  // Campaign Form
  const [campaignName, setCampaignName] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York');
  const [startDate, setStartDate] = useState(DateTime.local().toFormat('yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(DateTime.local().toFormat('HH:mm'));
  const [sendWindowStart, setSendWindowStart] = useState('09:00');
  const [sendWindowEnd, setSendWindowEnd] = useState('17:00');
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('17:00');
  
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'contacts'));
    return onSnapshot(q, snap => {
      setContacts(snap.docs.map(d => d.data() as Contact).filter(c => c.followUpStage === 0)); // Only new leads
    });
  }, []);

  const handleParseCsv = () => {
    setImporting(true);
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        let count = 0;
        for (const row of results.data as any[]) {
          const phone = row.phone || row.Phone || row.PHONE;
          if (!phone) continue;
          const normPhone = '+' + phone.replace(/\D/g, '');
          if (normPhone.length < 5) continue;
          await setDoc(doc(db, 'contacts', normPhone), {
            id: normPhone,
            phone: normPhone,
            businessName: row.businessName || row.Business || 'Unknown',
            firstName: row.firstName || row.Name || '',
            notes: row.notes || '',
            status: 'INTERESTED',
            dateAdded: Date.now(),
            lastMessageAt: Date.now(),
            followUpStage: 0,
            nextFollowUpAt: null
          }, { merge: true });
          count++;
        }
        setCsvText('');
        setImporting(false);
        alert(`Imported ${count} contacts.`);
      }
    });
  };

  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    const normPhone = '+' + singleContact.phone.replace(/\D/g, '');
    if (normPhone.length < 5) return alert('Invalid phone number');
    setAddingSingle(true);
    try {
      const contactRef = doc(db, 'contacts', normPhone);
      const snap = await getDoc(contactRef);
      if (snap.exists()) {
        alert('Contact already exists');
        return;
      }
      await setDoc(contactRef, {
        id: normPhone,
        phone: normPhone,
        businessName: singleContact.businessName || 'Unknown',
        firstName: singleContact.firstName || '',
        notes: '',
        status: 'INTERESTED',
        dateAdded: Date.now(),
        lastMessageAt: Date.now(),
        followUpStage: 0,
        nextFollowUpAt: null
      });
      setSingleContact({ businessName: '', firstName: '', phone: '' });
    } catch (err) {
      console.error(err);
      alert('Error adding contact');
    } finally {
      setAddingSingle(false);
    }
  };

  const handleAddBulk = async () => {
    if (!bulkNumbers.trim()) return;
    setAddingBulk(true);
    setBulkResult(null);
    let added = 0; let duplicates = 0; let invalid = 0;
    const lines = bulkNumbers.split('\n').map(l => l.trim()).filter(l => l);
    try {
      for (const line of lines) {
        const normPhone = '+' + line.replace(/\D/g, '');
        if (normPhone.length < 5) { invalid++; continue; }
        const contactRef = doc(db, 'contacts', normPhone);
        const snap = await getDoc(contactRef);
        if (snap.exists()) { duplicates++; continue; }
        await setDoc(contactRef, {
          id: normPhone,
          phone: normPhone,
          businessName: 'New Contact',
          firstName: '',
          notes: '',
          status: 'INTERESTED',
          dateAdded: Date.now(),
          lastMessageAt: Date.now(),
          followUpStage: 0,
          nextFollowUpAt: null
        });
        added++;
      }
      setBulkResult({ added, duplicates, invalid });
      if (added > 0) setBulkNumbers('');
    } catch (err) {
      console.error(err);
    } finally {
      setAddingBulk(false);
    }
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) return alert("Select contacts for the campaign");
    if (!campaignName.trim()) return alert("Enter campaign name");
    
    if (!confirm(`Create campaign "${campaignName}" for ${selectedIds.size} recipients?\nMessages will send starting ${startDate} ${startTime} (${timezone}).`)) {
      return;
    }

    setStarting(true);
    try {
      const res = await fetch('/api/campaign/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contactIds: Array.from(selectedIds),
          campaignName,
          timezone,
          startDate,
          startTime,
          sendWindowStart,
          sendWindowEnd,
          hasEndDate,
          endDate,
          endTime
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('Campaign created successfully! View progress on Dashboard.');
      setSelectedIds(new Set());
      setCampaignName('');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setStarting(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-white mb-6">Campaign Outreach</h2>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-medium text-white mb-2">Import Contacts (CSV)</h3>
            <textarea
              rows={3}
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-lg px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              placeholder="phone,businessName,firstName&#10;+1234567890,Acme Corp,John"
            />
            <button
              onClick={handleParseCsv}
              disabled={!csvText.trim() || importing}
              className="bg-neutral-800 hover:bg-neutral-700 text-white font-medium px-6 py-2 rounded-lg disabled:opacity-50 transition-colors"
            >
              {importing ? 'Importing...' : 'Import CSV'}
            </button>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-medium text-white mb-4">Add Contacts Manually</h3>
            <div className="space-y-6">
              <form onSubmit={handleAddSingle} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Phone Number</label>
                    <input required value={singleContact.phone} onChange={e => setSingleContact({...singleContact, phone: e.target.value})} placeholder="+1234567890" className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1">Business Name</label>
                    <input required value={singleContact.businessName} onChange={e => setSingleContact({...singleContact, businessName: e.target.value})} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white" />
                  </div>
                </div>
                <button type="submit" disabled={addingSingle} className="bg-neutral-800 hover:bg-neutral-700 text-white font-medium px-4 py-2 rounded-lg disabled:opacity-50 transition-colors">
                  {addingSingle ? 'Adding...' : 'Add Single Contact'}
                </button>
              </form>
            </div>
          </div>
          
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-medium text-white mb-4">Select Contacts ({selectedIds.size} selected)</h3>
            <div className="overflow-x-auto border border-neutral-800 rounded-lg max-h-96 overflow-y-auto">
              <table className="w-full text-left text-sm text-neutral-300">
                <thead className="text-xs uppercase bg-neutral-800/50 text-neutral-400 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 font-medium w-10">
                      <input 
                        type="checkbox" 
                        onChange={e => {
                          if (e.target.checked) setSelectedIds(new Set(contacts.map(c => c.id)));
                          else setSelectedIds(new Set());
                        }}
                        checked={selectedIds.size > 0 && selectedIds.size === contacts.length}
                        className="accent-neutral-500 w-4 h-4" 
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Business</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {contacts.map(c => (
                    <tr key={c.id} className="hover:bg-neutral-800/30 cursor-pointer" onClick={() => toggleSelect(c.id)}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.has(c.id)} readOnly className="accent-neutral-500 w-4 h-4" />
                      </td>
                      <td className="px-4 py-3">{c.businessName}</td>
                      <td className="px-4 py-3">{c.phone}</td>
                    </tr>
                  ))}
                  {contacts.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-neutral-500">No new leads available.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <form onSubmit={handleStart} className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 sticky top-8">
            <h3 className="text-lg font-medium text-white mb-6">Campaign Settings</h3>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Campaign Name</label>
                <input required value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="e.g. Sept Followup" className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Timezone</label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white">
                  <option value="Europe/Oslo">Europe/Oslo</option>
                  <option value="Europe/Stockholm">Europe/Stockholm</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Europe/Paris">Europe/Paris</option>
                  <option value="America/New_York">America/New_York</option>
                  <option value={Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles"}>Current Local Timezone</option>
                  <option value="America/Chicago">America/Chicago</option>
                  <option value="America/Los_Angeles">America/Los_Angeles</option>
                  <option value="Australia/Sydney">Australia/Sydney</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Start Date</label>
                  <input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Start Time</label>
                  <input required type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Send Window Start</label>
                  <input required type="time" value={sendWindowStart} onChange={e => setSendWindowStart(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Send Window End</label>
                  <input required type="time" value={sendWindowEnd} onChange={e => setSendWindowEnd(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white" />
                </div>
              </div>

              <div>
                <label className="flex items-center space-x-2 text-sm text-neutral-300 mb-4 cursor-pointer">
                  <input type="checkbox" checked={hasEndDate} onChange={e => setHasEndDate(e.target.checked)} className="accent-neutral-500 w-4 h-4" />
                  <span>Set Hard Cutoff (End Date)</span>
                </label>
                {hasEndDate && (
                  <div className="grid grid-cols-2 gap-4 p-4 border border-neutral-800 bg-neutral-950/50 rounded-lg">
                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">End Date</label>
                      <input required type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">End Time</label>
                      <input required type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={starting || selectedIds.size === 0 || !campaignName.trim()}
              className="w-full bg-white hover:bg-neutral-200 text-black font-bold py-4 rounded-xl disabled:opacity-50 transition-colors"
            >
              {starting ? 'Creating...' : `Create Campaign (${selectedIds.size} recipients)`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
