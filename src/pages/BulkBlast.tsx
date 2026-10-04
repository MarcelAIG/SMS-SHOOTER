import React, { useState, useEffect } from 'react';
import { Send, Search, Check, MessageSquare, History, Phone, Calendar, Trash2 } from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../db/firebase';
import { Contact } from '../types';
import { DateTime } from 'luxon';

export default function BulkBlast() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [quickReplyId, setQuickReplyId] = useState<string | null>(null);
  const [quickReplyMsg, setQuickReplyMsg] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Load Contacts - Removed orderBy in case index is missing or field doesn't exist
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'contacts')), (snap) => {
      const allContacts = snap.docs.map(d => ({ ...d.data(), id: d.id } as Contact));
      setContacts(allContacts.filter(c => !c.excludeFromBlast));
    });
    return () => unsub();
  }, []);

  // Load Recent Outbound Messages
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'messages'), where('direction', '==', 'OUTBOUND'), orderBy('createdAt', 'desc'), limit(50)), async (snap) => {
      const msgs = snap.docs.map(d => d.data());
      // Attach contact names
      for (const m of msgs) {
         const cdoc = await getDoc(doc(db, 'contacts', m.contactId));
         if (cdoc.exists()) {
             m.contactName = cdoc.data().firstName || cdoc.data().businessName || m.contactId;
         } else {
             m.contactName = m.contactId;
         }
      }
      setRecentMessages(msgs);
    });
    return () => unsub();
  }, []);

  const toggleContact = (id: string) => {
    const next = new Set(selectedContacts);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedContacts(next);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedContacts.size === 0 || !message) return;
    setSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/send-bulk-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactIds: Array.from(selectedContacts),
          message
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send SMS');
      }
      setResult({ success: true, sent: data.sent, failed: data.failed });
      setSelectedContacts(new Set());
      setMessage('');
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = async (contactId: string) => {
    if (!quickReplyMsg) return;
    setSendingReply(true);
    try {
        const res = await fetch('/api/send-bulk-direct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contactIds: [contactId],
              message: quickReplyMsg
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          setQuickReplyId(null);
          setQuickReplyMsg('');
    } catch (e: any) {
        alert('Failed to send follow up: ' + e.message);
    } finally {
        setSendingReply(false);
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'messages', id));
    } catch (e: any) {
      alert('Failed to delete message: ' + e.message);
    }
  };

  const deleteContact = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'contacts', id), { excludeFromBlast: true });
      // Remove from selected contacts if they were selected
      if (selectedContacts.has(id)) {
        const next = new Set(selectedContacts);
        next.delete(id);
        setSelectedContacts(next);
      }
    } catch (err: any) {
      alert('Failed to remove contact: ' + err.message);
    }
  };

  const filteredContacts = contacts.filter(c => 
    (c.firstName?.toLowerCase().includes(search.toLowerCase())) || 
    (c.businessName?.toLowerCase().includes(search.toLowerCase())) || 
    ((c.id || '').includes(search))
  );

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden bg-neutral-950">
      
      {/* LEFT COLUMN: THE BLASTER */}
      <div className="w-full lg:w-1/2 h-full flex flex-col border-r border-neutral-800">
        <div className="p-8 pb-4 shrink-0 border-b border-neutral-800">
          <h1 className="text-2xl font-bold text-white mb-2">Bulk Blast</h1>
          <p className="text-sm text-neutral-400">Select contacts and instantly blast them a custom message.</p>
        </div>

        <div className="p-8 flex-1 overflow-y-auto space-y-6">
            
            {/* Step 1: Select Contacts */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex flex-col h-[350px]">
                <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
                    <div>
                        <h3 className="text-white font-medium">1. Select Recipients</h3>
                        <p className="text-xs text-neutral-500 mt-0.5">{selectedContacts.size} Selected</p>
                    </div>
                    <div className="relative w-48">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                        <input 
                            placeholder="Search contacts..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-800 text-white text-[13px] rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/20"
                        />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {filteredContacts.map((c, index) => (
                        <div 
                            key={c.id} 
                            onClick={() => toggleContact(c.id)}
                            className={`flex items-center justify-between p-3 rounded-lg mb-1 cursor-pointer transition-colors group ${selectedContacts.has(c.id) ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-neutral-800 border border-transparent'}`}
                        >
                            <div>
                                <div className="text-[13px] font-medium text-white">{index + 1}. {c.businessName || c.firstName || 'Unknown'}</div>
                                <div className="text-xs text-neutral-500 font-mono mt-0.5">{c.id}</div>
                            </div>
                            <div className="flex items-center space-x-3">
                                {selectedContacts.has(c.id) && <Check className="w-4 h-4 text-blue-400" />}
                                <button 
                                    onClick={(e) => deleteContact(e, c.id)} 
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-500 hover:text-orange-400 hover:bg-neutral-900 transition-all rounded-md"
                                    title="Remove from Blast List"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredContacts.length === 0 && (
                        <div className="text-center text-neutral-500 text-sm mt-8">
                          No contacts found. Go to the <strong>Contacts</strong> page on the left menu to add some!
                        </div>
                    )}
                </div>
            </div>

            {/* Step 2: Message */}
            <form onSubmit={handleSend} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm space-y-4">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-white font-medium">2. Compose Message</h3>
                        <span className="text-[11px] text-neutral-500">Variables: {'{{firstName}}'}, {'{{businessName}}'}</span>
                    </div>
                    <textarea
                        rows={5}
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 text-white text-[13px] rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
                        placeholder="Hey {{firstName}}, this is a manual blast..."
                        required
                    />
                    <div className="text-[11px] text-neutral-500 mt-1 text-right">
                        {message.length} characters ({(Math.ceil((message.length || 1) / 160))} SMS segment)
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={sending || selectedContacts.size === 0 || !message}
                    className="w-full bg-white text-black font-bold px-4 py-3 rounded-lg flex items-center justify-center space-x-2 disabled:opacity-50 hover:bg-neutral-200 transition-colors"
                >
                    <span>{sending ? 'Sending Blast...' : `SEND TO ${selectedContacts.size} CONTACTS`}</span>
                    {!sending && <Send className="w-4 h-4" />}
                </button>

                {result && (
                    <div className={`mt-4 border rounded-lg p-3 text-sm ${result.success ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                        {result.success ? `Successfully sent to ${result.sent}. Failed: ${result.failed}` : `Error: ${result.error}`}
                    </div>
                )}
            </form>
        </div>
      </div>

      {/* RIGHT COLUMN: RECENT SENDS & FOLLOW UP */}
      <div className="w-full lg:w-1/2 h-full flex flex-col bg-neutral-950/50">
        <div className="p-8 pb-4 shrink-0 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
              <History className="w-5 h-5 text-neutral-400" />
              <h2 className="text-xl font-bold text-white">Recent Sends</h2>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 pt-6">
            <div className="space-y-4">
                {recentMessages.length === 0 ? (
                    <div className="text-center text-neutral-500 py-12">No recent messages sent.</div>
                ) : (
                    recentMessages.map((msg, i) => (
                        <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 group">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <div className="text-sm font-bold text-white flex items-center space-x-2">
                                        <span>{msg.contactName}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${['sent', 'delivered', 'SENT', 'DELIVERED'].includes(msg.status) ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                                            {msg.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="text-xs text-neutral-500 font-mono mt-0.5 flex items-center">
                                        <Phone className="w-3 h-3 mr-1" />
                                        {msg.contactId}
                                    </div>
                                </div>
                                <div className="text-[11px] text-neutral-500 flex items-center space-x-3">
                                    <span className="flex items-center">
                                      <Calendar className="w-3 h-3 mr-1" />
                                      {DateTime.fromMillis(msg.createdAt).toFormat('MMM d, HH:mm')}
                                    </span>
                                    <button onClick={() => deleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-red-400 transition-all rounded">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="bg-neutral-950 rounded-lg p-3 text-[13px] text-neutral-300 border border-neutral-800/50 mb-3">
                                {msg.body}
                            </div>

                            {quickReplyId === msg.id ? (
                                <div className="mt-3 flex space-x-2">
                                    <input 
                                        autoFocus
                                        value={quickReplyMsg}
                                        onChange={e => setQuickReplyMsg(e.target.value)}
                                        placeholder="Type follow up message..."
                                        className="flex-1 bg-neutral-950 border border-neutral-700 text-white text-[13px] rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-white/20"
                                    />
                                    <button 
                                        disabled={sendingReply || !quickReplyMsg}
                                        onClick={() => handleQuickReply(msg.contactId)}
                                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Send
                                    </button>
                                    <button 
                                        onClick={() => { setQuickReplyId(null); setQuickReplyMsg(''); }}
                                        className="px-3 text-sm text-neutral-400 hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={() => setQuickReplyId(msg.id)}
                                    className="flex items-center text-[12px] font-medium text-neutral-400 hover:text-white transition-colors"
                                >
                                    <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                                    Send Follow Up
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>

    </div>
  );
}
