import { useState } from 'react';
import { Activity, Boxes, ClipboardList, LayoutDashboard, Menu, Moon, ShieldCheck, Sun } from 'lucide-react';

const modules = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Resources', icon: Boxes },
  { name: 'Assignments', icon: ClipboardList },
  { name: 'Audit & Diagnostics', icon: Activity },
  { name: 'Administration', icon: ShieldCheck }
];

export default function App() {
  const [active, setActive] = useState('Overview');
  const [dark, setDark] = useState(() => localStorage.getItem('gspace-theme') !== 'light');
  const [navOpen, setNavOpen] = useState(false);
  function toggleTheme() {
    const next = !dark;
    localStorage.setItem('gspace-theme', next ? 'dark' : 'light');
    setDark(next);
  }
  return <div className={`app ${dark ? 'dark' : 'light'}`}>
    {navOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setNavOpen(false)} />}
    <aside className={`sidebar ${navOpen ? 'opened' : ''}`}>
      <div className="brand"><span className="brand-mark"><Boxes size={23}/></span><span><strong>GSpace</strong><small>ENTERPRISE HUB</small></span></div>
      <span className="nav-label">WORKSPACE</span>
      <nav aria-label="Primary navigation">{modules.map(({ name, icon: Icon }) =>
        <button key={name} className={`nav-item ${active === name ? 'selected' : ''}`} onClick={() => { setActive(name); setNavOpen(false); }}><Icon size={18}/><span>{name}</span></button>
      )}</nav>
      <div className="sidebar-note"><strong>Foundation build</strong><p>Technical starter · production business workflows will follow.</p></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div className="breadcrumbs"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setNavOpen(true)}><Menu size={19}/></button>Workspace <span>›</span> <strong>{active}</strong></div><div className="top-actions"><button className="icon-action" aria-label="Toggle theme" onClick={toggleTheme}>{dark ? <Sun size={19}/> : <Moon size={19}/>}</button><span className="profile">SP</span><div className="profile-caption"><strong>System setup</strong><small>Development mode</small></div></div></header>
      <main className="content"><p className="eyebrow">GSPACE / FOUNDATION</p><h1>{active} <span className="concept-tag">Technical preview</span></h1><p className="intro">The application shell is ready for the approved ResourceFlow interface and real API integration.</p>
        <div className="stats"><article className="stat"><span>Frontend</span><strong>React + Vite</strong><small>Shared design foundation</small></article><article className="stat"><span>Backend</span><strong>Express API</strong><small>Health endpoint ready</small></article><article className="stat"><span>Database</span><strong>PostgreSQL</strong><small>Prisma models drafted</small></article></div>
        <section className="panel"><div className="panel-head"><h2>{active} module</h2><span className="status">Planned integration</span></div><div className="panel-body"><div className="placeholder-icon"><Boxes size={28}/></div><h3>Foundation is in place</h3><p>This section will be implemented with real permissions, data and business rules in the next milestones.</p></div></section>
        <div className="notice"><ShieldCheck size={18}/><span>Concept data is not connected to production. The technical foundation is intentionally free of fake write actions.</span></div>
      </main>
    </div>
  </div>;
}
