import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../db/firebase';
import { Campaign } from '../../../types';
import { Save, Settings, ShieldAlert, Zap } from 'lucide-react';

interface CampaignOptionsProps {
  campaign: Campaign;
}

export default function CampaignOptions({ campaign }: CampaignOptionsProps) {
  const [sendIntervalMinutes, setSendIntervalMinutes] = useState(campaign.sendIntervalMinutes || 1);
  const [dailyLeadLimit, setDailyLeadLimit] = useState(campaign.dailyLeadLimit || 20);
  const [stopOnReply, setStopOnReply] = useState(campaign.stopOnReply !== false); // default true
  const [allowFollowUps, setAllowFollowUps] = useState(campaign.allowFollowUps !== false); // default true
  const [skipDuplicates, setSkipDuplicates] = useState(campaign.skipDuplicates !== false); // default true
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'campaigns', campaign.id), {
        sendIntervalMinutes: Math.max(1, sendIntervalMinutes),
        dailyLeadLimit: Math.max(1, dailyLeadLimit),
        stopOnReply,
        allowFollowUps,
        skipDuplicates
      });
      alert('Options saved');
    } catch (err) {
      console.error(err);
      alert('Failed to save options');
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ label, checked, onChange, desc }: any) => (
    <div className="flex items-start justify-between py-4 border-b border-neutral-800/50 last:border-0">
      <div>
        <h4 className="text-[13px] font-bold text-white mb-1">{label}</h4>
        <p className="text-xs text-neutral-500 max-w-sm">{desc}</p>
      </div>
      <button 
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${checked ? 'bg-white' : 'bg-neutral-800'}`}
      >
        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-neutral-900 shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSave} className="h-full overflow-y-auto max-w-3xl pb-16">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Campaign Options</h2>
          <p className="text-sm text-neutral-400">Configure advanced sending behaviors.</p>
        </div>
        <button 
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-neutral-200 transition-colors flex items-center disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Options'}
        </button>
      </div>

      <div className="space-y-8">
        
        {/* Sending Speeds */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center">
            <Zap className="w-5 h-5 text-neutral-500 mr-3" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sending Speed</h3>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[13px] font-bold text-white mb-1">Daily New Lead Limit</label>
                <p className="text-xs text-neutral-500 mb-3">Maximum initial messages per day.</p>
                <div className="relative">
                  <input 
                    type="number" 
                    min="1"
                    value={dailyLeadLimit} 
                    onChange={e => setDailyLeadLimit(Math.max(1, parseInt(e.target.value) || 1))} 
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-white/20" 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-500 uppercase">Msg/Day</span>
                </div>
                <p className="text-[10px] text-green-500/80 mt-2">Adjustable daily limit.</p>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-white mb-1">Send Interval</label>
                <p className="text-xs text-neutral-500 mb-3">Delay between queued messages.</p>
                <div className="relative">
                  <input 
                    type="number" 
                    min="1"
                    value={sendIntervalMinutes} 
                    onChange={e => setSendIntervalMinutes(Math.max(1, parseInt(e.target.value) || 1))} 
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-white/20" 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-500 uppercase">Minutes</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Behavior */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center">
            <ShieldAlert className="w-5 h-5 text-neutral-500 mr-3" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Behavior</h3>
          </div>
          
          <div className="px-6 py-2">
            <Toggle 
              label="Stop Sequence on Reply" 
              desc="Automatically cancel remaining follow-ups if the lead replies to any message."
              checked={stopOnReply} 
              onChange={setStopOnReply} 
            />
            <Toggle 
              label="Allow Follow-ups" 
              desc="If disabled, this campaign will only send the initial SMS and ignore sequence steps."
              checked={allowFollowUps} 
              onChange={setAllowFollowUps} 
            />
            <Toggle 
              label="Skip Duplicate Numbers" 
              desc="Prevent adding phone numbers that already exist in this campaign."
              checked={skipDuplicates} 
              onChange={setSkipDuplicates} 
            />
          </div>
          
          <div className="p-6 bg-neutral-950/30 border-t border-neutral-800">
            <h4 className="text-[13px] font-bold text-white mb-3 uppercase tracking-wider">Stop Follow-ups when lead becomes:</h4>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center space-x-3">
                <input type="checkbox" checked readOnly className="accent-neutral-600 w-4 h-4 rounded border-neutral-700 bg-neutral-800 cursor-not-allowed opacity-50" />
                <span className="text-sm text-neutral-300">Interested</span>
              </label>
              <label className="flex items-center space-x-3">
                <input type="checkbox" checked readOnly className="accent-neutral-600 w-4 h-4 rounded border-neutral-700 bg-neutral-800 cursor-not-allowed opacity-50" />
                <span className="text-sm text-neutral-300">Not Interested</span>
              </label>
              <label className="flex items-center space-x-3">
                <input type="checkbox" checked readOnly className="accent-neutral-600 w-4 h-4 rounded border-neutral-700 bg-neutral-800 cursor-not-allowed opacity-50" />
                <span className="text-sm text-neutral-300">Call Booked</span>
              </label>
            </div>
            <p className="text-xs text-neutral-500 mt-4">
              These statuses automatically halt sequences globally based on backend rules.
            </p>
          </div>
        </section>

      </div>
    </form>
  );
}
