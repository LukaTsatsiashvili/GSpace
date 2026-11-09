import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Check, CheckCheck, ClipboardList, Clock3, Filter, Plus, X } from 'lucide-react';
import { Badge, Button, Card, PageHeader, SearchInput, SectionTabs, Select } from '../components/ui';
import { approvalRequests, approvalTypes, currency, statuses, type ApprovalRequest, type ApprovalStatus, type ApprovalTab, type RequestType } from './approvals-data';
import { NewRequestDialog, PreviewMessage, RequestTypeDialog, ReviewDecisionDialog, useApprovalEscape } from './ApprovalsDialogs';
import './approvals.css';

const tabs: ApprovalTab[] = ['My approvals', 'All requests', 'Request types'];
const statusOptions = ['All statuses', ...statuses];
const typeOptions = ['All types', ...approvalTypes.map(item => item.name)];

function Initials({ name }: { name: string }) {
  return <span className="ap-avatar" aria-hidden="true">{name.trim().split(/\s+/).slice(0, 2).map(word => word.charAt(0)).join('')}</span>;
}

function StatusPill({ status }: { status: ApprovalStatus }) {
  return <span className={'ap-status ap-status-' + status.toLowerCase().replace(/\s+/g, '-')}><span className="ap-status-dot"/>{status}</span>;
}

function TypeStatus({ active }: { active: boolean }) {
  return <span className={'ap-type-status ' + (active ? 'active' : 'inactive')}><span className="ap-status-dot"/>{active ? 'Active' : 'Inactive'}</span>;
}

function RequestDrawer({ request, close }: { request: ApprovalRequest; close: () => void }) {
  const [action, setAction] = useState<string | null>(null);
  useApprovalEscape(() => { if (action) setAction(null); else close(); });
  const canReview = request.isMyApproval && (request.status === 'Pending approval' || request.status === 'In review');
  return <div className="ap-overlay ap-right-overlay" onMouseDown={close}><aside role="dialog" aria-modal="true" aria-labelledby="ap-request-detail-title" className="ap-drawer" onMouseDown={e => e.stopPropagation()}>
    <header className="ap-drawer-head"><div><Badge tone="blue">{request.id}</Badge><h2 id="ap-request-detail-title">Request details</h2><p>Submitted request and approval history</p></div>
      <button className="ap-close" aria-label="Close request details" onClick={close}><X size={17}/></button></header>
    <div className="ap-drawer-body">
      <div className="ap-detail-person"><div><Initials name={request.requester}/><span><strong>{request.requester}</strong><small>{request.branch}</small></span></div><StatusPill status={request.status}/></div>
      <section className="ap-detail-section"><h3>{request.title}</h3><div className="ap-details-fields">
        <div><span>Request type</span><strong>{request.type}</strong></div>
        <div><span>Estimated amount</span><strong>{currency(request.amount)}</strong></div>
        <div><span>Submitted</span><strong>{request.submitted}</strong></div>
        <div><span>Due date</span><strong>{request.due}</strong></div>
      </div></section>
      <section className="ap-detail-section"><h3>Business justification</h3><p className="ap-detail-copy">{request.reason}</p></section>
      <section className="ap-detail-section"><h3>Approval workflow</h3>
        <div className="ap-workflow-summary"><div><strong>Step {request.step} of {request.totalSteps}</strong><small>{request.pattern} workflow</small></div>
          <span className="ap-flow-marker"><Check size={15}/></span>
        </div>
        <div className="ap-workflow-track" aria-label={'Current approval step ' + request.step + ' of ' + request.totalSteps}>
          {Array.from({ length: request.totalSteps }, (_, i) => <span key={i} className={i < request.step ? 'current' : ''}/>)}
        </div>
      </section>
      <section className="ap-detail-section"><h3>Activity timeline</h3>
        <ol className="ap-timeline">{request.activity.map(item => <li key={item.title}><strong>{item.title}</strong><small>{item.detail}</small></li>)}</ol>
      </section>
      <p className="ap-detail-notice">Approval actions, versions, notifications and audit events require an authenticated API. This preview never changes the request status.</p>
    </div>
    <footer className="ap-drawer-foot"><Button onClick={close}>Close</Button>
      {canReview && <div><Button onClick={() => setAction('Request changes')}>Request changes</Button>
        <Button variant="primary" onClick={() => setAction('Review decision')}>Review decision</Button></div>}
    </footer>
    {action && <ReviewDecisionDialog request={request} initial={action === 'Request changes' ? 'Request changes' : 'Approve'} close={() => setAction(null)}/>}
  </aside></div>;
}

