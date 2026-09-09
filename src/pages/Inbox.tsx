import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, where, doc, updateDoc, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../db/firebase';
import { Contact, Message } from '../types';
import { Send, Copy, Edit2, Check } from 'lucide-react';
import { getBadgeColors } from '../utils/statusColors';

export default function Inbox({ fromNumber }: { fromNumber: string }) {
  const [repliedContacts, setRepliedContacts] = useState<Contact[]>([]);
  const [unreadContacts, setUnreadContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const contacts = React.useMemo(() => {
    const all = [...repliedContacts];
    unreadContacts.forEach(uc => {
      if (!all.find(c => c.id === uc.id)) {
        all.push(uc);
      }
    });
    return all.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  }, [repliedContacts, unreadContacts]);

  useEffect(() => {
    const q = query(collection(db, 'contacts'), where('hasReplied', '==', true), orderBy('lastMessageAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRepliedContacts(snap.docs.map(d => d.data() as Contact));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const missingContactIds = Object.keys(unreadMap).filter(id => !repliedContacts.find(c => c.id === id));
    if (missingContactIds.length === 0) {
      setUnreadContacts([]);
      return;
    }
    const fetchMissing = async () => {
      const fetched: Contact[] = [];
      for (const id of missingContactIds) {
        try {
          const docSnap = await getDoc(doc(db, 'contacts', id));
          if (docSnap.exists()) {
            fetched.push(docSnap.data() as Contact);
            // Auto-heal the contact in the background
            updateDoc(doc(db, 'contacts', id), { hasReplied: true }).catch(() => {});
          }
        } catch (e) {
          console.error('Failed to fetch missing contact', e);
        }
      }
      setUnreadContacts(fetched);
    };
    fetchMissing();
  }, [unreadMap, repliedContacts]);

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

  const handleCopy = (msg: Message) => {
    navigator.clipboard.writeText(msg.body);
    setCopiedMsgId(msg.id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const startEdit = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditBody(msg.body);
  };

  const saveEdit = async (msgId: string) => {
    if (!editBody.trim()) {
      setEditingMsgId(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'messages', msgId), { body: editBody });
      setEditingMsgId(null);
    } catch (e) {
      console.error(e);
    }
  };

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
                const isEditing = editingMsgId === msg.id;
                
                return (
                  <div key={msg.id} className={`flex flex-col group ${isOut ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 max-w-[85%] ${isOut ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`px-4 py-2.5 rounded-2xl ${isOut ? 'bg-neutral-200 text-neutral-900 rounded-tr-sm' : 'bg-neutral-800 text-neutral-100 rounded-tl-sm'}`}>
                        {isEditing ? (
                          <div className="flex flex-col gap-2 min-w-[200px]">
                             <textarea 
                               className="w-full bg-white/60 text-black p-2 rounded text-sm resize-none focus:outline-none" 
                               value={editBody} 
                               onChange={e => setEditBody(e.target.value)} 
                               autoFocus
                             />
                             <div className="flex justify-end space-x-2">
                               <button onClick={() => setEditingMsgId(null)} className="text-[10px] uppercase font-bold text-neutral-500 hover:text-neutral-700">Cancel</button>
                               <button onClick={() => saveEdit(msg.id)} className="text-[10px] uppercase font-bold text-blue-600 hover:text-blue-800">Save</button>
                             </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-sm">{msg.body}</p>
                        )}
                      </div>
                      
                      {!isEditing && (
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {isOut && (
                             <button onClick={() => startEdit(msg)} className="p-1.5 bg-neutral-800 text-neutral-400 hover:text-white rounded-full shadow-sm" title="Edit">
                               <Edit2 className="w-3.5 h-3.5" />
                             </button>
                          )}
                          <button onClick={() => handleCopy(msg)} className="p-1.5 bg-neutral-800 text-neutral-400 hover:text-white rounded-full shadow-sm" title="Copy">
                             {copiedMsgId === msg.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      )}
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
