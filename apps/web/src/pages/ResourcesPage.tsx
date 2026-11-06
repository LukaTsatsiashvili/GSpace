import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine, Boxes, Check, ChevronDown, ClipboardList, Grid2X2, Wrench, Users, Box,
  List, Monitor, Package, Plus, Search, Smartphone,
  Laptop, Printer, Router, ArrowLeftRight, X, type LucideIcon
} from 'lucide-react';
import { Badge, Button, Card, PageHeader } from '../components/ui';
import './resources.css';

type Status = 'Available' | 'Assigned' | 'In maintenance' | 'Retired';
type View = 'list' | 'grid';
type Tab = 'Overview' | 'Assignments' | 'Maintenance' | 'Documents' | 'Audit timeline';
type Resource = {
  id: string; name: string; category: string; branch: string; status: Status;
  condition: string; assignee: string; location: string; serial: string; registered?: string; purchaseDate: string; icon: LucideIcon;
};

const resources: Resource[] = [
  { id: 'AST-00124', name: 'Lenovo ThinkPad T14', category: 'Laptop', branch: 'Head Office', location: 'IT Office · Floor 2', status: 'Assigned', condition: 'Excellent', assignee: 'Sandro Papiashvili', serial: 'PF-92L7Q', registered: 'Oct 18, 2026', purchaseDate: 'Aug 20, 2026', icon: Laptop },
  { id: 'AST-00123', name: 'Dell UltraSharp U2723QE', category: 'Monitor', branch: 'Tbilisi Store 01', location: 'Storage A', status: 'Available', condition: 'Good', assignee: '—', serial: 'CN-0MJ6GH', registered: 'Oct 16, 2026', purchaseDate: 'Sep 14, 2026', icon: Monitor },
  { id: 'AST-00122', name: 'Apple iPhone 15', category: 'Mobile Device', branch: 'Head Office', location: 'IT Office', status: 'Assigned', condition: 'Good', assignee: 'Giorgi Maisuradze', serial: 'APL-IP15-2291', purchaseDate: 'Nov 02, 2026', icon: Smartphone },
  { id: 'AST-00121', name: 'HP LaserJet Pro M404', category: 'Printer', branch: 'Batumi Store 01', location: 'Service Center', status: 'In maintenance', condition: 'Damaged', assignee: '—', serial: 'VNB5Q114', registered: 'Oct 08, 2026', purchaseDate: 'Jul 11, 2026', icon: Printer },
  { id: 'AST-00120', name: 'MacBook Air M3', category: 'Laptop', branch: 'Tbilisi Store 01', location: 'Manager Office', status: 'Assigned', condition: 'Excellent', assignee: 'Nino Kapanadze', serial: 'MBA-M3-2020', purchaseDate: 'Oct 10, 2026', icon: Laptop },
  { id: 'AST-00119', name: 'Samsung Galaxy Tab S9', category: 'Tablet', branch: 'Kutaisi Store 01', location: 'Storage B', status: 'Available', condition: 'Good', assignee: '—', serial: 'SG-TS9-1162', purchaseDate: 'Oct 08, 2026', icon: Smartphone },
  { id: 'AST-00118', name: 'Cisco Catalyst 9200', category: 'Network', branch: 'Head Office', location: 'Server Room', status: 'Available', condition: 'Fair', assignee: '—', serial: 'CSC-9200-4432', purchaseDate: 'May 05, 2026', icon: Router },
  { id: 'AST-00117', name: 'Epson TM-T88VII', category: 'POS Device', branch: 'Batumi Store 01', location: 'Archive', status: 'Retired', condition: 'Poor', assignee: '—', serial: 'EPS-88-0177', purchaseDate: 'Feb 11, 2026', icon: Package }
];

const statuses = ['All statuses', 'Available', 'Assigned', 'In maintenance', 'Retired'] as const;
const categories = ['All categories', ...Array.from(new Set(resources.map(resource => resource.category)))];
const branches = ['All branches', ...Array.from(new Set(resources.map(resource => resource.branch)))];

function SelectMenu({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="rs-select-wrap"><button className="rs-select" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}><span>{value}</span><ChevronDown size={15}/></button>
    {open && <><button className="rs-select-dismiss" aria-label="Close options" onClick={() => setOpen(false)}/><div className="rs-select-menu" role="listbox" aria-label={label}>{options.map(option => <button role="option" aria-selected={option === value} key={option} onClick={() => { onChange(option); setOpen(false); }}>{option}{option === value && <Check size={14}/>}</button>)}</div></>}
  </div>;
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`rs-status ${status.toLowerCase().replace(/\s+/g, '-')}`}><span/>{status === 'In maintenance' ? 'In Maintenance' : status}</span>;
}

