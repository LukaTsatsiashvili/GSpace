import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Box, Check, CheckCheck, Clock3, Plus, UsersRound, X } from 'lucide-react';
import { Badge, Button, Card, Checkbox, Input, PageHeader, SearchInput, SectionTabs, Select, Textarea } from '../components/ui';
import { useAuth } from '../auth/AuthGate';
import { useToast } from '../components/toast';
import { asFilePayload } from './resource-api';
import { assignmentsApi, downloadEvidence, exportAssignmentsCsv, type Assignment, type AssignmentAsset, type AssignmentStatus, type AvailableAsset, type Lookups, type Receipt, type Summary } from './assignments-api';
import './assignments.css';

type Tab = 'All assignments' | 'Pending' | 'Active' | 'Returns' | 'History';
type Action = 'receipt' | 'request' | 'verify' | 'transfer' | 'cancel';
const tabs: Tab[] = ['All assignments', 'Pending', 'Active', 'Returns', 'History'];
const conditions = ['Excellent', 'Good', 'Fair', 'Damaged', 'Poor'];
const emptySummary: Summary = { active: 0, pending: 0, returns: 0, completed: 0 };
const emptyLookups: Lookups = { recipients: [], availableAssets: [], branches: [], canManage: false };

function fmt(raw: string | null | undefined) {
  if (!raw) return '—';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}
