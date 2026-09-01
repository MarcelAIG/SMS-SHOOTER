import React, { useState } from 'react';
import { Send } from 'lucide-react';

export default function TestSMS({ fromNumber }: { fromNumber: string }) {
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to || !message) return;
    setSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, body: message })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send SMS');
      }
      setResult({ success: true, data });
      setTo('');
      setMessage('');
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-8 h-full flex flex-col items-center overflow-y-auto">
      <div className="w-full max-w-xl">
        <h2 className="text-2xl font-bold text-white mb-6">Test SMS</h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-sm mb-8">
          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">From</label>
              <input
                type="text"
                readOnly
                value={fromNumber}
                className="w-full bg-neutral-950 border border-neutral-800 text-neutral-500 rounded-lg px-4 py-3 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">To</label>
              <input
                type="text"
                placeholder="+1234567890"
                value={to}
                onChange={e => setTo(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-neutral-600"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-1">Message</label>
              <textarea
                rows={4}
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-neutral-600 resize-none"
                placeholder="Type your test message..."
                required
              />
            </div>
            <button
              type="submit"
              disabled={sending || !to || !message}
              className="w-full bg-white text-neutral-950 font-semibold px-4 py-3 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 hover:bg-neutral-200 transition-colors"
            >
              <span>{sending ? 'Sending...' : 'SEND TEST SMS'}</span>
              {!sending && <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>

        {result && (
          <div className={`border rounded-xl p-6 ${result.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <h3 className={`text-lg font-medium mb-4 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
              {result.success ? 'Message Sent Successfully' : 'Failed to Send'}
            </h3>
            {result.success ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2 border-b border-green-500/10 pb-2">
                  <span className="text-neutral-400">From</span>
                  <span className="col-span-2 text-neutral-200">{result.data.from}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 border-b border-green-500/10 pb-2">
                  <span className="text-neutral-400">To</span>
                  <span className="col-span-2 text-neutral-200">{result.data.to}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 border-b border-green-500/10 pb-2">
                  <span className="text-neutral-400">Message SID</span>
                  <span className="col-span-2 text-neutral-200 font-mono text-xs">{result.data.twilioSid}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 border-b border-green-500/10 pb-2">
                  <span className="text-neutral-400">Status</span>
                  <span className="col-span-2 text-neutral-200 capitalize">{result.data.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <span className="text-neutral-400">Error</span>
                  <span className="col-span-2 text-neutral-200">{result.data.errorMessage || 'None'}</span>
                </div>
              </div>
            ) : (
              <p className="text-red-300 text-sm">{result.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
