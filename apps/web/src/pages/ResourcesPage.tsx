import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine, Boxes, Check, ChevronDown, ClipboardList, Grid2X2,
  List, Monitor, Package, Plus, Search, SlidersHorizontal, Smartphone,
  Laptop, Printer, Router, Keyboard, X, type LucideIcon
} from 'lucide-react';
import { Badge, Button, Card, PageHeader } from '../components/ui';
import './resources.css';

type Status = 'Available' | 'Assigned' | 'In maintenance' | 'In transfer';
type View = 'list' | 'grid';
type Tab = 'Overview' | 'Assignment history' | 'Maintenance';
type Resource = {
  id: string; name: string; category: string; branch: string; status: Status;
  condition: string; assignee: string; serial: string; purchaseDate: string; icon: LucideIcon;
};

const resources: Resource[] = [
  { id: 'AST-00123', name: 'Dell UltraSharp U2723QE', category: 'Monitors', branch: 'Head Office', status: 'Assigned', condition: 'Good', assignee: 'Nino Kapanadze', serial: 'DELL-U27-8821', purchaseDate: 'Sep 14, 2026', icon: Monitor },
  { id: 'AST-00119', name: 'Samsung Galaxy Tab S9', category: 'Mobile devices', branch: 'Tbilisi Store 01', status: 'Available', condition: 'Good', assignee: '—', serial: 'SG-TS9-1162', purchaseDate: 'Oct 08, 2026', icon: Smartphone },
  { id: 'AST-00118', name: 'Lenovo ThinkPad T14', category: 'Computers', branch: 'Batumi Store 01', status: 'Assigned', condition: 'Excellent', assignee: 'Giorgi Maisuradze', serial: 'LEN-T14-2237', purchaseDate: 'Aug 20, 2026', icon: Laptop },
  { id: 'AST-00117', name: 'HP LaserJet Pro M404', category: 'Printers', branch: 'Kutaisi Store 01', status: 'In maintenance', condition: 'Fair', assignee: '—', serial: 'HP-M404-8894', purchaseDate: 'Jul 11, 2026', icon: Printer },
  { id: 'AST-00116', name: 'Cisco Catalyst 9200', category: 'Network equipment', branch: 'Head Office', status: 'Available', condition: 'Excellent', assignee: '—', serial: 'CSC-9200-4432', purchaseDate: 'May 05, 2026', icon: Router },
  { id: 'AST-00115', name: 'Apple iPhone 15', category: 'Mobile devices', branch: 'Tbilisi Store 01', status: 'Assigned', condition: 'Good', assignee: 'Mariam Beridze', serial: 'APL-IP15-2291', purchaseDate: 'Nov 02, 2026', icon: Smartphone },
  { id: 'AST-00114', name: 'Logitech MX Keys', category: 'Peripherals', branch: 'Head Office', status: 'In transfer', condition: 'Good', assignee: '—', serial: 'LOG-MXK-1017', purchaseDate: 'Mar 18, 2026', icon: Keyboard },
  { id: 'AST-00113', name: 'Dell Latitude 5440', category: 'Computers', branch: 'Kutaisi Store 01', status: 'Available', condition: 'Good', assignee: '—', serial: 'DELL-L54-5566', purchaseDate: 'Feb 11, 2026', icon: Laptop }
];

const statuses = ['All statuses', 'Available', 'Assigned', 'In maintenance', 'In transfer'] as const;
const categories = ['All categories', ...Array.from(new Set(resources.map(resource => resource.category)))];
const branches = ['All branches', ...Array.from(new Set(resources.map(resource => resource.branch)))];

function SelectMenu({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="rs-select-wrap"><button className="rs-select" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}><span>{value}</span><ChevronDown size={15}/></button>
    {open && <><button className="rs-select-dismiss" aria-label="Close options" onClick={() => setOpen(false)}/><div className="rs-select-menu" role="listbox" aria-label={label}>{options.map(option => <button role="option" aria-selected={option === value} key={option} onClick={() => { onChange(option); setOpen(false); }}>{option}{option === value && <Check size={14}/>}</button>)}</div></>}
  </div>;
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`rs-status ${status.toLowerCase().replace(/\s+/g, '-')}`}><span/>{status}</span>;
}

