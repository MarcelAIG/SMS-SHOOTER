import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../db/firebase';
import { CampaignSettings } from '../types';

export default function Settings() {
  const [settings, setSettings] = useState<CampaignSettings>({
    delaySeconds: 60,
    initialMessage: 'Hi!',
    followUp1Message: 'Following up!',
    followUp1Days: 2,
    followUp2Message: 'Last try!',
    followUp2Days: 3
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const d = await getDoc(doc(db, 'campaigns', 'settings'));
      if (d.exists()) {
        setSettings(d.data() as CampaignSettings);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'campaigns', 'settings'), settings);
      alert('Settings saved!');
    } catch (e) {
      console.error(e);
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto max-w-3xl">
      <h2 className="text-2xl font-bold text-white mb-6">Campaign Settings</h2>
      
      <form onSubmit={handleSave} className="space-y-8">
        <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-medium text-white border-b border-neutral-800 pb-2">Initial Outreach</h3>
          <div className="space-y-2">
            <label className="text-sm text-neutral-400">Queue Delay (Seconds)</label>
            <input type="number" value={settings.delaySeconds} onChange={e => setSettings({...settings, delaySeconds: parseInt(e.target.value)})} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-neutral-400">Message 1 (Day 0)</label>
            <textarea rows={4} value={settings.initialMessage} onChange={e => setSettings({...settings, initialMessage: e.target.value})} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-white" />
          </div>
        </section>

        <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-medium text-white border-b border-neutral-800 pb-2">Follow-up #1</h3>
          <div className="space-y-2">
            <label className="text-sm text-neutral-400">Delay (Days after initial)</label>
            <input type="number" value={settings.followUp1Days} onChange={e => setSettings({...settings, followUp1Days: parseInt(e.target.value)})} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-neutral-400">Message 2</label>
            <textarea rows={4} value={settings.followUp1Message} onChange={e => setSettings({...settings, followUp1Message: e.target.value})} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-white" />
          </div>
        </section>

        <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-medium text-white border-b border-neutral-800 pb-2">Follow-up #2</h3>
          <div className="space-y-2">
            <label className="text-sm text-neutral-400">Delay (Days after Follow-up 1)</label>
            <input type="number" value={settings.followUp2Days} onChange={e => setSettings({...settings, followUp2Days: parseInt(e.target.value)})} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-neutral-400">Message 3</label>
            <textarea rows={4} value={settings.followUp2Message} onChange={e => setSettings({...settings, followUp2Message: e.target.value})} className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-3 text-white" />
          </div>
        </section>

        <button type="submit" disabled={saving} className="bg-neutral-100 hover:bg-white text-neutral-950 font-semibold px-8 py-3 rounded-lg disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