function TypeDrawer({ type, close, edit }: { type: RequestType; close: () => void; edit: () => void }) {
  useApprovalEscape(close);
  return <div className="ap-overlay ap-right-overlay" onMouseDown={close}><aside role="dialog" aria-modal="true" aria-labelledby="ap-type-detail-title" className="ap-drawer" onMouseDown={e => e.stopPropagation()}>
    <header className="ap-drawer-head"><div><Badge tone="blue">{type.code} · VERSION {type.version}</Badge><h2 id="ap-type-detail-title">Request type details</h2><p>Configured form and workflow snapshot</p></div>
      <button className="ap-close" aria-label="Close request type details" onClick={close}><X size={17}/></button></header>
    <div className="ap-drawer-body">
      <div className="ap-type-drawer-title"><span className="ap-type-icon"><ClipboardList size={20}/></span><div><h3>{type.name}</h3><p>{type.description}</p></div><TypeStatus active={type.active}/></div>
      <section className="ap-detail-section"><h3>Configuration</h3><div className="ap-details-fields">
        <div><span>Unique code</span><strong>{type.code}</strong></div>
        <div><span>Version</span><strong>{type.version}</strong></div>
        <div><span>Requests</span><strong>{type.count}</strong></div>
        <div><span>Approval pattern</span><strong>{type.pattern}</strong></div>
        <div><span>Default deadline</span><strong>{type.deadline}</strong></div>
        <div><span>Deadline behavior</span><strong>{type.deadlineBehavior}</strong></div>
      </div></section>
      <section className="ap-detail-section"><h3>Configured form fields</h3><div className="ap-field-tags">{type.formFields.map(field => <span key={field}>{field}</span>)}</div></section>
      <section className="ap-detail-section"><h3>Approval route</h3><div className="ap-route-preview">{type.route} · {type.pattern}</div></section>
      <p className="ap-detail-notice">Existing requests retain their original workflow configuration and version. Editing is preview-only.</p>
    </div>
    <footer className="ap-drawer-foot"><Button onClick={close}>Close</Button><Button variant="primary" onClick={edit}>Preview configuration</Button></footer>
  </aside></div>;
}

