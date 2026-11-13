import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeftRight, CheckCheck, ClipboardList, Clock3, Filter, Plus, X } from 'lucide-react';
import { Badge, Button, Card, Checkbox, Input, NumberInput, PageHeader, SearchInput, SectionTabs, Select, Textarea } from '../components/ui';
import { useToast } from '../components/toast';
import { useAuth } from '../auth/AuthGate';
import { approvalsApi, exportApprovalCsv,
  type ApprovalField, type ApprovalLookups, type ApprovalRequestRecord, type ApprovalStep,
  type ApprovalSubmission, type ApprovalTypeInput, type ApprovalTypeRecord, type ApproverTarget } from './approvals-api';
import './approvals.css';
import './approvals-live.css';

type Tab = 'My approvals' | 'All requests' | 'Request types';
const tabs: Tab[] = ['My approvals', 'All requests', 'Request types'];
const statuses = ['All statuses', 'PENDING', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'];
const fieldTypes: ApprovalField['type'][] = ['text','number','date','select','multi_select'];
function nice(value: string) { return value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()); }
function showDate(value?: string | null) { return value ? new Date(value).toLocaleDateString() : '—'; }
function money(value: string | null) { return value === null ? '—' : '₾ ' + Number(value).toLocaleString(); }
function message(error: unknown) { return error instanceof Error ? error.message : 'Operation failed'; }
function emptyType(): ApprovalTypeInput {
  return { code: '', name: '', description: '', active: true, deadlineDays: 3, fields: [],
    steps: [{ mode: 'ANY', targets: [] }] };
}
function Modal({ title, description, children, close, footer, wide = false }: {
  title: string; description: string; children: ReactNode; close: () => void; footer: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    const esc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('.ui-select[aria-expanded="true"]')) return;
      close();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [close]);
  return <div className="ap-overlay ap-modal-center" onMouseDown={close}>
    <section className={'ap-modal ap-live-modal' + (wide ? ' ap-live-wide' : '')} role="dialog" aria-modal="true"
      aria-label={title} onMouseDown={e => e.stopPropagation()}>
      <div className="ap-modal-head"><div><Badge tone="blue">WORKFLOW</Badge><h2>{title}</h2><p>{description}</p></div>
        <button className="ap-close" onClick={close} aria-label="Close dialog"><X size={18}/></button></div>
      <div className="ap-modal-content ap-live-content">{children}</div>
      <div className="ap-modal-foot">{footer}</div>
    </section>
  </div>;
}
function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return <label className="ap-form-field"><span>{label}</span>{children}</label>;
}
function RequestForm({ types, lookups, close, saved, previous }: {
  types: ApprovalTypeRecord[]; lookups: ApprovalLookups; close: () => void; saved: () => Promise<void>;
  previous?: ApprovalRequestRecord
}) {
  const toast = useToast();
  const [typeId, setTypeId] = useState(previous?.typeId ?? types.find(t => t.active)?.id ?? '');
  const type = types.find(t => t.id === typeId);
  const [branchId, setBranchId] = useState(previous?.branchId ?? lookups.branches[0]?.id ?? '');
  const [title, setTitle] = useState(previous?.title ?? '');
  const [reason, setReason] = useState(previous?.reason ?? '');
  const [amount, setAmount] = useState(previous?.amount ?? '');
  const [values, setValues] = useState<Record<string, string | string[]>>(previous?.values ?? {});
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!type || !branchId || !title.trim() || !reason.trim()) { toast.error('Complete request type, branch, title and justification.'); return; }
    setBusy(true);
    try {
      if (previous) await approvalsApi.resubmit(previous.id, reason, values);
      else {
        const body: ApprovalSubmission = {
          typeId, branchId, title: title.trim(), reason: reason.trim(),
          amount: amount.trim() === '' ? null : Number(amount), values
        };
        if (body.amount !== null && (!Number.isFinite(body.amount) || body.amount < 0)) throw Error('Enter a valid amount.');
        await approvalsApi.createRequest(body);
      }
      toast.success(previous ? 'Request resubmitted for approval.' : 'Request submitted for approval.');
      close(); await saved();
    } catch (e) { toast.error(message(e)); }
    finally { setBusy(false); }
  }
  return <Modal title={previous ? 'Resubmit request' : 'Create a request'}
    description="Submit an authenticated request against a saved workflow version." close={close} wide
    footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={busy || !type} onClick={() => void save()}>{busy ? 'Saving...' : previous ? 'Resubmit request' : 'Submit request'}</Button></>}>
    <div className="ap-form-grid">
      <FieldRow label="Request type *"><Select label="Request type" value={type?.name ?? 'Choose type'} options={types.filter(t => t.active).map(t => t.name)}
        onChange={value => { const selected = types.find(t => t.name === value); setTypeId(selected?.id ?? ''); setValues({}); }}/></FieldRow>
      <FieldRow label="Branch *"><Select label="Branch" value={lookups.branches.find(b => b.id === branchId)?.name ?? 'Choose branch'}
        options={lookups.branches.map(b => b.name)} onChange={value => setBranchId(lookups.branches.find(b => b.name === value)?.id ?? '')}/></FieldRow>
      <FieldRow label="Request title *"><Input value={title} disabled={!!previous} maxLength={180} onChange={e => setTitle(e.target.value)}/></FieldRow>
      <FieldRow label="Estimated amount (GEL)"><NumberInput min={0} step={0.01} value={amount} disabled={!!previous}
        onChange={e => setAmount(e.target.value)}/></FieldRow>
      <div className="ap-full"><FieldRow label="Business justification *"><Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}/></FieldRow></div>
    </div>
    {type && <><div className="ap-live-section"><h3>Configured form fields · v{previous?.version ?? type.version}</h3>
      {type.fields.length === 0 && <p>No additional fields in this request type.</p>}
      <div className="ap-form-grid">{(previous?.fields ?? type.fields).map(f => <div key={f.key} className={f.type === 'multi_select' ? 'ap-full' : ''}>
        <FieldRow label={f.label + (f.required ? ' *' : '')}>
          {f.type === 'select' ? <Select label={f.label}
            value={typeof values[f.key] === 'string' && values[f.key] ? values[f.key] as string : 'Choose option'}
            options={['Choose option', ...(f.options ?? [])]}
            onChange={value => setValues(old => ({ ...old, [f.key]: value === 'Choose option' ? '' : value }))}/> :
          f.type === 'multi_select' ? <div className="ap-live-options">{f.options?.map(option =>
            <label key={option} className="ap-live-option"><Checkbox checked={Array.isArray(values[f.key]) && values[f.key].includes(option)}
              onChange={e => { const before = Array.isArray(values[f.key]) ? values[f.key] as string[] : [];
                setValues(old => ({ ...old, [f.key]: e.target.checked ? [...before, option] : before.filter(x => x !== option) })); }}/>{option}</label>)}</div> :
          f.type === 'number' ? <NumberInput value={values[f.key] as string ?? ''} onChange={e => setValues(old => ({ ...old, [f.key]: e.target.value }))}/> :
          <Input type={f.type === 'date' ? 'date' : 'text'} maxLength={2000}
            value={values[f.key] as string ?? ''} onChange={e => setValues(old => ({ ...old, [f.key]: e.target.value }))}/>}
        </FieldRow>
      </div>)}</div>
    </div><p className="ap-compact-hint">Approval levels: {type.steps.length}. Each level is either any-one approval or all-reviewers approval. Saving a type revision will not alter submitted requests.</p></>}
  </Modal>;
}
function TypeForm({ initial, lookups, close, saved }: {
  initial?: ApprovalTypeRecord; lookups: ApprovalLookups; close: () => void; saved: () => Promise<void>
}) {
  const toast = useToast();
  const [data, setData] = useState<ApprovalTypeInput>(() => initial ?
    { code: initial.code, name: initial.name, description: initial.description, active: initial.active,
      deadlineDays: initial.deadlineDays, fields: initial.fields, steps: initial.steps } : emptyType());
  const [busy, setBusy] = useState(false);
  const choices = useMemo(() => [
    ...lookups.roles.map(r => ({ key: 'ROLE:' + r.id, title: 'Role · ' + r.name })),
    ...lookups.users.map(u => ({ key: 'USER:' + u.id, title: 'User · ' + u.fullName }))
  ], [lookups]);
  const updateField = (index: number, changed: Partial<ApprovalField>) =>
    setData(old => ({ ...old, fields: old.fields.map((f, i) => i === index ? { ...f, ...changed } : f) }));
  const updateStep = (index: number, changed: Partial<ApprovalStep>) =>
    setData(old => ({ ...old, steps: old.steps.map((s, i) => i === index ? { ...s, ...changed } : s) }));
  const labelTarget = (target: ApproverTarget) =>
    choices.find(c => c.key === target.kind + ':' + target.id)?.title ?? target.kind + ' · ' + target.id.slice(0, 8);
  function changeTarget(index: number, item: number, title: string) {
    const choice = choices.find(c => c.title === title);
    if (!choice) return;
    const [kind, id] = choice.key.split(':');
    updateStep(index, { targets: data.steps[index].targets.map((t, j) =>
      j === item ? { kind: kind as 'ROLE' | 'USER', id } : t) });
  }
  async function save() {
    if (!data.name.trim() || !/^[A-Z][A-Z0-9_]{1,31}$/.test(data.code)) {
      toast.error('Enter a name and a valid unique uppercase code (minimum 2 characters).'); return;
    }
    if (data.steps.some(s => !s.targets.length) || !choices.length) {
      toast.error('Every level needs at least one valid reviewer or reviewer role.'); return;
    }
    setBusy(true);
    try {
      if (initial) await approvalsApi.updateType(initial.id, data);
      else await approvalsApi.createType(data);
      toast.success(initial ? 'New workflow version published.' : 'Request type created.');
      close(); await saved();
    } catch (e) { toast.error(message(e)); }
    finally { setBusy(false); }
  }
  return <Modal wide title={initial ? 'Edit request type' : 'New request type'}
    description="Configure dynamic fields and ordered approval levels. Changes create an immutable new version."
    close={close} footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={busy} onClick={() => void save()}>{busy ? 'Saving...' : initial ? 'Publish new version' : 'Create request type'}</Button></>}>
    <div className="ap-form-grid">
      <FieldRow label="Type name *"><Input value={data.name} maxLength={120}
        onChange={e => setData(old => ({ ...old, name: e.target.value }))}/></FieldRow>
      <FieldRow label="Unique code *"><Input value={data.code} disabled={!!initial} maxLength={32}
        onChange={e => setData(old => ({ ...old, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}/></FieldRow>
      <div className="ap-full"><FieldRow label="Description"><Textarea rows={2} value={data.description} maxLength={1000}
        onChange={e => setData(old => ({ ...old, description: e.target.value }))}/></FieldRow></div>
      <FieldRow label="Deadline (calendar days)"><NumberInput min={1} max={90} step={1} value={data.deadlineDays}
        onChange={e => setData(old => ({ ...old, deadlineDays: Number(e.target.value) }))}/></FieldRow>
      <label className="ap-live-option ap-live-toggle"><Checkbox checked={data.active}
        onChange={e => setData(old => ({ ...old, active: e.target.checked }))}/> Active request type</label>
    </div>
    <div className="ap-live-section"><div className="ap-live-section-heading"><h3>Custom form fields</h3>
      <Button disabled={data.fields.length >= 20} onClick={() => setData(old => ({ ...old, fields: [...old.fields, {
        key: 'field_' + (old.fields.length + 1), label: 'New field', type: 'text', required: false
      }] }))}>Add field</Button></div>
      {data.fields.length === 0 && <p>Requests will include title, branch and justification by default.</p>}
      {data.fields.map((f, index) => <div className="ap-live-config-row" key={index}>
        <div className="ap-live-config-fields">
          <FieldRow label="Key"><Input value={f.key} maxLength={40} onChange={e =>
            updateField(index, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}/></FieldRow>
          <FieldRow label="Label"><Input value={f.label} maxLength={100} onChange={e => updateField(index, { label: e.target.value })}/></FieldRow>
          <FieldRow label="Type"><Select label="Field type" value={f.type} options={fieldTypes}
            onChange={value => updateField(index, { type: value as ApprovalField['type'],
              options: value === 'select' || value === 'multi_select' ? (f.options?.length ? f.options : ['Option 1']) : undefined })}/></FieldRow>
        </div>
        {['select','multi_select'].includes(f.type) && <FieldRow label="Options (comma-separated)">
          <Input value={f.options?.join(', ') ?? ''} onChange={e => updateField(index, { options: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })}/>
        </FieldRow>}
        <div className="ap-live-row-actions"><label className="ap-live-option"><Checkbox checked={f.required}
          onChange={e => updateField(index, { required: e.target.checked })}/>Required</label>
          <Button onClick={() => setData(old => ({ ...old, fields: old.fields.filter((_, i) => i !== index) }))}>Remove</Button></div>
      </div>)}
    </div>
    <div className="ap-live-section"><div className="ap-live-section-heading"><h3>Approval workflow</h3>
      <Button disabled={data.steps.length >= 10} onClick={() => setData(old => ({ ...old,
        steps: [...old.steps, { mode: 'ANY', targets: choices.length ?
          [{ kind: choices[0].key.split(':')[0] as 'USER' | 'ROLE', id: choices[0].key.split(':')[1] }] : [] }] }))}>Add level</Button></div>
      <p>Levels run in sequence. Inside each level, select whether any one or all reviewers must approve.</p>
      {data.steps.map((s, index) => <div className="ap-live-config-row" key={index}>
        <div className="ap-live-section-heading"><strong>Level {index + 1}</strong>
          <Button disabled={data.steps.length === 1} onClick={() =>
            setData(old => ({ ...old, steps: old.steps.filter((_, i) => i !== index) }))}>Remove level</Button></div>
        <FieldRow label="Decision rule"><Select label="Level decision rule" value={s.mode === 'ANY' ? 'Any one reviewer can approve' : 'All reviewers must approve'}
          options={['Any one reviewer can approve','All reviewers must approve']}
          onChange={value => updateStep(index, { mode: value.startsWith('Any') ? 'ANY' : 'ALL' })}/></FieldRow>
        {s.targets.map((t, j) => <div className="ap-live-target-row" key={j}>
          <Select label={'Reviewer target ' + (j+1)} value={labelTarget(t)} options={choices.map(c => c.title)}
            onChange={value => changeTarget(index, j, value)}/>
          <Button onClick={() => updateStep(index, { targets: s.targets.filter((_, k) => k !== j) })}>Remove</Button>
        </div>)}
        <Button disabled={!choices.length || s.targets.length >= 12} onClick={() => {
          const first = choices[0]?.key.split(':');
          if (first) updateStep(index, { targets: [...s.targets, { kind: first[0] as 'USER' | 'ROLE', id: first[1] }] });
        }}>Add reviewer or role</Button>
      </div>)}
    </div>
    <p className="ap-compact-hint">Reviewer roles resolve to actual active users in the request's branch when the request is submitted. Requesters cannot approve their own requests. Historical requests keep their original route and form version.</p>
  </Modal>;
}
function RequestDetails({ item, close, refresh }: { item: ApprovalRequestRecord; close: () => void; refresh: () => Promise<void> }) {
  const toast = useToast();
  const [decision, setDecision] = useState<'APPROVED'|'REJECTED'|'CHANGES_REQUESTED'>('APPROVED');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  async function action(kind: 'decision' | 'cancel') {
    if (kind === 'cancel' && !window.confirm('Cancel this request? The action cannot be undone.')) return;
    setBusy(true);
    try {
      if (kind === 'cancel') await approvalsApi.cancel(item.id);
      else await approvalsApi.decision(item.id, decision, comment);
      toast.success(kind === 'cancel' ? 'Request cancelled.' : 'Review decision recorded.');
      close(); await refresh();
    } catch (e) { toast.error(message(e)); }
    finally { setBusy(false); }
  }
  return <><Modal wide title={item.title} description={item.code + ' · ' + item.type + ' · v' + item.version}
    close={close} footer={<><Button onClick={close}>Close</Button>
      {item.canCancel && <Button disabled={busy} onClick={() => void action('cancel')}>Cancel request</Button>}
      {item.canResubmit && <Button variant="primary" onClick={() => setResubmitOpen(true)}>Edit & resubmit</Button>}
    </>}>
    <div className="ap-live-summary"><div><span>Status</span><strong>{nice(item.status)}</strong></div>
      <div><span>Requester</span><strong>{item.requester}</strong></div>
      <div><span>Branch</span><strong>{item.branch}</strong></div>
      <div><span>Amount</span><strong>{money(item.amount)}</strong></div>
      <div><span>Submitted</span><strong>{showDate(item.createdAt)}</strong></div>
      <div><span>Due</span><strong>{showDate(item.dueAt)}</strong></div>
      <div><span>Workflow</span><strong>Step {Math.min(item.currentStep + 1, item.totalSteps)} of {item.totalSteps}</strong></div>
    </div>
    <div className="ap-live-section"><h3>Business justification</h3><p>{item.reason}</p>
      {item.fields.length > 0 && <div className="ap-live-summary">{item.fields.map(f => <div key={f.key}><span>{f.label}</span>
        <strong>{Array.isArray(item.values[f.key]) ? (item.values[f.key] as string[]).join(', ') : item.values[f.key] || '—'}</strong></div>)}</div>}</div>
    <div className="ap-live-section"><h3>Approval levels and decisions</h3>{item.steps.map((s,index) =>
      <div key={index} className="ap-live-level"><strong>Level {index + 1} · {s.mode === 'ANY' ? 'Any one approves' : 'All approve'}</strong>
        {item.reviews.filter(r => r.step === index).map(r =>
          <div key={r.id} className="ap-live-review"><span>{r.reviewer}</span>
            <span>{nice(r.status)}{r.comment && ' · ' + r.comment}</span></div>)}</div>)}</div>
    {item.canReview && <div className="ap-live-section"><h3>My decision</h3>
      <FieldRow label="Decision"><Select label="Approval decision" value={nice(decision)}
        options={['Approved','Rejected','Changes requested']}
        onChange={value => setDecision(value.toUpperCase().replace(/ /g, '_') as typeof decision)}/></FieldRow>
      <FieldRow label={decision === 'APPROVED' ? 'Comment (optional)' : 'Reason (required)'}>
        <Textarea rows={3} value={comment} maxLength={2000} onChange={e => setComment(e.target.value)}/></FieldRow>
      <Button variant="primary" disabled={busy || (decision !== 'APPROVED' && !comment.trim())} onClick={() => void action('decision')}>
        {busy ? 'Saving...' : 'Record decision'}</Button></div>}
    <div className="ap-live-section"><h3>Immutable event history</h3>{item.events.map(e =>
      <div key={e.id} className="ap-live-event"><strong>{nice(e.action)}</strong><span>{e.actor} · {new Date(e.at).toLocaleString()}</span>
        {e.comment && <p>{e.comment}</p>}</div>)}</div>
  </Modal>
  {resubmitOpen && <RequestForm previous={item} types={[{ id:item.typeId, code:item.typeCode, name:item.type,
      description:'',active:true,version:item.version,fields:item.fields,steps:item.steps,deadlineDays:3 }]}
      lookups={{ branches:[{id:item.branchId,name:item.branch}], users:[], roles:[],canConfigure:false,canExport:false }}
      close={() => setResubmitOpen(false)} saved={async () => { close(); await refresh(); }}/>}
  </>;
}
export default function ApprovalsLive() {
  const toast = useToast();
  const { user } = useAuth();
  const [tab,setTab] = useState<Tab>('My approvals');
  const [search,setSearch] = useState('');
  const [status,setStatus] = useState('All statuses');
  const [typeFilter,setTypeFilter] = useState('All types');
  const [lookups,setLookups] = useState<ApprovalLookups | null>(null);
  const [types,setTypes] = useState<ApprovalTypeRecord[]>([]);
  const [requests,setRequests] = useState<ApprovalRequestRecord[]>([]);
  const [total,setTotal] = useState(0);
  const [limited,setLimited] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [create,setCreate] = useState(false);
  const [typeEditor,setTypeEditor] = useState<ApprovalTypeRecord | 'new' | null>(null);
  const [details,setDetails] = useState<ApprovalRequestRecord | null>(null);
  const [exporting,setExporting] = useState(false);
  const reload = useCallback(async () => {
    try {
      const [lookupsResult,typesResult,requestsResult] = await Promise.all([
        approvalsApi.lookups(),approvalsApi.types(),approvalsApi.list()
      ]);
      setLookups(lookupsResult); setTypes(typesResult.types); setRequests(requestsResult.requests);
      setTotal(requestsResult.total); setLimited(requestsResult.limited); setError('');
    } catch (e) { setError(message(e)); }
    finally { setLoading(false); }
  },[]);
  useEffect(() => { void reload(); }, [reload]);
  const visible = useMemo(() => requests.filter(r => {
    const withinTab = tab !== 'My approvals' || r.reviews.some(v => v.reviewerId === user.id);
    const term = search.trim().toLowerCase();
    return withinTab && (!term || [r.code,r.title,r.requester,r.branch,r.type].some(v => v.toLowerCase().includes(term))) &&
      (status === 'All statuses' || r.status === status) && (typeFilter === 'All types' || r.type === typeFilter);
  }),[tab,requests,user.id,search,status,typeFilter]);
  const mine = requests.filter(r => r.canReview).length;
  const inReview = requests.filter(r => r.status === 'PENDING').length;
  const approved = requests.filter(r => r.status === 'APPROVED').length;
  const changes = requests.filter(r => r.status === 'CHANGES_REQUESTED').length;
  async function exportCsv() {
    if (!visible.length || !lookups?.canExport) return;
    setExporting(true);
    try { await exportApprovalCsv(visible.map(r => r.id)); toast.success('CSV exported and recorded in the security audit.'); }
    catch (e) { toast.error(message(e)); }
    finally { setExporting(false); }
  }
  return <div className="ap-page">
    <PageHeader eyebrow="WORKSPACE / APPROVAL WORKFLOWS" title="Requests & Approvals"
      badgeLabel="Connected to PostgreSQL"
      description="Request resources, review assigned decisions and track versioned approval workflows."
      actions={<>{lookups?.canExport && <Button disabled={exporting || !visible.length}
        icon={<ArrowDownToLine size={16}/>} onClick={() => void exportCsv()}>{exporting ? 'Exporting...' : 'Export CSV'}</Button>}
        {user.role.permissions.includes('approvals.request') && <Button variant="primary" icon={<Plus size={17}/>}
          disabled={!types.some(t => t.active)} onClick={() => setCreate(true)}>New request</Button>}</>}/>
    {error && <Card className="ap-live-error"><p>{error}</p><Button onClick={() => void reload()}>Retry</Button></Card>}
    <div className="ap-summary">
      <Card className="ap-stat"><div><span>Awaiting my approval</span><i className="ap-stat-icon amber"><Clock3 size={19}/></i></div><strong>{mine}</strong><small>Actionable in loaded records</small></Card>
      <Card className="ap-stat"><div><span>In review</span><i className="ap-stat-icon blue"><ClipboardList size={19}/></i></div><strong>{inReview}</strong><small>Pending workflows shown</small></Card>
      <Card className="ap-stat"><div><span>Approved</span><i className="ap-stat-icon mint"><CheckCheck size={19}/></i></div><strong>{approved}</strong><small>In loaded records</small></Card>
      <Card className="ap-stat"><div><span>Changes requested</span><i className="ap-stat-icon purple"><Filter size={19}/></i></div><strong>{changes}</strong><small>Awaiting resubmission</small></Card>
    </div>
    <Card className="ap-catalog">
      <SectionTabs tabs={tabs} selected={tab} counts={{'My approvals':mine}}
        onChange={value => {setTab(value as Tab); setSearch('');setStatus('All statuses');setTypeFilter('All types');}}/>
      {tab === 'Request types' ? <div className="ap-types-content"><div className="ap-types-heading">
        <div><h2>Configurable request types</h2><p>New versions do not modify existing requests.</p></div>
        {lookups?.canConfigure && <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setTypeEditor('new')}>New request type</Button>}</div>
        <div className="ap-types-list">{types.map(t => <button className="ap-type-row" key={t.id}
          onClick={() => lookups?.canConfigure ? setTypeEditor(t) : undefined}>
          <span className="ap-type-icon"><ClipboardList size={20}/></span>
          <span className="ap-type-copy"><strong>{t.name}</strong><span>{t.description}</span>
            <small>{t.code} · Version {t.version} · {t.steps.length} approval levels</small></span>
          <Badge tone={t.active ? 'green':'neutral'}>{t.active ? 'Active':'Inactive'}</Badge>
          <ArrowLeftRight size={18}/></button>)}
          {!types.length && <div className="ap-no-results">No request types configured.</div>}</div>
      </div> : <>
        <div className="ap-toolbar">
          <SearchInput className="ap-search" placeholder="Search requests, people, IDs..." aria-label="Search approval requests"
            value={search} onChange={e => setSearch(e.target.value)}/>
          <Select className="ap-filter-select" label="Filter status" value={status} options={statuses} onChange={setStatus}/>
          <Select className="ap-filter-select" label="Filter request type" value={typeFilter}
            options={['All types',...types.map(t => t.name)]} onChange={setTypeFilter}/>
          <span className="ap-toolbar-fill"/><Button onClick={() => {setSearch('');setStatus('All statuses');setTypeFilter('All types');}}>Clear filters</Button>
        </div>
        <div className="ap-table-scroll"><table className="ap-table"><thead><tr><th>REQUEST</th><th>REQUESTER</th><th>TYPE</th>
          <th>SUBMITTED / DUE</th><th>CURRENT STEP</th><th>STATUS</th><th/></tr></thead>
          <tbody>{visible.map(r => <tr key={r.id} role="button" tabIndex={0}
            onClick={() => setDetails(r)} onKeyDown={e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault();setDetails(r);}}}>
            <td><strong>{r.title}</strong><small>{r.code} · {money(r.amount)}</small></td>
            <td><div className="ap-person-cell"><span className="ap-live-avatar">{r.requester.trim().split(' ').map(p => p[0]).slice(0,2).join('')}</span>
              <span><strong>{r.requester}</strong><small>{r.branch}</small></span></div></td>
            <td className="ap-muted-td">{r.type}</td>
            <td><strong>{showDate(r.createdAt)}</strong><small>Due {showDate(r.dueAt)}</small></td>
            <td><strong>Step {Math.min(r.currentStep+1,r.totalSteps)} of {r.totalSteps}</strong>
              <small>Workflow v{r.version}</small></td>
            <td><Badge tone={r.status==='APPROVED'?'green':r.status==='PENDING'?'amber':'neutral'}>{nice(r.status)}</Badge></td>
            <td className="ap-row-arrow"><ArrowLeftRight size={18}/></td>
          </tr>)}</tbody></table></div>
        {!visible.length && <div className="ap-no-results"><ClipboardList size={25}/><h3>{loading ? 'Loading requests...' : 'No requests found'}</h3>
          <p>Try another filter or create your first request.</p></div>}
        <div className="ap-table-footer"><span>{visible.length} shown · {total} accessible request(s){limited ? ' · first 200 loaded' : ''}</span>
          <span>Select a row for decisions, details and timeline</span></div>
      </>}
    </Card>
    {limited && <p className="ap-live-notice">The most recent 200 requests are shown. KPIs and exports use only loaded records, not the complete history.</p>}
    {lookups && create && <RequestForm types={types} lookups={lookups} close={() => setCreate(false)} saved={reload}/>}
    {lookups && typeEditor && <TypeForm initial={typeEditor === 'new' ? undefined : typeEditor} lookups={lookups}
      close={() => setTypeEditor(null)} saved={reload}/>}
    {details && <RequestDetails item={details} close={() => setDetails(null)} refresh={reload}/>}
  </div>;
}
