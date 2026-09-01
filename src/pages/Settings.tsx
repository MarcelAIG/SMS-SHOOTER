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
          <h3 className="text-lg font-medium text-white border-b border-neutral-800 pb-2">Global Settings</h3>
          <p className="text-sm text-neutral-400 py-4">
            Campaign sequences and schedules have been moved. You can now configure messages, delays, and schedules individually for each campaign inside the Campaign Workspace.
          </p>
        </section>

        {/* Keeping the form submit button in case future global settings are added */}
        <button type="submit" disabled={saving} className="bg-neutral-100 hover:bg-white text-neutral-950 font-semibold px-8 py-3 rounded-lg disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
