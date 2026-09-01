import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../db/firebase';
import { Campaign } from '../../../types';
import TestSMSModal from '../../../components/campaigns/TestSMSModal';
import { Save, Eye, MessageSquare, Plus, Clock } from 'lucide-react';

interface CampaignSequencesProps {
  campaign: Campaign;
}

export default function CampaignSequences({ campaign }: CampaignSequencesProps) {
  const [activeStep, setActiveStep] = useState(1);
  
  // Local state for editing before saving
  const [initialMessage, setInitialMessage] = useState(campaign.initialMessage || '');
  const [fu1Message, setFu1Message] = useState(campaign.followUp1Message || '');
  const [fu1DelayMinutes, setFu1DelayMinutes] = useState<number | string>(campaign.followUp1DelayMinutes ?? 0);
  const [fu2Message, setFu2Message] = useState(campaign.followUp2Message || '');
  const [fu2DelayMinutes, setFu2DelayMinutes] = useState<number | string>(campaign.followUp2DelayMinutes ?? 0);
  
  const [saving, setSaving] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);

  const getActiveMessage = () => {
    if (activeStep === 1) return initialMessage;
    if (activeStep === 2) return fu1Message;
    return fu2Message;
  };

  const setActiveMessage = (val: string) => {
    if (activeStep === 1) setInitialMessage(val);
    if (activeStep === 2) setFu1Message(val);
    if (activeStep === 3) setFu2Message(val);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'campaigns', campaign.id), {
        initialMessage,
        followUp1Message: fu1Message,
        followUp1DelayMinutes: isNaN(parseInt(fu1DelayMinutes as string)) ? 0 : parseInt(fu1DelayMinutes as string),
        followUp2Message: fu2Message,
        followUp2DelayMinutes: isNaN(parseInt(fu2DelayMinutes as string)) ? 0 : parseInt(fu2DelayMinutes as string)
      });
      // Optionally show a toast
    } catch (e) {
      console.error(e);
      alert('Failed to save sequences');
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    const current = getActiveMessage();
    setActiveMessage(current + variable);
  };

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8">
      {/* LEFT COLUMN: Steps */}
      <div className="space-y-4 overflow-y-auto pr-2 pb-8">
        
        {/* Step 1 */}
        <div 
          onClick={() => setActiveStep(1)}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeStep === 1 
              ? 'bg-neutral-800 border-white shadow-sm' 
              : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Step 1</h3>
            <span className="text-[10px] font-bold text-neutral-500 bg-neutral-950 px-2 py-1 rounded">INITIAL SMS</span>
          </div>
          <p className="text-xs text-neutral-400 line-clamp-2 mt-2 leading-relaxed">
            {initialMessage || 'No message set'}
          </p>
        </div>

        {/* Wait */}
        <div className="flex items-center justify-center py-2 relative">
          <div className="absolute top-0 bottom-0 w-px bg-neutral-800" />
          <div className="relative bg-neutral-950 border border-neutral-800 rounded-full px-4 py-1.5 flex items-center space-x-2 shadow-sm z-10">
            <Clock className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-xs font-medium text-neutral-400">Wait</span>
            <input 
              type="number" 
              min="0"
              value={fu1DelayMinutes} 
              onChange={e => setFu1DelayMinutes(e.target.value ? Math.max(0, parseInt(e.target.value) || 0) : '')}
              className="w-16 bg-neutral-900 border border-neutral-700 rounded text-center text-xs py-0.5 text-white focus:outline-none focus:ring-1 focus:ring-white/20" 
            />
            <span className="text-xs font-medium text-neutral-400">Minutes</span>
          </div>
        </div>

        {/* Step 2 */}
        <div 
          onClick={() => setActiveStep(2)}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeStep === 2 
              ? 'bg-neutral-800 border-white shadow-sm' 
              : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Step 2</h3>
            <span className="text-[10px] font-bold text-neutral-500 bg-neutral-950 px-2 py-1 rounded">FOLLOW-UP #1</span>
          </div>
          <p className="text-xs text-neutral-400 line-clamp-2 mt-2 leading-relaxed">
            {fu1Message || 'No message set'}
          </p>
        </div>

        {/* Wait */}
        <div className="flex items-center justify-center py-2 relative">
          <div className="absolute top-0 bottom-0 w-px bg-neutral-800" />
          <div className="relative bg-neutral-950 border border-neutral-800 rounded-full px-4 py-1.5 flex items-center space-x-2 shadow-sm z-10">
            <Clock className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-xs font-medium text-neutral-400">Wait</span>
            <input 
              type="number" 
              min="0"
              value={fu2DelayMinutes} 
              onChange={e => setFu2DelayMinutes(e.target.value ? Math.max(0, parseInt(e.target.value) || 0) : '')}
              className="w-16 bg-neutral-900 border border-neutral-700 rounded text-center text-xs py-0.5 text-white focus:outline-none focus:ring-1 focus:ring-white/20" 
            />
            <span className="text-xs font-medium text-neutral-400">Minutes</span>
          </div>
        </div>

        {/* Step 3 */}
        <div 
          onClick={() => setActiveStep(3)}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeStep === 3 
              ? 'bg-neutral-800 border-white shadow-sm' 
              : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Step 3</h3>
            <span className="text-[10px] font-bold text-neutral-500 bg-neutral-950 px-2 py-1 rounded">FOLLOW-UP #2</span>
          </div>
          <p className="text-xs text-neutral-400 line-clamp-2 mt-2 leading-relaxed">
            {fu2Message || 'No message set'}
          </p>
        </div>

      </div>

      {/* RIGHT COLUMN: Editor */}
      <div className="flex flex-col h-full bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">
              Step {activeStep}: {activeStep === 1 ? 'Initial SMS' : `Follow-up #${activeStep - 1}`}
            </h2>
            <p className="text-xs text-neutral-400">Configure the message for this sequence step.</p>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setShowTestModal(true)}
              className="px-3 py-2 bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs font-medium rounded-lg hover:bg-neutral-800 transition-colors flex items-center"
            >
              <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
              Test
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-white text-black text-xs font-bold rounded-lg hover:bg-neutral-200 transition-colors flex items-center disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {saving ? 'Saving...' : 'Save All'}
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 flex flex-col">
          <div className="flex items-center space-x-2 mb-3">
            <select 
              onChange={e => {
                if (e.target.value) {
                  insertVariable(e.target.value);
                  e.target.value = '';
                }
              }}
              className="text-xs bg-neutral-950 border border-neutral-800 text-neutral-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-white/20"
            >
              <option value="">+ Insert Variable</option>
              <option value="{{firstName}}">First Name</option>
              <option value="{{businessName}}">Business Name</option>
            </select>
          </div>
          
          <textarea
            value={getActiveMessage()}
            onChange={e => setActiveMessage(e.target.value)}
            className="flex-1 w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-shadow resize-none font-sans"
            placeholder="Type your message here..."
          />

          <div className="mt-4 flex items-center justify-between text-xs text-neutral-500 font-mono">
            <div>
              Characters: <span className="text-white">{getActiveMessage().length}</span>
            </div>
            <div>
              Segments: <span className="text-white">{Math.ceil(getActiveMessage().length / 160) || 1}</span>
            </div>
          </div>
        </div>

      </div>

      {showTestModal && (
        <TestSMSModal 
          messageBody={getActiveMessage()} 
          onClose={() => setShowTestModal(false)} 
        />
      )}
    </div>
  );
}
