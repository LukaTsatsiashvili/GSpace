import { useEffect, useMemo, useState } from 'react';
import { Bell, Boxes, Menu, Moon, Sun, ArrowUpRight } from 'lucide-react';
import { modules, moduleGroups, moduleFromHash } from './modules';
import { Badge, Card, EmptyState, PageHeader, SectionTabs, SearchInput } from './components/ui';
import OverviewPage from './pages/OverviewPage';
import ResourcesPage from './pages/ResourcesPage';
import AssignmentsPage from './pages/AssignmentsPage';
import ApprovalsPage from './pages/ApprovalsPage';
import TransfersPage from './pages/TransfersPage';
import InventoryPage from './pages/InventoryPage';
import LicensesPage from './pages/LicensesPage';
import MaintenancePage from './pages/MaintenancePage';
import FinancePage from './pages/FinancePage';
import ReportsPage from './pages/ReportsPage';
import AuditPage from './pages/AuditPage';
import AdministrationPage from './pages/AdministrationPage';
import AccountSecurityDialog from './pages/AccountSecurityDialog';
import { ToastProvider, ToastViewport, useToast } from './components/toast';
import { useAuth, canOpenModule } from './auth/AuthGate';
import { LogOut } from 'lucide-react';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  try { return localStorage.getItem('gspace-theme') === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

function ModulePage({ label }: { label: string }) {
  const [tab, setTab] = useState('Overview');
  return <Card className="module-panel"><SectionTabs tabs={['Overview', 'All records', 'Activity']} selected={tab} onChange={setTab}/><EmptyState title={`${label} · ${tab}`} description="The approved visual design will be connected to real data, business rules, permissions and API endpoints during module implementation." /></Card>;
}

function AppShell() {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [profileOpen, setProfileOpen] = useState(false);
  const [currentId, setCurrentId] = useState(() => moduleFromHash().id);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const permittedModules = useMemo(() => modules.filter(item => canOpenModule(item.id, user.role.permissions)), [user.role.permissions]);
  const current = permittedModules.find((item) => item.id === currentId) ?? permittedModules[0];
  const filteredModules = useMemo(() => permittedModules.filter((item) => item.label.toLowerCase().includes(sidebarSearch.trim().toLowerCase())), [permittedModules, sidebarSearch]);

  useEffect(() => {
    const update = () => setCurrentId(moduleFromHash().id);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  function navigate(id: string) {
    if (!permittedModules.some(item => item.id === id)) return;
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
        <button type="button" className="profile profile-action" aria-label="Open my profile and security" title="My profile and security" onClick={() => setProfileOpen(true)}><div className="profile-avatar">{user.fullName.trim().split(/\s+/).slice(0,2).map(n=>n[0]).join('').toUpperCase()}</div><div className="profile-text"><strong>{user.fullName}</strong><small>{user.role.name}</small></div></button>
        <button className="icon-action" aria-label="Sign out" title="Sign out" onClick={() => { void signOut().catch(() => toast.error('Could not sign out. Please try again.')); }}><LogOut size={19}/></button>
      </div></header>
      <main className="content">{current.id === 'overview' ? <OverviewPage navigate={navigate} firstName={user.fullName.trim().split(/\s+/)[0]}/> : current.id === 'resources' ? <ResourcesPage/> : current.id === 'assignments' ? <AssignmentsPage/> : current.id === 'approvals' ? <ApprovalsPage/> : current.id === 'transfers' ? <TransfersPage/> : current.id === 'inventory' ? <InventoryPage/> : current.id === 'licenses' ? <LicensesPage/> : current.id === 'maintenance' ? <MaintenancePage/> : current.id === 'finance' ? <FinancePage/> : current.id === 'reports' ? <ReportsPage/> : current.id === 'audit' ? <AuditPage/> : current.id === 'administration' ? <AdministrationPage/> : <>
        <PageHeader eyebrow={`${current.group} / RESOURCE MANAGEMENT`} title={current.label} description={current.description}/>
        <ModulePage key={current.id} label={current.label}/>
        <div className="preview-notice"><Badge tone="blue">Development build</Badge><span>Visual shell and sample metrics only. All business operations require future authenticated API integration.</span></div>
      </>}
      </main>
    </div>
    {profileOpen && <AccountSecurityDialog close={() => setProfileOpen(false)}/>}
    <ToastViewport/>
  </div>;
}

export default function App() {
  return <ToastProvider><AppShell/></ToastProvider>;
}