function ResourceDrawer({ resource, close }: { resource: Resource; close: () => void }) {
  const [tab, setTab] = useState<Tab>('Overview');
  const [editInfo, setEditInfo] = useState(false);
  const Icon = resource.icon;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);
  return <div className="rs-overlay" onMouseDown={close}><aside className="rs-drawer" role="dialog" aria-modal="true" aria-labelledby="rs-drawer-title" onMouseDown={event => event.stopPropagation()}>
    <div className="rs-drawer-header"><div><h2 id="rs-drawer-title">Resource details</h2><p>Asset register / {resource.id}</p></div><button className="rs-close" aria-label="Close resource details" onClick={close}><X size={18}/></button></div>
    <div className="rs-drawer-identity"><div className="rs-detail-hero"><span className="rs-hero-icon"><Icon size={24}/></span><div><h3>{resource.name}</h3><span>{resource.id} · {resource.category}</span></div></div><StatusPill status={resource.status}/></div>
    <div className="rs-detail-tabs" role="tablist">{(['Overview', 'Assignments', 'Maintenance', 'Documents', 'Audit timeline'] as Tab[]).map(item => <button role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
    <div className="rs-drawer-content">{tab === 'Overview' ? <><div className="rs-detail-section"><h4>General information</h4><dl className="rs-detail-fields"><div><dt>Asset ID</dt><dd>{resource.id}</dd></div><div><dt>Serial number</dt><dd>{resource.serial}</dd></div><div><dt>Category</dt><dd>{resource.category}</dd></div><div><dt>Condition</dt><dd>{resource.condition}</dd></div><div><dt>Branch</dt><dd>{resource.branch}</dd></div><div><dt>Location</dt><dd>{resource.location}</dd></div><div><dt>Assigned to</dt><dd>{resource.assignee}</dd></div><div><dt>Registered</dt><dd>{resource.registered ?? 'Oct 18, 2026'}</dd></div></dl></div><div className="rs-lifecycle"><h4>Resource lifecycle</h4><ol><li><strong>Resource registered</strong><span>{resource.registered ?? 'Oct 18, 2026'} · System Administrator</span></li><li><strong>Condition reviewed</strong><span>{resource.condition} · Sample timeline event</span></li></ol></div></> : <div className="rs-tab-empty"><ClipboardList size={25}/><strong>{tab}</strong><p>This section will display real resource records when connected to the API.</p></div>}</div>
    <div className="rs-drawer-footer"><Button onClick={close}>Close</Button><Button variant="primary" onClick={() => setEditInfo(true)}>Edit resource</Button></div>
    {editInfo && <div className="rs-drawer-inline-overlay" onMouseDown={() => setEditInfo(false)}><div className="rs-edit-notice" role="alertdialog" aria-modal="true" aria-labelledby="rs-edit-notice-title" onMouseDown={event => event.stopPropagation()}><h3 id="rs-edit-notice-title">Edit resource</h3><p>Editing will be enabled after API integration. No sample data will be changed.</p><Button variant="primary" onClick={() => setEditInfo(false)}>Got it</Button></div></div>}
  </aside></div>;
}

function NewResourceDialog({ close }: { close: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Computers');
  const [branch, setBranch] = useState('Head Office');
  const [condition, setCondition] = useState('Good');
  const [serial, setSerial] = useState('');
  const [review, setReview] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);
  return <div className="rs-overlay rs-modal-overlay" onMouseDown={close}><div className="rs-modal" role="dialog" aria-modal="true" aria-labelledby="rs-create-title" onMouseDown={event => event.stopPropagation()}>
    <div className="rs-drawer-header"><div><span className="rs-eyebrow">NEW RESOURCE</span><h2 id="rs-create-title">{review ? 'Review resource' : 'Add company resource'}</h2><p>{review ? 'This is a preview and will not be saved.' : 'Record a company asset in the resource catalog.'}</p></div><button className="rs-close" aria-label="Close new resource" onClick={close}><X size={18}/></button></div>
    <div className="rs-form-body">{review ? <div className="rs-review"><Package size={32}/><h3>{name}</h3><p>{category} · {branch}</p><dl><div><dt>Condition</dt><dd>{condition}</dd></div><div><dt>Serial number</dt><dd>{serial || 'Not provided'}</dd></div></dl><div className="rs-hint">The real save action will be enabled when resource creation is connected to the API.</div></div> : <form id="rs-preview-form" onSubmit={event => { event.preventDefault(); if (name.trim()) setReview(true); }}><div className="rs-form-grid"><label className="rs-field rs-full">Resource name <span>*</span><input required maxLength={100} placeholder="e.g. Dell UltraSharp U2723QE" value={name} onChange={event => setName(event.target.value)}/></label><label className="rs-field rs-full">Serial number <input maxLength={100} placeholder="Enter serial number" value={serial} onChange={event => setSerial(event.target.value)}/></label><div className="rs-field">Category <SelectMenu label="Category" value={category} options={categories.filter(item => item !== 'All categories')} onChange={setCategory}/></div><div className="rs-field">Branch <SelectMenu label="Branch" value={branch} options={branches.filter(item => item !== 'All branches')} onChange={setBranch}/></div><div className="rs-field">Condition <SelectMenu label="Condition" value={condition} options={['Excellent', 'Good', 'Fair', 'Damaged']} onChange={setCondition}/></div></div><div className="rs-hint">This is a UI-only form. Submitting advances to a preview, not the database.</div></form>}</div>
    <div className="rs-drawer-footer"><span>Design preview</span><div className="rs-dialog-actions">{review && <Button onClick={() => setReview(false)}>Back</Button>}<Button variant="primary" onClick={review ? close : () => (document.getElementById('rs-preview-form') as HTMLFormElement | null)?.requestSubmit()}>{review ? 'Done' : 'Preview resource'}</Button></div></div>
  </div></div>;
}

export default function ResourcesPage() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('Available');
  const [status, setStatus] = useState<string>('All statuses');
  const [category, setCategory] = useState('All categories');
  const [branch, setBranch] = useState('All branches');
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<Resource | null>(null);
  const [adding, setAdding] = useState(false);
  const [exportInfo, setExportInfo] = useState(false);
  const [bulkInfo, setBulkInfo] = useState(false);
  const visible = useMemo(() => resources.filter(resource => {
    const term = search.trim().toLowerCase();
    return (activeTab === 'All assets' || activeTab === 'Asset register' || resource.status === activeTab || (activeTab === 'In Maintenance' && resource.status === 'In maintenance')) && (!term || [resource.name, resource.id, resource.serial, resource.assignee].some(value => value.toLowerCase().includes(term))) && (status === 'All statuses' || resource.status === status) && (category === 'All categories' || resource.category === category) && (branch === 'All branches' || resource.branch === branch);
  }), [search, status, category, branch, activeTab]);
  const clearFilters = () => { setSearch(''); setStatus('All statuses'); setCategory('All categories'); setBranch('All branches'); };

  return <div className="rs-page"><PageHeader eyebrow="ASSET MANAGEMENT / RESOURCE REGISTER" title="Resources" description="Track, organize and manage company resources across every branch." actions={<><Button icon={<ArrowDownToLine size={15}/>} onClick={() => setExportInfo(true)}>Export</Button><Button icon={<ClipboardList size={15}/>} onClick={() => setBulkInfo(true)}>Bulk create</Button><Button variant="primary" icon={<Plus size={16}/>} onClick={() => setAdding(true)}>Add resource</Button></>}/>
    <div className="rs-summary"><Card><span>Total assets</span><i className="rs-stat-icon rs-stat-blue"><Box size={19}/></i><strong>248</strong><small>Across 4 branches</small></Card><Card><span>Assigned</span><i className="rs-stat-icon rs-stat-green"><Users size={19}/></i><strong>164</strong><small><em>66%</em> of registered assets</small></Card><Card><span>Available</span><i className="rs-stat-icon rs-stat-purple"><Check size={19}/></i><strong>68</strong><small>Ready for assignment</small></Card><Card><span>In maintenance</span><i className="rs-stat-icon rs-stat-amber"><Wrench size={19}/></i><strong>9</strong><small>Require attention</small></Card></div>
    <Card className="rs-catalog"><div className="rs-catalog-tabs" role="tablist" aria-label="Resource categories">{['All assets','Assigned','Available','In Maintenance','Asset register'].map(tab => <button key={tab} role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'active' : ''} onClick={() => {setActiveTab(tab); clearFilters();}}>{tab}</button>)}</div>
      <div className="rs-toolbar"><div className="rs-search"><Search size={16}/><input aria-label="Search resources" placeholder="Search by name, ID or serial..." value={search} onChange={event => setSearch(event.target.value)}/></div><SelectMenu label="Filter status" value={status} options={statuses} onChange={setStatus}/><SelectMenu label="Filter branch" value={branch} options={branches} onChange={setBranch}/><SelectMenu label="Filter type" value={category === 'All categories' ? 'All types' : category} options={['All types', ...categories.slice(1)]} onChange={value => setCategory(value === 'All types' ? 'All categories' : value)}/><div className="rs-toolbar-spacer"/><button className="rs-reset" onClick={clearFilters}>Clear filters</button><button className="rs-view-toggle" onClick={() => setView(view === 'list' ? 'grid' : 'list')}>{view === 'list' ? <Grid2X2 size={16}/> : <List size={16}/>} {view === 'list' ? 'Cards' : 'List'}</button></div>
      {view === 'list' ? <div className="rs-table-scroll"><table className="rs-table"><thead><tr><th>RESOURCE / ID</th><th>CATEGORY</th><th>BRANCH / LOCATION</th><th>ASSIGNED TO</th><th>CONDITION</th><th>STATUS</th><th aria-label="Actions"/></tr></thead><tbody>{visible.map(resource => { const Icon = resource.icon; return <tr key={resource.id} tabIndex={0} role="button" aria-label={`Open ${resource.name} details`} onClick={() => setSelected(resource)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(resource); } }}><td><div className="rs-resource-cell"><span className="rs-thumb"><Icon size={20}/></span><div><strong>{resource.name}</strong><small>{resource.id}</small></div></div></td><td>{resource.category}</td><td><div className="rs-location-cell">{resource.branch}<small>{resource.location}</small></div></td><td>{resource.assignee}</td><td>{resource.condition}</td><td><StatusPill status={resource.status}/></td><td className="rs-row-action"><ArrowLeftRight size={17}/></td></tr>; })}</tbody></table></div> : <div className="rs-card-grid">{visible.map(resource => { const Icon = resource.icon; return <button className="rs-resource-card" key={resource.id} onClick={() => setSelected(resource)}><div className="rs-resource-card-head"><span className="rs-thumb"><Icon size={23}/></span><StatusPill status={resource.status}/></div><h3>{resource.name}</h3><span>{resource.id} · {resource.category}</span><div className="rs-resource-card-foot"><span>{resource.branch}</span><span>{resource.condition}</span></div></button>; })}</div>}
      {!visible.length && <div className="rs-empty"><Boxes size={28}/><h3>No resources found</h3><p>Try another search or remove some filters.</p><Button onClick={clearFilters}>Clear filters</Button></div>}
      <div className="rs-catalog-foot"><span><strong>{visible.length}</strong> sample records shown · 248 company-wide</span><span>Click any row to view asset details</span></div></Card>
    <p className="rs-preview-note"><Badge tone="blue">UI preview</Badge> Resource records and actions are illustrative. Database writes are not enabled.</p>
    {selected && <ResourceDrawer resource={selected} close={() => setSelected(null)}/>}{adding && <NewResourceDialog close={() => setAdding(false)}/>}
    {exportInfo && <div className="rs-overlay rs-modal-overlay" onMouseDown={() => setExportInfo(false)}><div className="rs-export-dialog" role="dialog" aria-modal="true" aria-labelledby="rs-export-title" onMouseDown={event => event.stopPropagation()}><button className="rs-close" aria-label="Close export information" onClick={() => setExportInfo(false)}><X size={18}/></button><span className="rs-export-icon"><ArrowDownToLine size={24}/></span><h2 id="rs-export-title">Export report</h2><p>Report exports will be available when the resource catalog is connected to the API. This preview uses illustrative records only.</p><Button variant="primary" onClick={() => setExportInfo(false)}>Got it</Button></div></div>}
    {bulkInfo && <div className="rs-overlay rs-modal-overlay" onMouseDown={() => setBulkInfo(false)}><div className="rs-export-dialog" role="dialog" aria-modal="true" aria-labelledby="rs-bulk-title" onMouseDown={event => event.stopPropagation()}><button className="rs-close" aria-label="Close bulk create information" onClick={() => setBulkInfo(false)}><X size={18}/></button><span className="rs-export-icon"><ClipboardList size={24}/></span><h2 id="rs-bulk-title">Bulk create</h2><p>Bulk resource import will be available after API integration. No sample records are saved.</p><Button variant="primary" onClick={() => setBulkInfo(false)}>Got it</Button></div></div>}
  </div>;
}
