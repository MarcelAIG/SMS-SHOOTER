import React, { useState } from 'react';
import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from '../../db/firebase';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

interface NewCampaignModalProps {
  onClose: () => void;
}

export default function NewCampaignModal({ onClose }: NewCampaignModalProps) {
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const campRef = doc(collection(db, 'campaigns'));
      await setDoc(campRef, {
        id: campRef.id,
        name: name.trim(),
        timezone,
        status: 'DRAFT',
        createdAt: Date.now(),
        scheduledStart: Date.now(),
        sendWindowStart: '09:00',
        sendWindowEnd: '17:00',
        endDate: null
      });
      onClose();
      navigate(`/campaign/${campRef.id}/leads`);
    } catch (error) {
      console.error(error);
      alert('Failed to create campaign');
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-white">New Campaign</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleCreate} className="p-6 space-y-6">
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Campaign Name</label>
            <input 
              required 
              autoFocus
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="e.g. Q4 Outreach" 
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Timezone</label>
            <select 
              value={timezone} 
              onChange={e => setTimezone(e.target.value)} 
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
            >
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
          <div className="flex justify-end space-x-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={creating || !name.trim()} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-white text-black hover:bg-neutral-200 disabled:opacity-50 transition-colors">
              {creating ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
