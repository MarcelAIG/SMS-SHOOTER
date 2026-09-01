import React, { useState } from 'react';
import { X, Send } from 'lucide-react';

interface TestSMSModalProps {
  messageBody: string;
  onClose: () => void;
}

export default function TestSMSModal({ messageBody, onClose }: TestSMSModalProps) {
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !messageBody.trim()) return;
    
    setSending(true);
    setResult(null);

    let normPhone = phone.trim();
    if (!normPhone.startsWith('+')) {
      normPhone = '+' + normPhone.replace(/\D/g, '');
    }

    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: normPhone, body: messageBody })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult('success');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error(error);
      setResult('error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-white flex items-center">
            <Send className="w-4 h-4 mr-2" />
            Send Test SMS
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSend} className="p-6">
          <div className="mb-6">
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">Recipient Phone Number</label>
            <input 
              required 
              autoFocus
              value={phone} 
              onChange={e => setPhone(e.target.value)} 
              placeholder="+1234567890" 
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2.5 text-white font-mono focus:outline-none focus:ring-2 focus:ring-white/20 transition-all" 
            />
            <p className="text-[11px] text-neutral-500 mt-2">
              This will send the exact message immediately via Twilio API. It will not enroll the recipient in this campaign.
            </p>
          </div>
          
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 mb-6">
            <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide mb-1">Message Preview</p>
            <p className="text-sm text-neutral-300 whitespace-pre-wrap">{messageBody}</p>
          </div>

          {result === 'success' && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg font-medium text-center">
              Test message sent successfully!
            </div>
          )}
          {result === 'error' && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg font-medium text-center">
              Failed to send test message.
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={sending || !phone.trim()} className="px-5 py-2.5 rounded-lg text-sm font-bold bg-white text-black hover:bg-neutral-200 disabled:opacity-50 transition-colors flex items-center">
              {sending ? 'Sending...' : 'Send Test'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