export default function ApprovalsPage() {
  const [tab, setTab] = useState<ApprovalTab>('My approvals');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [type, setType] = useState('All types');
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [selectedType, setSelectedType] = useState<RequestType | null>(null);
  const [typeEditor, setTypeEditor] = useState<RequestType | 'new' | null>(null);
  const [newRequest, setNewRequest] = useState(false);
  const [exportPreview, setExportPreview] = useState(false);

  const filteredRequests = useMemo(() => approvalRequests.filter(item => {
    const withinTab = tab !== 'My approvals' || item.isMyApproval;
    const query = search.trim().toLowerCase();
    const matches = !query || [item.title, item.id, item.requester, item.branch, item.type].some(value => value.toLowerCase().includes(query));
    return withinTab && matches && (status === 'All statuses' || item.status === status) && (type === 'All types' || item.type === type);
  }), [tab, search, status, type]);
  const clearFilters = () => { setSearch(''); setStatus('All statuses'); setType('All types'); };

  return <div className="ap-page">
    <PageHeader eyebrow="WORKSPACE / APPROVAL WORKFLOWS" title="Requests & Approvals" badgeLabel="UI concept · sample data"
      description="One clear place to request resources, review decisions and follow every approval step."
      actions={<><Button icon={<ArrowDownToLine size={16}/>} onClick={() => setExportPreview(true)}>Export</Button>
        <Button variant="primary" icon={<Plus size={17}/>} onClick={() => setNewRequest(true)}>New request</Button></>}/>
    <div className="ap-summary">
      <Card className="ap-stat"><div><span>Awaiting my approval</span><i className="ap-stat-icon amber"><Clock3 size={19}/></i></div><strong>4</strong><small>2 need attention today</small></Card>
      <Card className="ap-stat"><div><span>In review</span><i className="ap-stat-icon blue"><ClipboardList size={19}/></i></div><strong>18</strong><small>Across active workflows</small></Card>
      <Card className="ap-stat"><div><span>Approved this month</span><i className="ap-stat-icon mint"><CheckCheck size={19}/></i></div><strong>63</strong><small>Completed with audit history</small></Card>
      <Card className="ap-stat"><div><span>Changes requested</span><i className="ap-stat-icon purple"><Filter size={19}/></i></div><strong>7</strong><small>Returned for clarification</small></Card>
    </div>
    <Card className="ap-catalog">
      <SectionTabs tabs={tabs} selected={tab} counts={{ 'My approvals': 4 }} onChange={value => { setTab(value as ApprovalTab); clearFilters(); }}/>
      {tab === 'Request types' ? <div className="ap-types-content">
        <div className="ap-types-heading"><div><h2>Configurable request types</h2><p>Form fields and approval paths are versioned per type.</p></div>
          <Button icon={<Plus size={16}/>} variant="primary" onClick={() => setTypeEditor('new')}>New request type</Button>
        </div>
        <div className="ap-types-list">{approvalTypes.map(item => <button key={item.code} type="button" className="ap-type-row"
          onClick={() => setSelectedType(item)} aria-label={'View ' + item.name + ' configuration'}>
          <span className="ap-type-icon"><ClipboardList size={20}/></span>
          <span className="ap-type-copy"><strong>{item.name}</strong><span>{item.description}</span><small>{item.code} · Version {item.version} · {item.count} requests · {item.pattern}</small></span>
          <TypeStatus active={item.active}/><ArrowLeftRight className="ap-type-arrow" size={18}/>
        </button>)}</div>
      </div> : <>
        <div className="ap-toolbar">
          <SearchInput className="ap-search" placeholder="Search requests, people, IDs..." aria-label="Search approval requests" value={search} onChange={e => setSearch(e.target.value)}/>
          <Select className="ap-filter-select" label="Filter status" value={status} options={statusOptions} onChange={setStatus}/>
          <Select className="ap-filter-select" label="Filter request type" value={type} options={typeOptions} onChange={setType}/>
          <span className="ap-toolbar-fill"/><Button onClick={clearFilters}>Clear filters</Button>
        </div>
        <div className="ap-table-scroll"><table className="ap-table"><thead><tr><th>REQUEST</th><th>REQUESTER</th><th>TYPE</th><th>SUBMITTED / DUE</th><th>CURRENT STEP</th><th>STATUS</th><th aria-label="Actions"/></tr></thead>
          <tbody>{filteredRequests.map(item => <tr key={item.id} role="button" tabIndex={0} aria-label={'View ' + item.id} onClick={() => setRequest(item)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRequest(item); } }}>
            <td><strong>{item.title}</strong><small>{item.id} · {currency(item.amount)}</small></td>
            <td><div className="ap-person-cell"><Initials name={item.requester}/><span><strong>{item.requester}</strong><small>{item.branch}</small></span></div></td>
            <td className="ap-muted-td">{item.type}</td>
            <td><strong>{item.submitted}</strong><small>Due {item.due}</small></td>
            <td><strong>Step {item.step} of {item.totalSteps}</strong><small>{item.pattern} workflow</small></td>
            <td><StatusPill status={item.status}/></td>
            <td className="ap-row-arrow"><ArrowLeftRight size={18}/></td>
          </tr>)}</tbody>
        </table></div>
        {!filteredRequests.length && <div className="ap-no-results"><ClipboardList size={27}/><h3>No requests found</h3><p>Try a different search or filter.</p><Button onClick={clearFilters}>Clear filters</Button></div>}
        <div className="ap-table-footer"><span>{filteredRequests.length} illustrative request{filteredRequests.length === 1 ? '' : 's'} · no live records</span><span>Select a row for details</span></div>
      </>}
    </Card>
    <p className="ap-page-note"><Badge tone="blue">UI preview</Badge> Request records and actions are illustrative. No database updates or uploads are enabled.</p>
    {request && <RequestDrawer key={request.id} request={request} close={() => setRequest(null)}/>}
    {selectedType && <TypeDrawer key={selectedType.code} type={selectedType} close={() => setSelectedType(null)} edit={() => { setTypeEditor(selectedType); setSelectedType(null); }}/>}
    {newRequest && <NewRequestDialog close={() => setNewRequest(false)}/>}
    {typeEditor && <RequestTypeDialog key={typeEditor === 'new' ? 'new' : typeEditor.code} initial={typeEditor === 'new' ? undefined : typeEditor} close={() => setTypeEditor(null)}/>}
    {exportPreview && <div className="ap-overlay ap-modal-center" onMouseDown={() => setExportPreview(false)}>
      <section className="ap-preview-message" role="dialog" aria-modal="true" aria-labelledby="ap-export-title" onMouseDown={e => e.stopPropagation()}>
        <span className="ap-preview-icon"><ArrowDownToLine size={23}/></span><h3 id="ap-export-title">Export approval report</h3>
        <p>Report exports require the authenticated API. Sample requests shown here are illustrative and are not an official report.</p>
        <Button variant="primary" onClick={() => setExportPreview(false)}>Got it</Button>
      </section>
    </div>}
  </div>;
}
