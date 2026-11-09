import { useEffect, useMemo, useState } from 'react';
import { Bell, Boxes, ChevronDown, Menu, Moon, Sun, ArrowUpRight } from 'lucide-react';
import { modules, moduleGroups, moduleFromHash } from './modules';
import { Badge, Card, EmptyState, PageHeader, SectionTabs, SearchInput } from './components/ui';
import OverviewPage from './pages/OverviewPage';
import ResourcesPage from './pages/ResourcesPage';
import AssignmentsPage from './pages/AssignmentsPage';
import ApprovalsPage from './pages/ApprovalsPage';
import TransfersPage from './pages/TransfersPage';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  try { return localStorage.getItem('gspace-theme') === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

function ModulePage({ label }: { label: string }) {
  const [tab, setTab] = useState('Overview');
  return <Card className="module-panel"><SectionTabs tabs={['Overview', 'All records', 'Activity']} selected={tab} onChange={setTab}/><EmptyState title={`${label} · ${tab}`} description="The approved visual design will be connected to real data, business rules, permissions and API endpoints during module implementation." /></Card>;
}

export default function App() {
  const [currentId, setCurrentId] = useState(() => moduleFromHash().id);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const current = modules.find((item) => item.id === currentId) ?? modules[0];
  const filteredModules = useMemo(() => modules.filter((item) => item.label.toLowerCase().includes(sidebarSearch.trim().toLowerCase())), [sidebarSearch]);

  useEffect(() => {
    const update = () => setCurrentId(moduleFromHash().id);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  function navigate(id: string) {
    window.location.hash = id;
    setCurrentId(id);
    setMenuOpen(false);
    setSearchOpen(false);
  }
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('gspace-theme', next); } catch { /* storage may be disabled */ }
  }

  return <div className={`app ${theme}`}>
    {menuOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}
    <aside className={`sidebar ${menuOpen ? 'opened' : ''}`} aria-label="Application sidebar">
      <div className="brand"><div className="brand-mark"><Boxes size={22}/></div><div><strong>GSpace</strong><small>ENTERPRISE HUB</small></div></div>
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {moduleGroups.map(group => {
          const items = filteredModules.filter(item => item.group === group);
          if (!items.length) return null;
          return <div className="nav-group" key={group}><div className="nav-group-title">{group}</div>{items.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${current.id === id ? 'selected' : ''}`} aria-current={current.id === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={18}/><span>{label}</span></button>)}</div>;
        })}
        {!filteredModules.length && <p className="sidebar-no-results">No matching modules</p>}
      </nav>
      <div className="sidebar-note"><strong>Design prototype</strong><p>This is a visual concept with sample data, not a connected production system.</p></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div className="breadcrumbs"><button className="mobile-menu icon-action" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={20}/></button><span>Workspace</span><span className="breadcrumb-chevron">›</span><strong>{current.label}</strong></div><div className="top-actions">
        <div className="global-search"><SearchInput aria-label="Search modules" placeholder="Search modules..." value={sidebarSearch} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSidebarSearch(event.target.value); setSearchOpen(true); }}/>{searchOpen && sidebarSearch && <div className="search-results">{filteredModules.length ? filteredModules.map(({id,label,icon:Icon})=><button key={id} onClick={()=>navigate(id)}><Icon size={15}/>{label}<ArrowUpRight size={13}/></button>) : <span>No matching modules</span>}</div>}</div>
        <button className="icon-action" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}>{theme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}</button>
        <span className="header-divider"/>
        <button className="icon-action" aria-label="Notifications (not yet connected)" disabled title="Notifications will be added with the backend workflows"><Bell size={19}/></button>
        <div className="profile"><div className="profile-avatar">SP</div><div className="profile-text"><strong>Sandro P.</strong><small>System Administrator · demo</small></div><ChevronDown size={14} className="profile-chevron"/></div>
      </div></header>
      <main className="content">{current.id === 'overview' ? <OverviewPage navigate={navigate}/> : current.id === 'resources' ? <ResourcesPage/> : current.id === 'assignments' ? <AssignmentsPage/> : current.id === 'approvals' ? <ApprovalsPage/> : current.id === 'transfers' ? <TransfersPage/> : <>
        <PageHeader eyebrow={`${current.group} / RESOURCE MANAGEMENT`} title={current.label} description={current.description}/>
        <ModulePage key={current.id} label={current.label}/>
        <div className="preview-notice"><Badge tone="blue">Development build</Badge><span>Visual shell and sample metrics only. All business operations require future authenticated API integration.</span></div>
      </>}
      </main>
    </div>
  </div>;
}
