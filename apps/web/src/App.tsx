import { useEffect, useMemo, useState } from 'react';
import { Bell, Boxes, ChevronDown, Menu, Moon, Search, Sun, X, ArrowUpRight, ClipboardCheck, PackageCheck, ArrowLeftRight } from 'lucide-react';
import { modules, moduleGroups, moduleFromHash } from './modules';
import { Badge, Card, EmptyState, PageHeader, SectionTabs } from './components/ui';

type Theme = 'light' | 'dark';

function getInitialTheme(): Theme {
  try { return localStorage.getItem('gspace-theme') === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

function AppOverview() {
  const statistics = [
    { label: 'Total resources', value: '1,284', detail: 'Illustrative catalog', icon: Boxes, tone: 'blue' },
    { label: 'Active assignments', value: '164', detail: 'Currently in use', icon: ClipboardCheck, tone: 'mint' },
    { label: 'Pending requests', value: '12', detail: 'Awaiting decisions', icon: PackageCheck, tone: 'amber' },
    { label: 'In transfer', value: '8', detail: 'Across company branches', icon: ArrowLeftRight, tone: 'purple' }
  ];
  return <>
    <div className="stat-grid">{statistics.map(({ label, value, detail, icon: Icon, tone }) =>
      <Card className="stat-card" key={label}><div className="stat-card-heading"><span>{label}</span><div className={`stat-icon ${tone}`}><Icon size={20}/></div></div><strong>{value}</strong><small>{detail}</small></Card>
    )}</div>
    <div className="overview-grid">
      <Card className="overview-panel"><div className="panel-title"><h2>Resource distribution</h2><Badge tone="blue">Sample data</Badge></div><div className="distribution-list">{[
        ['Head Office', 76], ['Tbilisi Store 01', 62], ['Batumi Store 01', 45], ['Kutaisi Store 01', 28]
      ].map(([name, value]) => <div className="distribution-row" key={name}><div><strong>{name}</strong><span>{value}%</span></div><div className="distribution-track"><span style={{ width: `${value}%` }}/></div></div>)}</div></Card>
      <Card className="overview-panel"><div className="panel-title"><h2>Latest updates</h2><Badge>Preview</Badge></div><div className="activity-list"><div className="activity-item"><span className="activity-dot blue"/><div><strong>Assignment awaiting confirmation</strong><p>Handover preview · sample event</p></div><small>Today</small></div><div className="activity-item"><span className="activity-dot amber"/><div><strong>Resource request submitted</strong><p>Approval preview · sample event</p></div><small>Today</small></div><div className="activity-item"><span className="activity-dot green"/><div><strong>Inventory check completed</strong><p>Stock preview · sample event</p></div><small>Yesterday</small></div></div></Card>
    </div>
  </>;
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
      <div className="sidebar-search"><Search size={15}/><input aria-label="Filter navigation" placeholder="Find a module..." value={sidebarSearch} onChange={(event) => setSidebarSearch(event.target.value)}/>{sidebarSearch && <button aria-label="Clear navigation filter" onClick={() => setSidebarSearch('')}><X size={14}/></button>}</div>
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {moduleGroups.map(group => {
          const items = filteredModules.filter(item => item.group === group);
          if (!items.length) return null;
          return <div className="nav-group" key={group}><div className="nav-group-title">{group}</div>{items.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${current.id === id ? 'selected' : ''}`} aria-current={current.id === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={18}/><span>{label}</span></button>)}</div>;
        })}
        {!filteredModules.length && <p className="sidebar-no-results">No matching modules</p>}
      </nav>
      <div className="sidebar-note"><strong>Development preview</strong><p>UI shell with sample metrics. No production data is displayed.</p></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div className="breadcrumbs"><button className="mobile-menu icon-action" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={20}/></button><span>Workspace</span><span className="breadcrumb-chevron">›</span><strong>{current.label}</strong></div><div className="top-actions">
        <div className="global-search"><Search size={17}/><input aria-label="Search modules" placeholder="Search modules..." value={sidebarSearch} onFocus={() => setSearchOpen(true)} onChange={(event) => { setSidebarSearch(event.target.value); setSearchOpen(true); }}/>{searchOpen && sidebarSearch && <div className="search-results">{filteredModules.length ? filteredModules.map(({id,label,icon:Icon})=><button key={id} onClick={()=>navigate(id)}><Icon size={15}/>{label}<ArrowUpRight size={13}/></button>) : <span>No matching modules</span>}</div>}</div>
        <button className="icon-action" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}>{theme === 'dark' ? <Sun size={19}/> : <Moon size={19}/>}</button>
        <span className="header-divider"/>
        <button className="icon-action" aria-label="Notifications (not yet connected)" disabled title="Notifications will be added with the backend workflows"><Bell size={19}/></button>
        <div className="profile"><div className="profile-avatar">SP</div><div className="profile-text"><strong>Development</strong><small>Demo user</small></div><ChevronDown size={14} className="profile-chevron"/></div>
      </div></header>
      <main className="content"><PageHeader eyebrow={`${current.group} / RESOURCE MANAGEMENT`} title={current.label} description={current.description}/>
        {current.id === 'overview' ? <AppOverview/> : <ModulePage key={current.id} label={current.label}/>}
        <div className="preview-notice"><Badge tone="blue">Development build</Badge><span>Visual shell and sample metrics only. All business operations require future authenticated API integration.</span></div>
      </main>
    </div>
  </div>;
}
