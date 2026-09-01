import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../db/firebase';
import { Contact } from '../types';
import { getBadgeColors } from '../utils/statusColors';

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState({ phone: '', businessName: '', firstName: '', notes: '' });

  useEffect(() => {
    const q = query(collection(db, 'contacts'), orderBy('dateAdded', 'desc'));
    return onSnapshot(q, snap => setContacts(snap.docs.map(d => d.data() as Contact)));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const normPhone = '+' + form.phone.replace(/\D/g, '');
    if (normPhone.length < 5) return alert('Invalid phone number');
    
    try {
      await setDoc(doc(db, 'contacts', normPhone), {
        id: normPhone,
        phone: normPhone,
        businessName: form.businessName || 'Unknown',
        firstName: form.firstName || '',
        notes: form.notes || '',
        status: 'INTERESTED',
        dateAdded: Date.now(),
        lastMessageAt: Date.now(),
        followUpStage: 0,
        nextFollowUpAt: null
      });
      setForm({ phone: '', businessName: '', firstName: '', notes: '' });
    } catch (err) {
      console.error(err);
      alert('Error adding contact');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete contact?')) {
      await deleteDoc(doc(db, 'contacts', id));
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-6">Contacts</h2>
      
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-8 flex-shrink-0">
        <h3 className="text-lg font-medium text-white mb-4">Add Contact</h3>
        <form onSubmit={handleAdd} className="flex gap-4 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-neutral-400">Phone</label>
            <input required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+1234567890" className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white" />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-neutral-400">Business Name</label>
            <input required value={form.businessName} onChange={e => setForm({...form, businessName: e.target.value})} placeholder="Acme Corp" className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white" />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-xs text-neutral-400">First Name</label>
            <input value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} placeholder="John" className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white" />
          </div>
          <button type="submit" className="bg-neutral-200 text-neutral-900 font-medium px-6 py-2 rounded-lg hover:bg-white h-[42px]">Add</button>
        </form>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-neutral-300">
            <thead className="text-xs uppercase bg-neutral-800/50 text-neutral-400">
              <tr>
                <th className="px-6 py-3 font-medium">Business</th>
                <th className="px-6 py-3 font-medium">Contact</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {contacts.map(c => (
                <tr key={c.id} className="hover:bg-neutral-800/30">
                  <td className="px-6 py-4">{c.businessName}</td>
                  <td className="px-6 py-4">{c.firstName || '-'}</td>
                  <td className="px-6 py-4">{c.phone}</td>
                  <td className="px-6 py-4"><span className={`text-xs font-medium px-2 py-1 rounded-md border ${getBadgeColors(c.status)}`}>{c.status}</span></td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleDelete(c.id)} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-neutral-500">No contacts found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
