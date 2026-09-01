import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, where, doc, updateDoc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../db/firebase';
import { Contact, Message } from '../types';
import { Send } from 'lucide-react';
import { getBadgeColors } from '../utils/statusColors';

export default function Inbox({ fromNumber }: { fromNumber: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'contacts'), orderBy('lastMessageAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setContacts(snap.docs.map(d => d.data() as Contact));
    });
    return unsub;
  }, []);

  // Global unread listener for sidebar badges
  useEffect(() => {
    const q = query(collection(db, 'messages'), where('direction', '==', 'INBOUND'), where('read', '==', false));
    const unsub = onSnapshot(q, (snap) => {
      const counts: Record<string, number> = {};
      snap.docs.forEach(d => {
        const msg = d.data() as Message;
        counts[msg.contactId] = (counts[msg.contactId] || 0) + 1;
      });
      setUnreadMap(counts);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!selectedContact) {
      setMessages([]);
      return;
    }

    const q = query(collection(db, 'messages'), where('contactId', '==', selectedContact.id), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, async (snap) => {
      setMessages(snap.docs.map(d => d.data() as Message));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => {
      unsub();
    };
  }, [selectedContact]);

  const markConversationAsRead = async () => {
    if (!selectedContact) return;
    const q = query(collection(db, 'messages'), where('contactId', '==', selectedContact.id), where('direction', '==', 'INBOUND'), where('read', '==', false));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    await batch.commit();
  };

  const markConversationAsUnread = async () => {
    if (!selectedContact) return;
    const q = query(collection(db, 'messages'), where('contactId', '==', selectedContact.id), where('direction', '==', 'INBOUND'), where('read', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    // Mark only the most recent one as unread, or all of them. Usually just all of them for simplicity, or just the last one.
    // Let's mark all inbound for this conversation as unread to be safe.
    snap.docs.forEach(d => batch.update(d.ref, { read: false }));
    await batch.commit();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !selectedContact) return;
    setSending(true);
    
    try {
      await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: selectedContact.phone, body: draft })
      });
      setDraft('');
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectedContact) return;
    const newStatus = e.target.value;
    try {
      await updateDoc(doc(db, 'contacts', selectedContact.id), { status: newStatus });
      
      // If moved to a state that cancels followups, cancel them!
      if (['NOT INTERESTED', 'INTERESTED', 'CALL BOOKED'].includes(newStatus)) {
        await updateDoc(doc(db, 'contacts', selectedContact.id), { nextFollowUpAt: null });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left List */}
      <div className="w-80 border-r border-neutral-800 flex flex-col bg-neutral-900/30">
        <div className="p-4 border-b border-neutral-800">
          <h2 className="text-lg font-semibold text-white">Conversations</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {contacts.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedContact(c)}
              className={`w-full text-left p-4 border-b border-neutral-800/50 hover:bg-neutral-800 transition-colors ${selectedContact?.id === c.id ? 'bg-neutral-800' : ''}`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center space-x-2 truncate">
                  <span className="font-medium text-neutral-200 truncate">{c.businessName || c.phone}</span>
                  {unreadMap[c.id] > 0 && (
                    <span className="bg-[#ff3b30] text-white text-[11px] font-bold min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full flex-shrink-0">
                      {unreadMap[c.id] > 99 ? '99+' : unreadMap[c.id]}
                    </span>
                  )}
                </div>
                <span className="text-xs text-neutral-500 whitespace-nowrap ml-2 flex-shrink-0">
                  {new Date(c.lastMessageAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-xs text-neutral-500 mb-2">{c.phone}</div>
              <div className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getBadgeColors(c.status)}`}>
                {c.status}
              </div>
            </button>
          ))}
          {contacts.length === 0 && <div className="p-6 text-center text-neutral-500 text-sm">No conversations yet</div>}
        </div>
      </div>

      {/* Right Chat Area */}
      <div className="flex-1 flex flex-col bg-neutral-950">
        {selectedContact ? (
          <>
            <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-white">{selectedContact.businessName || selectedContact.phone}</h3>
                <p className="text-sm text-neutral-400">{selectedContact.phone}</p>
              </div>
              <div className="flex items-center space-x-3">
                {unreadMap[selectedContact.id] > 0 ? (
                   <button onClick={markConversationAsRead} className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg transition-colors">Mark Read</button>
                ) : (
                   <button onClick={markConversationAsUnread} className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg transition-colors">Mark Unread</button>
                )}
                <select
                  value={selectedContact.status}
                  onChange={handleStatusChange}
                  className={`border text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-neutral-600 ${getBadgeColors(selectedContact.status)}`}
                >
                  <option className="bg-neutral-900 text-neutral-300" value="NOT INTERESTED">NOT INTERESTED</option>
                  <option className="bg-neutral-900 text-neutral-300" value="INTERESTED">INTERESTED</option>
                  <option className="bg-neutral-900 text-neutral-300" value="FOLLOW UP NEEDED">FOLLOW UP NEEDED</option>
                  <option className="bg-neutral-900 text-neutral-300" value="CALL BOOKED">CALL BOOKED</option>
                </select>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map(msg => {
                const isOut = msg.direction === 'OUTBOUND';
                return (
                  <div key={msg.id} className={`flex flex-col ${isOut ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${isOut ? 'bg-neutral-200 text-neutral-900 rounded-tr-sm' : 'bg-neutral-800 text-neutral-100 rounded-tl-sm'}`}>
                      <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                    </div>
                    <div className="text-[10px] text-neutral-500 mt-1 flex items-center space-x-2">
                      <span>{new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      {isOut && <span className="capitalize">{msg.status}</span>}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-neutral-800 bg-neutral-900/30">
              <form onSubmit={handleSend} className="flex space-x-4">
                <textarea
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-neutral-600 resize-none h-12 min-h-[48px] max-h-32"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="bg-neutral-100 hover:bg-white text-neutral-950 p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end flex-shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-500">
            Select a conversation to start messaging
          </div>
        )}
      </div>
    </div>
  );
}
