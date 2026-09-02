import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Inbox as InboxIcon, KanbanSquare, Megaphone, Settings as SettingsIcon, MessageSquare } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './db/firebase';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Inbox from './pages/Inbox';
import Pipeline from './pages/Pipeline';
import CampaignList from './pages/campaigns/CampaignList';
import CampaignWorkspace from './pages/campaigns/CampaignWorkspace';
import TestSMS from './pages/TestSMS';

function NavItem({ to, icon: Icon, children, badge }: { to: string, icon: any, children: React.ReactNode, badge?: number }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-white'}`}>
      <div className="flex items-center space-x-3">
        <Icon className="w-5 h-5" />
        <span className="font-medium">{children}</span>
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="bg-[#ff3b30] text-white text-[11px] font-bold min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

export default function App() {
  const [fromNumber, setFromNumber] = useState('+1 650 487 1907');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        if (data.fromNumber) setFromNumber(data.fromNumber);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      where('direction', '==', 'INBOUND'),
      where('read', '==', false)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setUnreadCount(snap.size);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `(${unreadCount}) SMS Shooter`;
    } else {
      document.title = 'SMS Shooter';
    }
  }, [unreadCount]);

  return (
    <Router>
      <div className="h-screen bg-neutral-950 text-neutral-300 flex font-sans selection:bg-neutral-800">
        {/* Sidebar */}
        <div className="w-64 border-r border-neutral-800 bg-neutral-950 flex flex-col">
          <div className="p-6">
            <h1 className="text-xl font-bold text-white tracking-tight">SMS Shooter</h1>
            <p className="text-xs text-neutral-500 mt-1 font-mono">{fromNumber}</p>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            <NavItem to="/" icon={LayoutDashboard}>Dashboard</NavItem>
            <NavItem to="/inbox" icon={InboxIcon} badge={unreadCount}>Inbox</NavItem>
            <NavItem to="/pipeline" icon={KanbanSquare}>Pipeline</NavItem>
            <NavItem to="/contacts" icon={Users}>Contacts</NavItem>
            <NavItem to="/campaign" icon={Megaphone}>Campaign</NavItem>
            <NavItem to="/test-sms" icon={MessageSquare}>Test SMS</NavItem>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col bg-neutral-950">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inbox" element={<Inbox fromNumber={fromNumber} />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/campaign" element={<CampaignList />} />
            <Route path="/campaign/:id/*" element={<CampaignWorkspace />} />
            <Route path="/test-sms" element={<TestSMS fromNumber={fromNumber} />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
