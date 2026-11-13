import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDownToLine, ArrowLeftRight, Boxes, Check, ClipboardList, Grid2X2, Wrench, Users, Box,
  List, Monitor, Package, Plus, Smartphone, Laptop, Printer, Router, X, Settings2, Trash2
} from 'lucide-react';
import { Button, Card, PageHeader, Select, SearchInput } from '../components/ui';
import { useAuth } from '../auth/AuthGate';
import { useToast } from '../components/toast';
import NewResourceDialog from './NewResourceDialog';
import BulkResourceDialog from './BulkResourceDialog';
import ResourceCategoriesDialog from './ResourceCategoriesDialog';
import {
  resourceApi, downloadDocument, exportResourceCsv, type ResourceRecord, type ResourceStatus,
  type ResourceSummary, type Category, type Branch, type AuditEntry
} from './resource-api';
import './resources.css';

type View = 'list' | 'grid';
type Tab = 'Overview' | 'Assignments' | 'Maintenance' | 'Documents' | 'Audit timeline';
const statuses = ['All statuses', 'Available', 'Assigned', 'In maintenance', 'In transfer', 'Retired'] as const;
const labels: Record<ResourceStatus, string> = {
  AVAILABLE: 'Available', ASSIGNED: 'Assigned', IN_TRANSFER: 'In transfer',
  IN_MAINTENANCE: 'In maintenance', RETIRED: 'Retired'
};
const statusFilters: Record<string, ResourceStatus | null> = {
  Available: 'AVAILABLE', Assigned: 'ASSIGNED', 'In maintenance': 'IN_MAINTENANCE',
  'In Maintenance': 'IN_MAINTENANCE', 'In transfer': 'IN_TRANSFER', Retired: 'RETIRED'
};
function iconFor(category: string) {
  const key = category.toLowerCase();
  if (key.includes('laptop')) return Laptop;
  if (key.includes('monitor')) return Monitor;
  if (key.includes('mobile') || key.includes('tablet')) return Smartphone;
  if (key.includes('printer')) return Printer;
  if (key.includes('network')) return Router;
  if (key.includes('pos')) return Package;
  return Box;
}
function formatDate(date?: string | null) {
  return date ? new Date(date).toLocaleDateString() : '—';
}
function SelectMenu({ label, value, options, onChange }: {
  label: string; value: string; options: readonly string[]; onChange: (value: string) => void
}) {
  return <Select className="rs-select-wrap" label={label} value={value} options={options} onChange={onChange}/>;
}
function StatusPill({ status }: { status: ResourceStatus }) {
  const label = labels[status];
  return <span className={'rs-status ' + label.toLowerCase().replace(/\s+/g, '-')}>
    <span/>{label}</span>;
}
function ResourceDrawer({ resource, categories, close, canEdit, canDelete, onEdit, onRemoved }: {
  resource: ResourceRecord; categories: Category[];
  close: () => void; canEdit: boolean; canDelete: boolean;
  onEdit: () => void; onRemoved: () => void
}) {
  const [tab, setTab] = useState<Tab>('Overview');
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [auditError, setAuditError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const Icon = iconFor(resource.category);
  const editable = resource.status === 'AVAILABLE' || resource.status === 'RETIRED';
  const definitions = categories.find(category => category.name === resource.category)?.definitions ?? [];
  const missingRequired = definitions.filter(field => field.required && !resource.customFields?.[field.key]?.trim());
  const customItems = [
    ...definitions.filter(field => field.required || resource.customFields?.[field.key]?.trim())
      .map(field => ({ key: field.key, label: field.label,
        value: resource.customFields?.[field.key] ?? '' })),
    ...Object.entries(resource.customFields ?? {})
      .filter(([key, value]) => !definitions.some(field => field.key === key) && value.trim())
      .map(([key, value]) => ({ key, label: key, value }))
  ];

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy && !document.querySelector('.ui-select-options')) {
        if (confirmDelete) setConfirmDelete(false); else close();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [close, busy, confirmDelete]);
  useEffect(() => {
    if (tab !== 'Audit timeline') return;
    let alive = true;
    void resourceApi.audit(resource.id).then(data => {
      if (alive) setAudit(data.events);
    }).catch(err => {
      if (alive) setAuditError(err instanceof Error ? err.message : 'Audit timeline could not load.');
    });
    return () => { alive = false; };
  }, [tab, resource.id]);
  async function remove() {
    if (busy) return;
    setBusy(true); setError('');
    try { await resourceApi.remove(resource.id); onRemoved(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to delete resource.'); }
    finally { setBusy(false); }
  }
  const detail = (title: string, value: ReactNode) =>
    <div key={title}><dt>{title}</dt><dd>{value ?? '—'}</dd></div>;
  return <div className="rs-overlay" onMouseDown={() => { if (!busy) close(); }}>
    <aside className="rs-drawer" role="dialog" aria-modal="true" aria-labelledby="rs-drawer-title"
      onMouseDown={event => event.stopPropagation()}>
      <div className="rs-drawer-header"><div><h2 id="rs-drawer-title">Resource details</h2>
        <p>Asset register / {resource.assetCode}</p></div>
        <button className="rs-close" aria-label="Close resource details" onClick={close}><X size={18}/></button>
      </div>
      <div className="rs-drawer-identity"><div className="rs-detail-hero"><span className="rs-hero-icon"><Icon size={24}/></span>
        <div><h3>{resource.name}</h3><span>{resource.assetCode} · {resource.category}</span></div></div>
        <StatusPill status={resource.status}/>
      </div>
      <div className="rs-detail-tabs" role="tablist">
        {(['Overview', 'Assignments', 'Maintenance', 'Documents', 'Audit timeline'] as Tab[]).map(item =>
          <button role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''}
            key={item} onClick={() => setTab(item)}>{item}</button>)}
      </div>
      <div className="rs-drawer-content">
        {tab === 'Overview' && <>
          {missingRequired.length > 0 && <div className="rs-required-summary" role="status">
            <strong>Required specifications pending</strong>
            <p>{missingRequired.map(field => field.label).join(', ')}.
              {canEdit ? ' Open Edit resource to complete these fields.' :
                ' An authorized editor can complete these fields later.'}</p>
          </div>}
          <div className="rs-detail-section"><h4>General information</h4>
            <dl className="rs-detail-fields">
              {detail('Asset ID', resource.assetCode)}
              {detail('Serial number', resource.serialNumber || '—')}
              {detail('Category', resource.category)}
              {detail('Resource type', resource.resourceType)}
              {detail('Condition', resource.condition)}
              {detail('Branch', resource.branch)}
              {detail('Location', resource.location || '—')}
              {detail('Registered', formatDate(resource.createdAt))}
              {detail('Warranty until', formatDate(resource.warrantyEnd))}
              {detail('Notes', resource.description || '—')}
            </dl>
          </div>
          {customItems.length > 0 && <div className="rs-detail-section">
            <h4>Category specifications</h4>
            <dl className="rs-detail-fields">
              {customItems.map(field => detail(field.label, field.value ||
                <span className="rs-required-missing">Not completed</span>))}
            </dl>
          </div>}
          {resource.purchasePrice !== undefined && <div className="rs-detail-section">
            <h4>Purchase information</h4>
            <dl className="rs-detail-fields">
              {detail('Purchase price', resource.purchasePrice !== null ? resource.purchasePrice + ' ' + resource.currency : '—')}
              {detail('Purchase date', formatDate(resource.purchaseDate))}
              {detail('Supplier', resource.supplier || '—')}
              {detail('Useful life', resource.usefulLifeMonths ? resource.usefulLifeMonths + ' months' : '—')}
              {detail('Residual value', resource.residualValue !== null ? (resource.residualValue ?? '—') + ' ' + resource.currency : '—')}
            </dl>
          </div>}
        </>}
        {tab === 'Documents' && <div className="rs-detail-section">
          {resource.documents.length ? <div className="rs-live-documents">
            {resource.documents.map(file => <div key={file.id}>
              <div><strong>{file.filename}</strong><small>{Math.ceil(file.byteSize / 1024)} KB · {formatDate(file.createdAt)}</small></div>
              <Button onClick={() => { void downloadDocument(resource.id, file).catch(err =>
                toast.error(err instanceof Error ? err.message : 'Download failed.')); }}
                icon={<ArrowDownToLine size={15}/>}>Download</Button>
            </div>)}
          </div> : <p className="rs-muted">No documents were uploaded for this resource.</p>}
        </div>}
        {tab === 'Audit timeline' && <div className="rs-detail-section">
          {auditError && <p className="rs-error" role="alert">{auditError}</p>}
          {audit.length ? <ol className="rs-live-audit">{audit.map(event => <li key={event.id}>
            <strong>{event.action === 'CREATED' ? 'Resource registered' : event.action === 'UPDATED' ?
              'Resource updated' : event.action}</strong>
            <span>{formatDate(event.createdAt)} · {event.actorName}</span>
          </li>)}</ol> : !auditError && <p className="rs-muted">No audit history to display.</p>}
        </div>}
        {(tab === 'Assignments' || tab === 'Maintenance') && <div className="rs-tab-empty">
          <ClipboardList size={25}/><strong>{tab}</strong>
          <p>Real {tab.toLowerCase()} will appear after that workflow's backend is connected.
            No demonstration events are shown.</p>
        </div>}
        {error && <p className="rs-error" role="alert">{error}</p>}
      </div>
      <div className="rs-drawer-footer">
        <Button onClick={close}>Close</Button>
        <div className="rs-drawer-actions">
          {canDelete && editable && <Button icon={<Trash2 size={15}/>}
            onClick={() => setConfirmDelete(true)}>Delete unused</Button>}
          <Button variant="primary" disabled={!canEdit || !editable} onClick={onEdit}>
            Edit resource
          </Button>
        </div>
      </div>
      {confirmDelete && <div className="rs-drawer-inline-overlay" onMouseDown={() => { if (!busy) setConfirmDelete(false); }}>
        <div className="rs-edit-notice" role="alertdialog" aria-modal="true" aria-label="Confirm resource deletion"
          onMouseDown={e => e.stopPropagation()}>
          <h3>Delete unused resource?</h3><p>Delete {resource.assetCode} and its documents? The audit history remains.
            This action cannot be undone.</p>
          {error && <p className="rs-error" role="alert">{error}</p>}
          <div className="rs-confirm-actions"><Button disabled={busy} onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="primary" disabled={busy} onClick={() => { void remove(); }}>
              {busy ? 'Deleting...' : 'Confirm delete'}</Button>
          </div>
        </div>
      </div>}
    </aside>
  </div>;
}

export default function ResourcesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const permissions = user.role.permissions;
  const canCreate = permissions.includes('assets.create') &&
    ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role.key);
  const canEdit = permissions.includes('assets.edit');
  const canDelete = canEdit && ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(user.role.key);
  const canExport = permissions.includes('reports.export');
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [summary, setSummary] = useState<ResourceSummary>({ total: 0, assigned: 0, available: 0, maintenance: 0, branches: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('All assets');
  const [status, setStatus] = useState<string>('All statuses');
  const [category, setCategory] = useState('All categories');
  const [branch, setBranch] = useState('All branches');
  const [view, setView] = useState<View>('list');
  const [selected, setSelected] = useState<ResourceRecord | null>(null);
  const [editing, setEditing] = useState<ResourceRecord | null>(null);
  const [adding, setAdding] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [list, catalog] = await Promise.all([resourceApi.list(), resourceApi.catalog()]);
      setResources(list.resources); setSummary(list.summary); setTruncated(list.truncated);
      setCategories(catalog.categories); setBranches(catalog.branches);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load Resources.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const visible = useMemo(() => resources.filter(resource => {
    const term = search.trim().toLowerCase();
    return (['All assets', 'Asset register'].includes(activeTab) ||
      resource.status === statusFilters[activeTab]) &&
      (!term || [resource.name, resource.assetCode, resource.serialNumber || '', resource.location,
        resource.branch].some(value => value.toLowerCase().includes(term))) &&
      (status === 'All statuses' || resource.status === statusFilters[status]) &&
      (category === 'All categories' || resource.category === category) &&
      (branch === 'All branches' || resource.branch === branch);
  }), [resources, activeTab, search, status, category, branch]);
  const clearFilters = () => { setSearch(''); setStatus('All statuses'); setCategory('All categories'); setBranch('All branches'); };
  function saved(message: string) {
    setAdding(false); setEditing(null); setBulkOpen(false); setCategoryOpen(false); setSelected(null);
    toast.success(message); void load();
  }
  async function exportCsv() {
    if (!canExport) return;
    try {
      await exportResourceCsv(visible.map(resource => resource.id));
      toast.success('CSV export completed and recorded in the security audit.');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Export failed.'); }
  }

  return <div className="rs-page"><PageHeader eyebrow="ASSET MANAGEMENT / RESOURCE REGISTER"
    title="Resources" badgeLabel="PostgreSQL connected"
    description="Track, organize and manage company resources across branches."
    actions={<>
      {canExport && <Button icon={<ArrowDownToLine size={15}/>} onClick={() => { void exportCsv(); }}>Export CSV</Button>}
      {canCreate && <Button icon={<Settings2 size={15}/>} onClick={() => setCategoryOpen(true)}>Categories</Button>}
      {canCreate && <Button icon={<ClipboardList size={15}/>} onClick={() => setBulkOpen(true)}>Bulk create</Button>}
      {canCreate && <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setAdding(true)}>Add resource</Button>}
    </>}/>
    <div className="rs-summary">
      <Card><span>Total assets</span><i className="rs-stat-icon rs-stat-blue"><Box size={19}/></i>
        <strong>{summary.total}</strong><small>Across {summary.branches} branches</small></Card>
      <Card><span>Assigned</span><i className="rs-stat-icon rs-stat-green"><Users size={19}/></i>
        <strong>{summary.assigned}</strong><small>{summary.total ? Math.round(summary.assigned / summary.total * 100) : 0}% of registered assets</small></Card>
      <Card><span>Available</span><i className="rs-stat-icon rs-stat-purple"><Check size={19}/></i>
        <strong>{summary.available}</strong><small>Ready for assignment</small></Card>
      <Card><span>In maintenance</span><i className="rs-stat-icon rs-stat-amber"><Wrench size={19}/></i>
        <strong>{summary.maintenance}</strong><small>Require attention</small></Card>
    </div>
    <Card className="rs-catalog">
      <div className="rs-catalog-tabs" role="tablist" aria-label="Resource status tabs">
        {['All assets','Assigned','Available','In Maintenance','Asset register'].map(tab =>
          <button key={tab} role="tab" aria-selected={activeTab === tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => { setActiveTab(tab); clearFilters(); }}>{tab}</button>)}
      </div>
      <div className="rs-toolbar">
        <SearchInput className="rs-search" aria-label="Search resources"
          placeholder="Search by name, ID or serial..." value={search}
          onChange={event => setSearch(event.target.value)}/>
        <SelectMenu label="Filter status" value={status} options={statuses} onChange={setStatus}/>
        <SelectMenu label="Filter branch" value={branch} options={['All branches', ...branches.map(b => b.name)]} onChange={setBranch}/>
        <SelectMenu label="Filter type" value={category === 'All categories' ? 'All types' : category}
          options={['All types', ...categories.map(c => c.name)]}
          onChange={value => setCategory(value === 'All types' ? 'All categories' : value)}/>
        <div className="rs-toolbar-spacer"/>
        <button className="rs-reset" onClick={clearFilters}>Clear filters</button>
        <button className="rs-view-toggle" onClick={() => setView(view === 'list' ? 'grid' : 'list')}>
          {view === 'list' ? <Grid2X2 size={16}/> : <List size={16}/>}
          {view === 'list' ? 'Cards' : 'List'}</button>
      </div>
      {error && <div className="rs-empty" role="alert"><p>{error}</p>
        <Button onClick={() => { void load(); }}>Retry</Button></div>}
      {loading ? <div className="rs-empty">Loading resources from PostgreSQL...</div> :
        view === 'list' ? <div className="rs-table-scroll"><table className="rs-table">
          <thead><tr><th>RESOURCE / ID</th><th>CATEGORY</th><th>BRANCH / LOCATION</th>
            <th>ASSIGNED TO</th><th>CONDITION</th><th>STATUS</th><th aria-label="Actions"/></tr></thead>
          <tbody>{visible.map(resource => {
            const Icon = iconFor(resource.category);
            return <tr key={resource.id} tabIndex={0} role="button"
              aria-label={'Open ' + resource.name + ' details'} onClick={() => setSelected(resource)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault(); setSelected(resource);
              }}}>
              <td><div className="rs-resource-cell"><span className="rs-thumb"><Icon size={20}/></span>
                <div><strong>{resource.name}</strong><small>{resource.assetCode}</small></div></div></td>
              <td>{resource.category}</td><td><div className="rs-location-cell">{resource.branch}
                <small>{resource.location || '—'}</small></div></td>
              <td>—</td><td>{resource.condition}</td><td><StatusPill status={resource.status}/></td>
              <td className="rs-row-action"><ArrowLeftRight size={17}/></td>
            </tr>;
          })}</tbody></table></div> :
          <div className="rs-card-grid">{visible.map(resource => {
            const Icon = iconFor(resource.category);
            return <button className="rs-resource-card" key={resource.id} onClick={() => setSelected(resource)}>
              <div className="rs-resource-card-head"><span className="rs-thumb"><Icon size={23}/></span>
                <StatusPill status={resource.status}/></div>
              <h3>{resource.name}</h3><span>{resource.assetCode} · {resource.category}</span>
              <div className="rs-resource-card-foot"><span>{resource.branch}</span><span>{resource.condition}</span></div>
            </button>;
          })}</div>}
      {!loading && !visible.length && !error && <div className="rs-empty">
        <Boxes size={28}/><h3>No resources found</h3>
        <p>{resources.length ? 'Try another search or clear the filters.' : 'Register your first resource to begin.'}</p>
        {resources.length > 0 && <Button onClick={clearFilters}>Clear filters</Button>}
      </div>}
      <div className="rs-catalog-foot"><span><strong>{visible.length}</strong> actual records shown
        {truncated ? ' · first 500 of ' + summary.total + ' (more require pagination)' : ' · ' + summary.total + ' registered'}
      </span><span>Click a row to view asset details</span></div>
    </Card>
    {selected && <ResourceDrawer resource={selected} categories={categories} close={() => setSelected(null)}
      canEdit={canEdit} canDelete={canDelete}
      onEdit={() => { setEditing(selected); setSelected(null); }}
      onRemoved={() => saved(selected.assetCode + ' deleted.')}/>}
    {(adding || editing) && <NewResourceDialog key={editing?.id ?? 'new'} resource={editing}
      branches={branches} categories={categories}
      close={() => { setAdding(false); setEditing(null); }}
      saved={code => saved(code + (editing ? ' updated.' : ' registered.'))}/>}
    {bulkOpen && <BulkResourceDialog branches={branches} categories={categories}
      close={() => setBulkOpen(false)} saved={saved}/>}
    {categoryOpen && <ResourceCategoriesDialog categories={categories}
      close={() => setCategoryOpen(false)} saved={() => saved('Resource category saved.')}/>}
  </div>;
}