function ResourceDrawer({ resource, close }: { resource: Resource; close: () => void }) {
  const [tab, setTab] = useState<Tab>('Overview');
  const Icon = resource.icon;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);
  return <div className="rs-overlay" onMouseDown={close}><aside className="rs-drawer" role="dialog" aria-modal="true" aria-labelledby="rs-drawer-title" onMouseDown={event => event.stopPropagation()}>
    <div className="rs-drawer-header"><div><span className="rs-eyebrow">RESOURCE DETAILS</span><h2 id="rs-drawer-title">Asset information</h2><p>Illustrative asset record and lifecycle history</p></div><button className="rs-close" aria-label="Close resource details" onClick={close}><X size={18}/></button></div>
    <div className="rs-drawer-content"><div className="rs-detail-hero"><span className="rs-hero-icon"><Icon size={29}/></span><div><h3>{resource.name}</h3><span>{resource.id} · {resource.category}</span></div></div><StatusPill status={resource.status}/>
      <div className="rs-detail-tabs" role="tablist">{(['Overview', 'Assignment history', 'Maintenance'] as Tab[]).map(item => <button role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
      {tab === 'Overview' ? <div className="rs-detail-section"><h4>General information</h4><dl className="rs-detail-fields"><div><dt>Asset ID</dt><dd>{resource.id}</dd></div><div><dt>Serial number</dt><dd>{resource.serial}</dd></div><div><dt>Category</dt><dd>{resource.category}</dd></div><div><dt>Condition</dt><dd>{resource.condition}</dd></div><div><dt>Branch</dt><dd>{resource.branch}</dd></div><div><dt>Assigned to</dt><dd>{resource.assignee}</dd></div><div><dt>Purchase date</dt><dd>{resource.purchaseDate}</dd></div><div><dt>Status</dt><dd>{resource.status}</dd></div></dl></div> : <div className="rs-tab-empty"><ClipboardList size={25}/><strong>{tab}</strong><p>Detailed records will be connected after the API workflow is implemented.</p></div>}
    </div><div className="rs-drawer-footer"><span>Sample data · read-only preview</span><Button onClick={close}>Close</Button></div>
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
  const [status, setStatus] = useState<string>('All statuses');
  const [category, setCategory] = useState('All categories');
  const [branch, setBranch] = useState('All branches');
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<Resource | null>(null);
  const [adding, setAdding] = useState(false);
  const [exportInfo, setExportInfo] = useState(false);
  const visible = useMemo(() => resources.filter(resource => {
    const term = search.trim().toLowerCase();
    return (!term || [resource.name, resource.id, resource.serial, resource.assignee].some(value => value.toLowerCase().includes(term))) && (status === 'All statuses' || resource.status === status) && (category === 'All categories' || resource.category === category) && (branch === 'All branches' || resource.branch === branch);
  }), [search, status, category, branch]);
  const clearFilters = () => { setSearch(''); setStatus('All statuses'); setCategory('All categories'); setBranch('All branches'); };

  return <div className="rs-page"><PageHeader eyebrow="RESOURCE MANAGEMENT / ASSET CATALOG" title="Resources" description="Track, organize and manage company resources across all branches." actions={<><Button icon={<ArrowDownToLine size={15}/>} onClick={() => setExportInfo(true)}>Export</Button><Button variant="primary" icon={<Plus size={16}/>} onClick={() => setAdding(true)}>Add Resource</Button></>}/>
    <div className="rs-summary"><Card><span>Total resources</span><strong>{resources.length}</strong><small>Illustrative asset records</small></Card><Card><span>Available</span><strong>{resources.filter(resource => resource.status === 'Available').length}</strong><small>Ready to be assigned</small></Card><Card><span>Assigned</span><strong>{resources.filter(resource => resource.status === 'Assigned').length}</strong><small>In employee custody</small></Card><Card><span>Need attention</span><strong>{resources.filter(resource => resource.status === 'In maintenance' || resource.status === 'In transfer').length}</strong><small>Maintenance or transfer</small></Card></div>
    <Card className="rs-catalog"><div className="rs-catalog-head"><div><h2>Resource catalog</h2><p>Browse, filter and inspect company assets</p></div><div className="rs-view-switch" role="group" aria-label="Display mode"><button className={view === 'list' ? 'active' : ''} aria-label="List view" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={17}/></button><button className={view === 'grid' ? 'active' : ''} aria-label="Card view" aria-pressed={view === 'grid'} onClick={() => setView('grid')}><Grid2X2 size={17}/></button></div></div>
      <div className="rs-toolbar"><div className="rs-search"><Search size={16}/><input aria-label="Search resources" placeholder="Search resource name, ID or serial..." value={search} onChange={event => setSearch(event.target.value)}/></div><SelectMenu label="Filter status" value={status} options={statuses} onChange={setStatus}/><SelectMenu label="Filter category" value={category} options={categories} onChange={setCategory}/><SelectMenu label="Filter branch" value={branch} options={branches} onChange={setBranch}/>{(search || status !== 'All statuses' || category !== 'All categories' || branch !== 'All branches') && <button className="rs-clear" onClick={clearFilters}><SlidersHorizontal size={14}/> Clear filters</button>}</div>
      {view === 'list' ? <div className="rs-table-scroll"><table className="rs-table"><thead><tr><th>RESOURCE</th><th>CATEGORY</th><th>BRANCH</th><th>ASSIGNED TO</th><th>CONDITION</th><th>STATUS</th></tr></thead><tbody>{visible.map(resource => { const Icon = resource.icon; return <tr key={resource.id} tabIndex={0} role="button" aria-label={`Open ${resource.name} details`} onClick={() => setSelected(resource)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(resource); } }}><td><div className="rs-resource-cell"><span className="rs-thumb"><Icon size={20}/></span><div><strong>{resource.name}</strong><small>{resource.id}</small></div></div></td><td>{resource.category}</td><td>{resource.branch}</td><td>{resource.assignee}</td><td>{resource.condition}</td><td><StatusPill status={resource.status}/></td></tr>; })}</tbody></table></div> : <div className="rs-card-grid">{visible.map(resource => { const Icon = resource.icon; return <button className="rs-resource-card" key={resource.id} onClick={() => setSelected(resource)}><div className="rs-resource-card-head"><span className="rs-thumb"><Icon size={23}/></span><StatusPill status={resource.status}/></div><h3>{resource.name}</h3><span>{resource.id} · {resource.category}</span><div className="rs-resource-card-foot"><span>{resource.branch}</span><span>{resource.condition}</span></div></button>; })}</div>}
      {!visible.length && <div className="rs-empty"><Boxes size={28}/><h3>No resources found</h3><p>Try another search or remove some filters.</p><Button onClick={clearFilters}>Clear filters</Button></div>}
      <div className="rs-catalog-foot"><span>Showing <strong>{visible.length}</strong> of <strong>{resources.length}</strong> sample resources</span><span>Select a resource for details</span></div></Card>
    <p className="rs-preview-note"><Badge tone="blue">UI preview</Badge> Resource records and actions are illustrative. Database writes are not enabled.</p>
    {selected && <ResourceDrawer resource={selected} close={() => setSelected(null)}/>}{adding && <NewResourceDialog close={() => setAdding(false)}/>}
    {exportInfo && <div className="rs-overlay rs-modal-overlay" onMouseDown={() => setExportInfo(false)}><div className="rs-export-dialog" role="dialog" aria-modal="true" aria-labelledby="rs-export-title" onMouseDown={event => event.stopPropagation()}><button className="rs-close" aria-label="Close export information" onClick={() => setExportInfo(false)}><X size={18}/></button><span className="rs-export-icon"><ArrowDownToLine size={24}/></span><h2 id="rs-export-title">Export report</h2><p>Report exports will be available when the resource catalog is connected to the API. This preview uses illustrative records only.</p><Button variant="primary" onClick={() => setExportInfo(false)}>Got it</Button></div></div>}
  </div>;
}
