import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../db/firebase';
import { Contact } from '../types';
import { Trash2 } from 'lucide-react';

import { getColumnColors } from '../utils/statusColors';

const COLUMNS = ['NOT INTERESTED', 'INTERESTED', 'FOLLOW UP NEEDED', 'CALL BOOKED'] as const;

export default function Pipeline() {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'contacts'));
    return onSnapshot(q, snap => {
      setContacts(snap.docs.map(d => d.data() as Contact));
    });
  }, []);

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    
    // Optimistic update
    setContacts(prev => prev.map(c => c.id === draggableId ? { ...c, status: newStatus } : c));
    
    // Db update
    try {
      await updateDoc(doc(db, 'contacts', draggableId), { status: newStatus });
      
      // If moved to a state that cancels followups, backend or future edits will handle it.
      if (['NOT INTERESTED', 'INTERESTED', 'CALL BOOKED'].includes(newStatus)) {
        await updateDoc(doc(db, 'contacts', draggableId), { nextFollowUpAt: null });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-6">Pipeline</h2>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex-1 grid grid-cols-4 gap-4 pb-4 overflow-hidden">
          {COLUMNS.map(col => {
            const colContacts = contacts.filter(c => c.status === col).sort((a,b) => b.lastMessageAt - a.lastMessageAt);
            return (
              <div key={col} className={`flex flex-col bg-neutral-900 rounded-xl border border-neutral-800 border-t-[3px] ${getColumnColors(col)} overflow-hidden`}>
                <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
                  <h3 className="font-semibold text-neutral-200">{col}</h3>
                  <span className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full">{colContacts.length}</span>
                </div>
                <Droppable droppableId={col}>
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[150px]">
                      {colContacts.map((c, index) => (
                        // @ts-expect-error - key is a valid React prop
                        <Draggable key={c.id} draggableId={c.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="bg-neutral-950 border border-neutral-700 p-4 rounded-lg shadow-sm hover:border-neutral-500 transition-colors"
                            >
                              <div className="flex justify-between items-start mb-1">
                                <div className="font-medium text-white text-sm truncate pr-2">{c.businessName || c.phone}</div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('Are you sure you want to remove this lead?')) {
                                      deleteDoc(doc(db, 'contacts', c.id)).catch(console.error);
                                    }
                                  }}
                                  className="text-neutral-500 hover:text-red-400 hover:bg-red-400/10 p-1 rounded transition-colors flex-shrink-0"
                                  title="Remove Lead"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="text-xs text-neutral-400">{c.phone}</div>
                              <div className="text-[10px] text-neutral-500 mt-2">
                                Updated {new Date(c.lastMessageAt).toLocaleDateString()}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