function errorText(error: unknown) { return error instanceof Error ? error.message : 'The request failed'; }
function personName(name: string) {
  return <span className="as-avatar" aria-hidden="true">{name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</span>;
}
function StatusPill({ status }: { status: AssignmentStatus }) {
  return <span className={'as-status as-status-' + status.toLowerCase().replace(/\s+/g, '-')}><span className="as-status-dot"/>{status}</span>;
}
function Field({ title, children }: { title: string; children: ReactNode }) {
  return <label className="as-field"><span>{title}</span>{children}</label>;
}
function useDialogEscape(onEscape: () => void) {
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handle = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('.ui-select[aria-expanded="true"]')) return;
      event.stopImmediatePropagation();
      onEscape();
    };
    document.addEventListener('keydown', handle);
    return () => { document.body.style.overflow = old; document.removeEventListener('keydown', handle); };
  }, [onEscape]);
}
function Modal({ title, subtitle, children, footer, close, wide = false }: {
  title: string; subtitle: string; children: ReactNode; footer: ReactNode; close: () => void; wide?: boolean
}) {
  useDialogEscape(close);
  return <div className="as-overlay as-center-overlay" onMouseDown={close}>
    <section className={'as-create-dialog ' + (wide ? 'as-handover-review' : '')} role="dialog" aria-modal="true" aria-label={title}
      onMouseDown={event => event.stopPropagation()}>
      <header className="as-dialog-header"><div><Badge tone="blue">ASSIGNMENTS</Badge><h2>{title}</h2><p>{subtitle}</p></div>
        <button type="button" className="as-close" onClick={close} aria-label="Close"><X size={17}/></button></header>
      <div className="as-dialog-content">{children}</div>
      <footer className="as-dialog-footer as-handover-footer">{footer}</footer>
    </section>
  </div>;
}
function personOption(p: { id: string; fullName: string }) {
  return p.fullName + ' · ' + p.id.slice(0, 6);
}
function CreateDialog({ lookups, close, done }: { lookups: Lookups; close: () => void; done: (message: string) => void }) {
  const [recipient, setRecipient] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectedPerson = lookups.recipients.find(p => personOption(p) === recipient);
  const available = lookups.availableAssets.filter(a => selectedPerson?.branchId === a.branchId);
  const selected = available.filter(a => chosen.includes(a.id));
  function toggle(assetId: string) {
    setChosen(current => current.includes(assetId) ? current.filter(x => x !== assetId) : [...current, assetId]);
  }
  async function submit() {
    if (!selectedPerson || !chosen.length) { setError('Select a recipient and at least one available resource'); setReview(false); return; }
    setBusy(true); setError('');
    try {
      const created = await assignmentsApi.issue({ recipientId: selectedPerson.id, resourceIds: chosen, dueAt: dueAt || null, notes });
      done('Assignment ' + created.code + ' issued; the recipient can confirm each item.');
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <Modal wide title={review ? 'Review new assignment' : 'Issue company resources'}
    subtitle="Select an employee and available company resources." close={close}
    footer={<><Button onClick={review ? () => setReview(false) : close}>{review ? 'Back to edit' : 'Cancel'}</Button>
      <Button variant="primary" disabled={busy} onClick={() => review ? void submit() :
        selectedPerson && chosen.length ? (setError(''), setReview(true)) : setError('Select a recipient and resources')}>
        {busy ? 'Issuing...' : review ? 'Confirm & issue' : 'Review handover'}</Button></>}>
    {review ? <>
      <div className="as-review-facts"><div><span>Recipient</span><strong>{selectedPerson?.fullName}</strong></div>
        <div><span>Resources</span><strong>{selected.length}</strong></div>
        <div><span>Return due</span><strong>{dueAt || 'Not set'}</strong></div></div>
      <h3 className="as-review-heading">Items to be confirmed</h3>
      <div className="as-confirmation-items">{selected.map(asset => <div className="as-confirmation-item" key={asset.id}>
        <span className="as-review-asset-icon"><Box size={19}/></span>
        <div><strong>{asset.name}</strong><small>{asset.assetCode} · {asset.condition}</small></div>
        <span className="as-needs-confirmation">Pending receipt</span></div>)}</div>
      {notes && <p className="as-review-notes">{notes}</p>}
      <p className="as-review-disclaimer">Confirming creates real database records and reserves the selected assets. The recipient must acknowledge each one.</p>
    </> : <>
      <Field title="Recipient"><Select label="Recipient" value={recipient || 'Select employee...'}
        options={['Select employee...', ...lookups.recipients.map(personOption)]}
        onChange={v => { setRecipient(v === 'Select employee...' ? '' : v); setChosen([]); setError(''); }}/></Field>
      <section className="as-asset-picker"><div className="as-asset-title"><strong>Available resources in recipient branch</strong><Badge>{chosen.length} selected</Badge></div>
        <div className="as-asset-list">{!selectedPerson && <p className="as-form-help">Choose an employee to list eligible resources.</p>}
          {selectedPerson && !available.length && <p className="as-form-help">No available resources in this branch.</p>}
          {available.map(asset => <label className={'as-asset-choice ' + (chosen.includes(asset.id) ? 'chosen' : '')} key={asset.id}>
            <Checkbox checked={chosen.includes(asset.id)} onChange={() => toggle(asset.id)} aria-label={'Select ' + asset.name}/>
            <span className="as-choice-text"><strong>{asset.name}</strong><small>{asset.assetCode} · Condition: {asset.condition}</small></span><Box size={17}/></label>)}</div>
      </section>
      <section className="as-return-details"><h3>Return & handover details</h3>
        <Field title="Return due date (optional)"><Input type="date" value={dueAt} onChange={event => setDueAt(event.target.value)}/></Field>
        <Field title="Handover notes"><Textarea rows={3} value={notes} placeholder="Optional comments"
          onChange={event => setNotes(event.target.value)}/></Field></section>
    </>}
    {error && <p className="as-form-error" role="alert">{error}</p>}
  </Modal>;
}
type Decision = 'Decide later' | 'Accept' | 'Report issue';
function ReceiptDialog({ assignment, close, done }: {
  assignment: Assignment; close: () => void; done: (message: string) => void
}) {
  const pending = assignment.assets.filter(item => item.receipt === 'PENDING');
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [damaged, setDamaged] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selected = pending.filter(item => decisions[item.itemId] && decisions[item.itemId] !== 'Decide later');
  async function submit() {
    setBusy(true); setError('');
    try {
      const entries: Receipt[] = [];
      for (const item of selected) {
        const file = files[item.itemId];
        if ((item.condition === 'Damaged' || damaged[item.itemId]) && !file) throw Error('Photo evidence is required for damaged item: ' + item.name);
        entries.push({ itemId: item.itemId, decision: decisions[item.itemId] === 'Accept' ? 'ACCEPT' : 'REPORT_ISSUE',
          notes, damageReported: !!damaged[item.itemId], ...(file ? { evidence: await asFilePayload(file) } : {}) });
      }
      if (!entries.length) throw Error('Choose at least one item to confirm');
      await assignmentsApi.receipt(assignment.id, entries);
      done(entries.length + ' receipt decision(s) recorded.');
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <Modal wide title={review ? 'Review receipt decisions' : 'Confirm received resources'}
    subtitle="Confirm each item individually; undecided items remain pending." close={close}
    footer={<><Button onClick={review ? () => setReview(false) : close}>{review ? 'Back to edit' : 'Cancel'}</Button>
      <Button variant="primary" disabled={busy} onClick={() => review ? void submit() :
        selected.length ? (setError(''), setReview(true)) : setError('Choose a receipt decision')}>
        {busy ? 'Saving...' : review ? 'Submit decisions' : 'Review confirmation'}</Button></>}>
    {review ? <>
      <div className="as-receipt-items">{selected.map(item => <div className="as-receipt-item" key={item.itemId}>
        <span className="as-review-asset-icon"><Box size={18}/></span><div className="as-receipt-item-copy">
          <strong>{item.name}</strong><small>{item.id} · {item.condition}</small></div>
        <span className={'as-decision-tag ' + (decisions[item.itemId] === 'Accept' ? 'accept' : 'issue')}>
          {decisions[item.itemId]}</span></div>)}</div>
      <p className="as-receipt-hint">These choices will be saved and added to the permanent custody audit trail.</p>
    </> : <>
      <div className="as-receipt-items">{pending.map(item => <div className="as-receipt-item-wrap" key={item.itemId}>
        <div className="as-receipt-item"><span className="as-review-asset-icon"><Box size={18}/></span>
          <div className="as-receipt-item-copy"><strong>{item.name}</strong><small>{item.id} · Condition: {item.condition}</small></div>
          <Select label={'Receipt decision for ' + item.name} value={decisions[item.itemId] || 'Decide later'}
            options={['Decide later', 'Accept', 'Report issue']}
            onChange={v => setDecisions(current => ({ ...current, [item.itemId]: v as Decision }))}/></div>
        {decisions[item.itemId] === 'Report issue' && <label className="as-asset-choice" style={{ margin: '0 13px 10px' }}>
          <Checkbox checked={!!damaged[item.itemId]} onChange={event => setDamaged(prev => ({ ...prev, [item.itemId]: event.target.checked }))}/>
          <span className="as-choice-text"><strong>This item is damaged</strong><small>Photo evidence will be required</small></span>
        </label>}
        {(decisions[item.itemId] === 'Report issue' || (item.condition === 'Damaged' && decisions[item.itemId] === 'Accept')) &&
          <div className="as-receipt-evidence"><label htmlFor={'as-evidence-' + item.itemId}>
            Photo evidence {item.condition === 'Damaged' || damaged[item.itemId] ? '(required)' : '(optional)'}</label>
            <input hidden type="file" id={'as-evidence-' + item.itemId} accept="image/jpeg,image/png,image/webp"
              onChange={event => setFiles(prev => ({ ...prev, [item.itemId]: event.target.files?.[0] }))}/>
            <Button onClick={() => document.getElementById('as-evidence-' + item.itemId)?.click()}>
              {files[item.itemId] ? 'Change photo' : 'Choose photo'}</Button>
            <small>{files[item.itemId]?.name ?? 'JPEG, PNG or WebP · max 2 MB'}</small></div>}
      </div>)}</div>
      <p className="as-receipt-hint">Photo evidence is optional except for damaged items. Reporting an issue requires manager review; it does not release the asset.</p>
      <Field title="Notes (optional)"><Textarea rows={3} value={notes} onChange={event => setNotes(event.target.value)}/></Field>
    </>}
    {error && <p className="as-form-error" role="alert">{error}</p>}
  </Modal>;
}
function WorkflowDialog({ action, assignment, lookups, close, done }: {
  action: Exclude<Action, 'receipt'>; assignment: Assignment; lookups: Lookups;
  close: () => void; done: (message: string) => void
}) {
  const availableItems = assignment.assets.filter(item =>
    action === 'verify' ? item.receipt === 'RETURN_REQUESTED' :
    action === 'cancel' ? ['PENDING', 'ISSUE_REPORTED'].includes(item.receipt) :
    item.receipt === 'ACCEPTED' || (action === 'request' && item.receipt === 'ISSUE_REPORTED'));
  const [chosen, setChosen] = useState<string[]>(availableItems.map(item => item.itemId));
  const [conditionsOnReturn, setConditions] = useState<Record<string, string>>(
    Object.fromEntries(availableItems.map(item => [item.itemId, item.condition])));
  const [target, setTarget] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const people = lookups.recipients.filter(p => p.branchId === assignment.branchId && p.id !== assignment.recipientId);
  const selectedTarget = people.find(p => personOption(p) === target);
  const labels: Record<typeof action, string> = {
    request: 'Request return', verify: 'Verify returned resources',
    transfer: 'Transfer to colleague', cancel: 'Cancel pending transfer'
  };
  function toggle(id: string) { setChosen(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }
  async function submit() {
    if (action !== 'cancel' && !chosen.length) { setError('Select at least one resource'); return; }
    if (action === 'transfer' && !selectedTarget) { setError('Choose the receiving employee'); return; }
    setBusy(true); setError('');
    try {
      if (action === 'request') await assignmentsApi.requestReturn(assignment.id, chosen);
      if (action === 'verify') await assignmentsApi.verifyReturn(assignment.id,
        chosen.map(itemId => ({ itemId, condition: conditionsOnReturn[itemId] })));
      if (action === 'transfer' && selectedTarget) await assignmentsApi.transfer(assignment.id,
        { recipientId: selectedTarget.id, itemIds: chosen, dueAt: dueAt || null, notes });
      if (action === 'cancel') await assignmentsApi.cancelTransfer(assignment.id);
      done(labels[action] + ' completed.');
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <Modal wide title={labels[action]} close={close}
    subtitle={action === 'verify' ? 'Confirm physical receipt and record condition before making items available.' :
      action === 'transfer' ? 'Current custodian stays responsible until the next employee accepts.' :
      action === 'cancel' ? 'Unconfirmed transfer items return to the original custodian.' :
      'Request a return; an authorized manager will verify the items.'}
    footer={<><Button onClick={close}>Cancel</Button><Button variant="primary" disabled={busy} onClick={() => void submit()}>
      {busy ? 'Saving...' : labels[action]}</Button></>}>
    {action === 'transfer' && <>
      <Field title="Receiving employee"><Select label="Receiving employee" value={target || 'Select employee...'}
        options={['Select employee...', ...people.map(personOption)]} onChange={setTarget}/></Field>
      <div className="as-form-grid"><Field title="Return due date (optional)"><Input type="date" value={dueAt} onChange={e => setDueAt(e.target.value)}/></Field></div>
      <Field title="Notes (optional)"><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}/></Field>
    </>}
    {action === 'cancel' ? <p className="as-receipt-hint">All unconfirmed items in this handover will be cancelled. This does not change the original custodian or free the resources.</p> :
      <section className="as-asset-picker"><div className="as-asset-title"><strong>Resources</strong><Badge>{chosen.length} selected</Badge></div>
        <div className="as-asset-list">{availableItems.map(item => <div key={item.itemId} className={'as-asset-choice ' + (chosen.includes(item.itemId) ? 'chosen' : '')}>
          <Checkbox id={'as-item-' + item.itemId} checked={chosen.includes(item.itemId)} onChange={() => toggle(item.itemId)}/>
          <label htmlFor={'as-item-' + item.itemId} className="as-choice-text">
            <strong>{item.name}</strong><small>{item.id} · {item.receipt.replace(/_/g, ' ')}</small></label>
          {action === 'verify' && chosen.includes(item.itemId) &&
            <Select label={'Return condition of ' + item.name} value={conditionsOnReturn[item.itemId]}
              options={conditions} onChange={value => setConditions(prev => ({ ...prev, [item.itemId]: value }))}/>}
        </div>)}</div></section>}
    {error && <p className="as-form-error" role="alert">{error}</p>}
  </Modal>;
}
function AssignmentDrawer({ assignment, lookups, userId, close, done }: {
  assignment: Assignment; lookups: Lookups; userId: string; close: () => void; done: (msg: string) => void
}) {
  const [action, setAction] = useState<Action | null>(null);
  const toast = useToast();
  const canManage = lookups.canManage && (lookups.branches.some(x => x.id === assignment.branchId));
  const canReceive = assignment.recipientId === userId && assignment.assets.some(item => item.receipt === 'PENDING');
  const canRequest = (canManage || assignment.recipientId === userId) &&
    assignment.assets.some(item => ['ACCEPTED', 'ISSUE_REPORTED'].includes(item.receipt));
  const canVerify = canManage && assignment.assets.some(item => item.receipt === 'RETURN_REQUESTED');
  const canTransfer = (canManage || assignment.recipientId === userId) && assignment.assets.some(item => item.receipt === 'ACCEPTED');
  const canCancel = assignment.kind === 'EMPLOYEE_TRANSFER' && assignment.assets.every(item =>
    ['PENDING', 'ISSUE_REPORTED'].includes(item.receipt)) && (canManage || assignment.recipientId === userId ||
      assignment.assets.some(item => item.sourceRecipientId === userId));
  useDialogEscape(() => { if (action) setAction(null); else close(); });
  return <div className="as-overlay as-right-overlay" onMouseDown={close}>
    <aside className="as-drawer" role="dialog" aria-modal="true" aria-label={'Assignment ' + assignment.code} onMouseDown={e => e.stopPropagation()}>
      <header className="as-dialog-header as-details-header"><div><Badge tone="blue">{assignment.code}</Badge>
        <h2>Assignment details</h2><p>Issue, acknowledgement, return and transfer history</p></div>
        <button type="button" className="as-close" onClick={close} aria-label="Close details"><X size={17}/></button></header>
      <div className="as-drawer-content">
        <div className="as-recipient"><div className="as-recipient-name">{personName(assignment.employee)}
          <div><strong>{assignment.employee}</strong><span>{assignment.branch}</span></div></div><StatusPill status={assignment.status}/></div>
        <section className="as-drawer-section"><h3>Assigned resources</h3><div className="as-assigned-list">
          {assignment.assets.map(item => <div className="as-assigned-asset" key={item.itemId}>
            <span className="as-box-icon"><Box size={17}/></span>
            <div><strong>{item.name}</strong><span>{item.id} · Issue condition: {item.condition}
              {item.returnCondition && ' · Return: ' + item.returnCondition}</span>
              {item.evidence && <Button variant="quiet" onClick={() => void downloadEvidence(assignment.id, item.itemId, item.evidence!.filename)
                .catch(error => toast.error(errorText(error)))}>Download receipt photo</Button>}</div>
            <span className={'as-receipt as-receipt-' + item.receipt.toLowerCase()}>{item.receipt.replace(/_/g, ' ')}</span>
          </div>)}</div></section>
        <section className="as-drawer-section"><h3>Custody workflow</h3><div className="as-workflow">
          <div className="as-workflow-step"><span className="as-workflow-mark"><Check size={15}/></span><strong>Issued</strong><small>{fmt(assignment.issued)}</small></div>
          <div className="as-workflow-step"><span className="as-workflow-mark">{assignment.status === 'Pending confirmation' ? '2' : <Check size={15}/>}</span><strong>Recipient confirms</strong><small>Per item</small></div>
          <div className="as-workflow-step"><span className="as-workflow-mark">{assignment.status === 'Completed' ? <Check size={15}/> : '3'}</span><strong>Returned / transferred</strong><small>{assignment.status}</small></div>
        </div></section>
        {assignment.notes && <section className="as-drawer-section"><h3>Handover notes</h3><p className="as-review-notes">{assignment.notes}</p></section>}
        <section className="as-drawer-section"><h3>Activity timeline</h3><ol className="as-timeline">{assignment.activity.map(ev =>
          <li key={ev.id}><strong>{ev.title}</strong><span>{ev.detail}</span></li>)}</ol></section>
        <p className="as-detail-hint">Every custody action is recorded in the database. Returned assets become available only after manager verification.</p>
      </div>
      <footer className="as-drawer-footer as-actions-footer"><Button onClick={close}>Close</Button>
        <div>{canReceive && <Button variant="primary" onClick={() => setAction('receipt')}>Review receipt</Button>}
          {canRequest && <Button onClick={() => setAction('request')}>Request return</Button>}
          {canVerify && <Button variant="primary" onClick={() => setAction('verify')}>Verify return</Button>}
          {canTransfer && <Button onClick={() => setAction('transfer')}>Transfer</Button>}
          {canCancel && <Button onClick={() => setAction('cancel')}>Cancel transfer</Button>}</div>
      </footer>
      {action === 'receipt' && <ReceiptDialog assignment={assignment} close={() => setAction(null)} done={done}/>}
      {action && action !== 'receipt' && <WorkflowDialog action={action} assignment={assignment} lookups={lookups} close={() => setAction(null)} done={done}/>}
    </aside>
  </div>;
}
export default function AssignmentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [lookups, setLookups] = useState<Lookups>(emptyLookups);
  const [truncated, setTruncated] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('All assignments');
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('All branches');
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [creating, setCreating] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const [list, lookup] = await Promise.all([assignmentsApi.list(), assignmentsApi.lookups()]);
      setAssignments(list.assignments); setSummary(list.summary);
      setLookups(lookup); setTruncated(list.truncated); setError('');
    } catch (e) { setError(errorText(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const done = (message: string) => {
    setSelected(null); setCreating(false); toast.success(message); void refresh();
  };
  const branches = useMemo(() => ['All branches', ...Array.from(new Set([
    ...lookups.branches.map(x => x.name), ...assignments.map(x => x.branch)
  ]))], [lookups.branches, assignments]);
  const visible = useMemo(() => assignments.filter(a => {
    const matchTab = tab === 'All assignments' ||
      (tab === 'Pending' && a.status === 'Pending confirmation') ||
      (tab === 'Active' && ['Active', 'Partially accepted', 'Transfer pending'].includes(a.status)) ||
      (tab === 'Returns' && ['Return requested', 'Issue reported'].includes(a.status)) ||
      (tab === 'History' && ['Completed', 'Cancelled'].includes(a.status));
    const term = search.trim().toLowerCase();
    const matchSearch = !term || [a.code, a.employee, a.branch, ...a.assets.flatMap(x => [x.name, x.id])]
      .some(x => x.toLowerCase().includes(term));
    return matchTab && matchSearch && (branch === 'All branches' || a.branch === branch);
  }), [assignments, tab, search, branch]);
  const canExport = user.role.permissions.includes('reports.export');
  async function exportCsv() {
    if (!canExport || exporting || !visible.length) return;
    setExporting(true);
    try {
      await exportAssignmentsCsv(visible.map(assignment => assignment.id));
      toast.success('Assignment CSV exported. The download was recorded in Security Audit.');
    } catch (error) { toast.error(errorText(error)); }
    finally { setExporting(false); }
  }
  return <div className="as-page">
    <PageHeader eyebrow="ASSET LIFECYCLE / HANDOVERS" title="Assignments" badgeLabel="Connected to PostgreSQL"
      description="Issue, acknowledge, transfer and return company assets with a permanent custody trail."
      actions={<>{canExport && <Button icon={<ArrowDownToLine size={16}/>} disabled={exporting || !visible.length}
        onClick={() => { void exportCsv(); }}>{exporting ? 'Exporting...' : 'Export CSV'}</Button>}
        {lookups.canManage && <Button variant="primary" icon={<Plus size={17}/>} onClick={() => setCreating(true)}>New assignment</Button>}</>}/>
    <div className="as-summary">
      <Card className="as-stat"><div className="as-stat-top"><span>Active assignments</span><span className="as-stat-icon mint"><UsersRound size={19}/></span></div><strong>{summary.active}</strong><small>Assignments in use</small></Card>
      <Card className="as-stat"><div className="as-stat-top"><span>Awaiting confirmation</span><span className="as-stat-icon amber"><Clock3 size={19}/></span></div><strong>{summary.pending}</strong><small>Recipient receipts pending</small></Card>
      <Card className="as-stat"><div className="as-stat-top"><span>Return requests</span><span className="as-stat-icon blue"><ArrowLeftRight size={19}/></span></div><strong>{summary.returns}</strong><small>Manager verification pending</small></Card>
      <Card className="as-stat"><div className="as-stat-top"><span>Completed handovers</span><span className="as-stat-icon purple"><CheckCheck size={19}/></span></div><strong>{summary.completed}</strong><small>Full history preserved</small></Card>
    </div>
    <Card className="as-catalog">
      <SectionTabs tabs={tabs} selected={tab} onChange={t => setTab(t as Tab)}/>
      <div className="as-toolbar"><SearchInput className="as-search" placeholder="Search employee, asset or ID..."
        value={search} onChange={e => setSearch(e.target.value)}/>
        <Select className="as-branch-select" label="Filter branch" options={branches} value={branch} onChange={setBranch}/>
        <div className="as-toolbar-spacer"/><Button onClick={() => { setSearch(''); setBranch('All branches'); }}>Clear filters</Button>
        <Button onClick={() => void refresh()}>Refresh</Button></div>
      {loading && <p className="as-form-help" style={{ padding: 20 }}>Loading real assignments...</p>}
      {error && <p className="as-form-error" style={{ padding: 20 }} role="alert">{error} <Button onClick={() => void refresh()}>Retry</Button></p>}
      <div className="as-table-scroll"><table className="as-table"><thead><tr>
        <th>ASSIGNMENT</th><th>EMPLOYEE</th><th>RESOURCES</th><th>ISSUED</th><th>RETURN DUE</th><th>STATUS</th><th aria-label="Actions"/></tr></thead>
        <tbody>{visible.map(a => <tr key={a.id} role="button" tabIndex={0} onClick={() => setSelected(a)}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(a); } }}>
          <td><strong>{a.code}</strong><small>{a.branch}</small></td>
          <td><div className="as-table-person">{personName(a.employee)}<strong>{a.employee}</strong></div></td>
          <td><strong>{a.assets[0]?.name ?? '—'}</strong>{a.assets.length > 1 && <small>+{a.assets.length - 1} more</small>}</td>
          <td className="as-muted-cell">{fmt(a.issued)}</td><td className="as-muted-cell">{fmt(a.returnDue)}</td>
          <td><StatusPill status={a.status}/></td><td className="as-row-icon"><ArrowLeftRight size={18}/></td>
        </tr>)}</tbody></table></div>
      {!loading && !error && !visible.length && <div className="as-empty"><Box size={27}/><strong>No assignments found</strong>
        <span>No records match the current filters.</span></div>}
      <div className="as-catalog-foot"><span>{visible.length} actual assignment{visible.length === 1 ? '' : 's'}{truncated && ' · showing latest 200 only'}</span>
        <span>Select a row for history and available actions</span></div>
    </Card>
    {truncated && <p className="as-page-preview"><Badge tone="amber">Limited result</Badge> Only the latest 200 handovers and their summary are displayed.</p>}
    {selected && <AssignmentDrawer key={selected.id} assignment={selected} lookups={lookups} userId={user.id}
      close={() => setSelected(null)} done={done}/>}
    {creating && <CreateDialog lookups={lookups} close={() => setCreating(false)} done={done}/>}
  </div>;
}
