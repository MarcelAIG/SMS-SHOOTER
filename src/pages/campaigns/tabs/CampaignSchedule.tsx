import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../db/firebase';
import { Campaign } from '../../../types';
import { DateTime } from 'luxon';
import { Save, Calendar, Clock, Globe } from 'lucide-react';

interface CampaignScheduleProps {
  campaign: Campaign;
}

export default function CampaignSchedule({ campaign }: CampaignScheduleProps) {
  const [timezone, setTimezone] = useState(campaign.timezone);
  
  const [startDate, setStartDate] = useState(
    DateTime.fromMillis(campaign.scheduledStart).setZone(campaign.timezone).toFormat('yyyy-MM-dd')
  );
  const [startTime, setStartTime] = useState(
    DateTime.fromMillis(campaign.scheduledStart).setZone(campaign.timezone).toFormat('HH:mm')
  );

  const [hasEndDate, setHasEndDate] = useState(campaign.endDate !== null);
  const [endDate, setEndDate] = useState(
    campaign.endDate ? DateTime.fromMillis(campaign.endDate).setZone(campaign.timezone).toFormat('yyyy-MM-dd') : ''
  );
  const [endTime, setEndTime] = useState(
    campaign.endDate ? DateTime.fromMillis(campaign.endDate).setZone(campaign.timezone).toFormat('HH:mm') : '17:00'
  );

  const [sendWindowStart, setSendWindowStart] = useState(campaign.sendWindowStart);
  const [sendWindowEnd, setSendWindowEnd] = useState(campaign.sendWindowEnd);
  
  const [activeDays, setActiveDays] = useState<string[]>(
    campaign.activeDays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  );

  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const startDt = DateTime.fromFormat(`${startDate} ${startTime}`, 'yyyy-MM-dd HH:mm', { zone: timezone });
      let endTimestamp = null;
      if (hasEndDate && endDate && endTime) {
        const endDt = DateTime.fromFormat(`${endDate} ${endTime}`, 'yyyy-MM-dd HH:mm', { zone: timezone });
        endTimestamp = endDt.toMillis();
      }

      await updateDoc(doc(db, 'campaigns', campaign.id), {
        timezone,
        scheduledStart: startDt.toMillis(),
        sendWindowStart,
        sendWindowEnd,
        endDate: endTimestamp,
        activeDays
      });
      alert('Schedule saved');
    } catch (err) {
      console.error(err);
      alert('Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="h-full overflow-y-auto max-w-3xl pb-16">
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Campaign Schedule</h2>
          <p className="text-sm text-neutral-400">Configure when messages should be sent.</p>
        </div>
        <button 
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-neutral-200 transition-colors flex items-center disabled:opacity-50"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Schedule'}
        </button>
      </div>

      <div className="space-y-8">
        
        {/* Dates */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center">
            <Calendar className="w-5 h-5 text-neutral-500 mr-3" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Campaign Dates</h3>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Start Date</label>
                <input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Start Time</label>
                <input required type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-800">
              <label className="flex items-center space-x-3 text-sm text-neutral-300 mb-4 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${hasEndDate ? 'bg-white border-white' : 'bg-neutral-950 border-neutral-700 group-hover:border-neutral-500'}`}>
                  {hasEndDate && <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <input type="checkbox" className="sr-only" checked={hasEndDate} onChange={e => setHasEndDate(e.target.checked)} />
                <span className="font-medium select-none">Set Hard Cutoff (End Date)</span>
              </label>

              {hasEndDate && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-neutral-950 rounded-lg border border-neutral-800">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">End Date</label>
                    <input required type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">End Time</label>
                    <input required type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Sending Hours */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center">
            <Clock className="w-5 h-5 text-neutral-500 mr-3" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sending Hours</h3>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">From</label>
                <input required type="time" value={sendWindowStart} onChange={e => setSendWindowStart(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">To</label>
                <input required type="time" value={sendWindowEnd} onChange={e => setSendWindowEnd(e.target.value)} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20" />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2 flex items-center">
                <Globe className="w-3.5 h-3.5 mr-1.5" />
                Timezone
              </label>
              <select 
                value={timezone} 
                onChange={e => setTimezone(e.target.value)} 
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
              >
                <option value="Europe/Oslo">Europe/Oslo</option>
                <option value="Europe/Stockholm">Europe/Stockholm</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Australia/Sydney">Australia/Sydney</option>
              </select>
              <p className="text-[11px] text-neutral-500 mt-2">
                All sending windows and schedule dates will be evaluated in this timezone.
              </p>
            </div>
          </div>
        </section>
        
        {/* Active Days */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
            <div className="flex items-center">
              <Calendar className="w-5 h-5 text-neutral-500 mr-3" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Days</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-4">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                <label key={d} className="flex items-center space-x-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={activeDays.includes(d)} 
                    onChange={e => {
                      if (e.target.checked) {
                        setActiveDays([...activeDays, d]);
                      } else {
                        setActiveDays(activeDays.filter(day => day !== d));
                      }
                    }}
                    className="accent-white w-4 h-4 rounded border-neutral-700 bg-neutral-950 focus:ring-1 focus:ring-white/20 transition-all cursor-pointer" 
                  />
                  <span className={`text-sm transition-colors ${activeDays.includes(d) ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-400'}`}>
                    {d}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </section>

      </div>
    </form>
  );
}
