import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Box, CalendarDays, Check, CheckCheck, Clock3, FileCheck2, Plus, UsersRound, X } from 'lucide-react';
import { Badge, Button, Card, Checkbox, Input, PageHeader, SearchInput, SectionTabs, Select, Textarea } from '../components/ui';
import './assignments.css';

type AssignmentStatus = 'Pending confirmation' | 'Active' | 'Return requested' | 'Completed' | 'Partially accepted';
type AssignmentTab = 'All assignments' | 'Pending' | 'Active' | 'Returns' | 'History';
type HandoverType = 'Issue from branch' | 'Employee-to-employee';
type Asset = { id: string; name: string; condition: string; receipt?: 'Pending' | 'Awaiting' | 'Accepted' };
type Assignment = {
  id: string; branch: string; employee: string; issued: string; returnDue?: string;
  status: AssignmentStatus; assets: Asset[]; activity: { title: string; detail: string }[];
};

const assignments: Assignment[] = [
  {
    id: 'ASG-00248', branch: 'Tbilisi Store 01', employee: 'Nino Kapanadze', issued: 'Nov 05, 2026',
    returnDue: 'Nov 25, 2026', status: 'Pending confirmation',
    assets: [{ id: 'AST-00123', name: 'Dell UltraSharp U2723QE', condition: 'Good', receipt: 'Pending' }, { id: 'AST-00119', name: 'Samsung Galaxy Tab S9', condition: 'Good', receipt: 'Awaiting' }],
    activity: [{ title: 'Issued by Sandro P.', detail: 'Awaiting recipient confirmation' }, { title: 'Assignment created', detail: 'Nov 05, 2026 · Full audit trail retained' }]
  },
  {
    id: 'ASG-00247', branch: 'Head Office', employee: 'Giorgi Maisuradze', issued: 'Nov 02, 2026',
    status: 'Active', assets: [{ id: 'AST-00122', name: 'Apple iPhone 15', condition: 'Good' }],
    activity: [{ title: 'Accepted by recipient', detail: 'Nov 02, 2026' }, { title: 'Assignment created', detail: 'Nov 02, 2026 · Full audit trail retained' }]
  },
  {
    id: 'ASG-00246', branch: 'Head Office', employee: 'Sandro Papiashvili', issued: 'Oct 28, 2026',
    returnDue: 'Nov 15, 2026', status: 'Return requested',
    assets: [{ id: 'AST-00124', name: 'Lenovo ThinkPad T14', condition: 'Excellent' }, { id: 'AST-00114', name: 'Dell Docking Station', condition: 'Excellent' }],
    activity: [{ title: 'Return requested', detail: 'Nov 04, 2026' }, { title: 'Assignment created', detail: 'Oct 28, 2026 · Full audit trail retained' }]
  },
  {
    id: 'ASG-00245', branch: 'Batumi Store 01', employee: 'Mariam Beridze', issued: 'Oct 15, 2026',
    returnDue: 'Oct 30, 2026', status: 'Completed',
    assets: [{ id: 'AST-00109', name: 'HP EliteBook 840', condition: 'Good' }],
    activity: [{ title: 'Returned and verified by branch manager', detail: 'Oct 30, 2026' }, { title: 'Assignment created', detail: 'Oct 15, 2026 · Full audit trail retained' }]
  },
  {
    id: 'ASG-00244', branch: 'Kutaisi Store 01', employee: 'Luka Dolidze', issued: 'Nov 03, 2026',
    status: 'Partially accepted',
    assets: [{ id: 'AST-00108', name: 'POS Tablet', condition: 'Good', receipt: 'Accepted' }, { id: 'AST-00107', name: 'Barcode Scanner', condition: 'Good', receipt: 'Awaiting' }],
    activity: [{ title: 'One resource accepted', detail: 'Nov 03, 2026 · Second resource awaiting confirmation' }, { title: 'Assignment created', detail: 'Nov 03, 2026 · Full audit trail retained' }]
  }
];

const availableAssets: Asset[] = [
  { id: 'AST-00123', name: 'Dell UltraSharp U2723QE', condition: 'Good' },
  { id: 'AST-00119', name: 'Samsung Galaxy Tab S9', condition: 'Good' },
  { id: 'AST-00118', name: 'Cisco Catalyst 9200', condition: 'Fair' },
  { id: 'AST-00116', name: 'Logitech MX Keys', condition: 'Excellent' },
  { id: 'AST-00115', name: 'Barcode Scanner', condition: 'Good' }
];

const branches = ['All branches', 'Head Office', 'Tbilisi Store 01', 'Kutaisi Store 01', 'Batumi Store 01'];
const recipients = ['Select employee...', 'Nino Kapanadze', 'Giorgi Maisuradze', 'Sandro Papiashvili', 'Mariam Beridze', 'Luka Dolidze'];
const tabs: AssignmentTab[] = ['All assignments', 'Pending', 'Active', 'Returns', 'History'];

function useDialogEscape(onEscape: () => void) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
      // A shared Select should dismiss its own menu before the surrounding dialog.
      if (document.querySelector('.ui-select[aria-expanded="true"]')) return;
      event.stopImmediatePropagation();
      onEscape();
    }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); };
  }, [onEscape]);
}

function Initials({ name }: { name: string }) {
  return <span className="as-avatar" aria-hidden="true">{name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span>;
}

function StatusPill({ status }: { status: AssignmentStatus }) {
  const className = status.toLowerCase().replace(/\s+/g, '-');
  return <span className={'as-status as-status-' + className}><span className="as-status-dot"/>{status}</span>;
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return <label className="as-field"><span>{title}</span>{children}</label>;
}

function PreviewNotice({ heading, body, close }: { heading: string; body: string; close: () => void }) {
  return <div className="as-preview-layer" onMouseDown={close}><section role="alertdialog" aria-modal="true" aria-labelledby="as-preview-title" className="as-preview" onMouseDown={event => event.stopPropagation()}>
    <span className="as-preview-icon"><FileCheck2 size={23}/></span>
    <h3 id="as-preview-title">{heading}</h3><p>{body}</p>
    <Button variant="primary" onClick={close}>Got it</Button>
  </section></div>;
}

function NewAssignmentDialog({ close }: { close: () => void }) {
  const [type, setType] = useState<HandoverType>('Issue from branch');
  const [recipient, setRecipient] = useState('Select employee...');
  const [chosen, setChosen] = useState<string[]>([]);
  const [due, setDue] = useState('');
  const [condition, setCondition] = useState('Good');
  const [notes, setNotes] = useState('');
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);

  useDialogEscape(() => { if (preview) setPreview(false); else if (review) setReview(false); else close(); });

  function toggle(id: string) {
    setChosen(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
    setError('');
  }

  function showReview() {
    if (recipient === 'Select employee...') { setError('Please choose the recipient.'); return; }
    if (!chosen.length) { setError('Select at least one available resource.'); return; }
    setError('');
    setReview(true);
  }
  const selectedAssets = availableAssets.filter(asset => chosen.includes(asset.id));

  return <div className="as-overlay as-center-overlay" onMouseDown={close}>
    <section className={`as-create-dialog ${review ? "as-handover-review" : ""}`} role="dialog" aria-modal="true" aria-labelledby="as-create-title" onMouseDown={event => event.stopPropagation()}>
      <header className="as-dialog-header"><div><Badge tone="blue">{review ? "HANDOVER PREVIEW" : "NEW ASSIGNMENT"}</Badge><h2 id="as-create-title">{review ? "Review new assignment" : "Issue company resources"}</h2><p>{review ? "Ready to issue · confirmation required" : "Create a handover that the recipient confirms item by item."}</p></div><button className="as-close" type="button" aria-label="Close new assignment" onClick={close}><X size={17}/></button></header>
      <div className="as-dialog-content">
        {review ? <>
          <div className="as-review-facts">
            <div><span>Type</span><strong>{type === 'Issue from branch' ? 'New issue' : 'Employee-to-employee'}</strong></div>
            <div><span>Recipient</span><strong>{recipient}</strong></div>
            <div><span>Selected assets</span><strong>{selectedAssets.length}</strong></div>
            <div><span>Return due</span><strong>{due ? new Date(due + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Not set'}</strong></div>
            <div><span>Condition on issue</span><strong>{condition}</strong></div>
          </div>
          <h3 className="as-review-heading">Items for confirmation</h3>
          <div className="as-confirmation-items">{selectedAssets.map(asset => <div className="as-confirmation-item" key={asset.id}>
            <span className="as-review-asset-icon"><Box size={19}/></span>
            <div><strong>{asset.name}</strong><small>{asset.id}</small></div>
            <span className="as-needs-confirmation">Needs confirmation</span>
          </div>)}</div>
          {notes.trim() && <p className="as-review-notes"><strong>Handover notes:</strong> {notes.trim()}</p>}
          <p className="as-review-disclaimer">In production, the recipient will be notified and can accept each resource separately. No automatic approval is performed when a deadline expires. This preview does not send notifications or create an assignment.</p>
        </> : <>
          <Field title="Handover type"><div className="as-type-switch" role="group" aria-label="Handover type">
            {(['Issue from branch', 'Employee-to-employee'] as HandoverType[]).map(option => <button type="button" key={option} aria-pressed={type === option} className={type === option ? 'selected' : ''} onClick={() => setType(option)}>{option}</button>)}
          </div></Field>
          <Field title="Recipient"><Select label="Recipient" value={recipient} options={recipients} onChange={value => { setRecipient(value); setError(''); }}/></Field>
          <section className="as-asset-picker"><div className="as-asset-title"><strong>Choose available resources</strong><Badge>{chosen.length} selected</Badge></div>
            <div className="as-asset-list">{availableAssets.map(asset => <label className={'as-asset-choice ' + (chosen.includes(asset.id) ? 'chosen' : '')} key={asset.id}>
              <Checkbox checked={chosen.includes(asset.id)} onChange={() => toggle(asset.id)} aria-label={'Select ' + asset.name}/>
              <span className="as-choice-text"><strong>{asset.name}</strong><small>{asset.id} · Condition: {asset.condition}</small></span>
              <Box size={17} aria-hidden="true"/>
            </label>)}</div>
          </section>
          <section className="as-return-details"><h3>Return &amp; handover details</h3>
            <div className="as-form-grid"><Field title="Return due date (optional)"><Input type="date" value={due} onChange={event => setDue(event.target.value)} aria-label="Return due date"/></Field>
              <Field title="Condition on issue"><Select label="Condition on issue" value={condition} options={['Excellent', 'Good', 'Fair', 'Damaged', 'Poor']} onChange={setCondition}/></Field></div>
            <Field title="Handover notes"><Textarea rows={3} placeholder="Optional comments" value={notes} onChange={event => setNotes(event.target.value)}/></Field>
          </section>
          {error && <p className="as-form-error" role="alert">{error}</p>}
        </>}
      </div>
      <footer className="as-dialog-footer as-handover-footer">
        {review ? <Button onClick={() => setReview(false)}>Back to edit</Button> : <span>Design-only workflow · no records saved</span>}
        <Button variant="primary" onClick={() => review ? setPreview(true) : showReview()}>{review ? 'Preview issue ✓' : 'Review handover →'}</Button>
      </footer>
      {preview && <PreviewNotice heading="Issue preview ready" body="The handover has been reviewed but has not been issued. Database records, notifications and audit events are not created in this UI-only prototype." close={() => setPreview(false)}/>}
    </section>
  </div>;
}


type ReceiptDecision = 'Accept' | 'Report issue' | 'Decide later';
const receiptOptions: ReceiptDecision[] = ['Accept', 'Report issue', 'Decide later'];

function ReceiptConfirmationDialog({ assignment, close }: { assignment: Assignment; close: () => void }) {
  // All selections and files remain local to this design preview.
  const [decisions, setDecisions] = useState<Record<string, ReceiptDecision>>(() =>
    Object.fromEntries(assignment.assets.map(asset => [asset.id, asset.receipt === 'Accepted' ? 'Accept' : 'Decide later']))
  );
  const [evidence, setEvidence] = useState<Record<string, File | undefined>>({});
  const [notes, setNotes] = useState('');
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');

  const updateDecision = (id: string, value: ReceiptDecision) => {
    setDecisions(current => ({ ...current, [id]: value }));
    setError('');
  };
  const previewReceipt = () => {
    const missing = assignment.assets.find(asset => asset.condition === 'Damaged' && decisions[asset.id] !== 'Decide later' && !evidence[asset.id]);
    if (missing) { setError('Photo evidence is required for a damaged resource: ' + missing.name); return; }
    setReview(true);
    setError('');
  };

  return <div className="as-overlay as-center-overlay as-receipt-overlay" onMouseDown={close}>
    <section className="as-receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="as-receipt-title" onMouseDown={event => event.stopPropagation()}>
      <header className="as-dialog-header"><div>
        <Badge tone="blue">{review ? 'RECEIPT PREVIEW' : 'RECEIPT CONFIRMATION'}</Badge>
        <h2 id="as-receipt-title">{review ? 'Review confirmation choices' : 'Review received resources'}</h2>
        <p>{review ? 'Confirmation preview · no changes saved' : 'Each item can be accepted or marked with an issue separately.'}</p>
      </div><button type="button" className="as-close" aria-label="Close receipt confirmation" onClick={close}><X size={17}/></button></header>
      <div className="as-receipt-content">
        {review ? <>
          <p className="as-form-help">Review the item-by-item decisions below. Production confirmation will require authenticated permissions and auditing.</p>
          <div className="as-receipt-items">{assignment.assets.map(asset => <div className="as-receipt-item" key={asset.id}>
            <span className="as-review-asset-icon"><Box size={18}/></span>
            <div className="as-receipt-item-copy"><strong>{asset.name}</strong><small>{asset.id} · Reported condition: {asset.condition}</small>
              {evidence[asset.id] && <small>Local photo: {evidence[asset.id]?.name}</small>}
            </div>
            <span className={'as-decision-tag ' + (decisions[asset.id] === 'Accept' ? 'accept' : decisions[asset.id] === 'Report issue' ? 'issue' : 'later')}>{decisions[asset.id]}</span>
          </div>)}</div>
          {notes.trim() && <p className="as-review-notes"><strong>Notes:</strong> {notes.trim()}</p>}
          <p className="as-receipt-hint">Preview only. No employee acceptance, issue report, file upload or notification has been saved.</p>
        </> : <>
          <div className="as-receipt-items">{assignment.assets.map(asset => <div className="as-receipt-item-wrap" key={asset.id}>
            <div className="as-receipt-item">
              <span className="as-review-asset-icon"><Box size={18}/></span>
              <div className="as-receipt-item-copy"><strong>{asset.name}</strong><small>Reported condition: {asset.condition}</small></div>
              <Select label={'Receipt decision for ' + asset.name} value={decisions[asset.id]} options={receiptOptions} onChange={value => updateDecision(asset.id, value as ReceiptDecision)}/>
            </div>
            {(decisions[asset.id] === 'Report issue' || (asset.condition === 'Damaged' && decisions[asset.id] !== 'Decide later')) && <div className="as-receipt-evidence">
              <label htmlFor={'as-evidence-' + asset.id}>Photo evidence {asset.condition === 'Damaged' ? '(required for damaged items)' : '(optional)'}</label>
              <Input id={'as-evidence-' + asset.id} type="file" accept="image/*" onChange={event => setEvidence(current => ({ ...current, [asset.id]: event.target.files?.[0] }))}/>
              <small>Selected files are only displayed locally, never uploaded.</small>
            </div>}
          </div>)}</div>
          <p className="as-receipt-hint">Photo evidence is optional for normal condition, required for damaged items. A reported issue is recorded for manager review in the future production workflow.</p>
          <label className="as-field as-receipt-notes"><span>Notes (optional)</span><Textarea placeholder="Add context about the handover" rows={3} value={notes} onChange={event => setNotes(event.target.value)}/></label>
          {error && <p className="as-form-error" role="alert">{error}</p>}
        </>}
      </div>
      <footer className="as-dialog-footer as-receipt-footer">
        <Button onClick={() => review ? setReview(false) : close()}>{review ? 'Back to edit' : 'Back'}</Button>
        <Button variant="primary" onClick={() => review ? close() : previewReceipt()}>{review ? 'Close preview' : 'Preview confirmation'}</Button>
      </footer>
    </section>
  </div>;
}

function AssignmentDrawer({ assignment, close }: { assignment: Assignment; close: () => void }) {
  const [action, setAction] = useState<string | null>(null);
  useDialogEscape(() => { if (action) setAction(null); else close(); });

  const completed = assignment.status === 'Completed';
  const confirmed = completed || assignment.status === 'Active' || assignment.status === 'Return requested';
  const primaryAction = assignment.status === 'Pending confirmation' || assignment.status === 'Partially accepted' ? 'Review receipt' :
    assignment.status === 'Return requested' ? 'Verify return' : assignment.status === 'Active' ? 'Request return' : null;

  return <div className="as-overlay as-right-overlay" onMouseDown={close}><aside className="as-drawer" role="dialog" aria-modal="true" aria-labelledby="as-details-title" onMouseDown={event => event.stopPropagation()}>
    <header className="as-dialog-header as-details-header"><div><Badge tone="blue">{assignment.id}</Badge><h2 id="as-details-title">Assignment details</h2><p>Issue, acceptance and return history</p></div><button className="as-close" aria-label="Close assignment details" onClick={close}><X size={17}/></button></header>
    <div className="as-drawer-content">
      <div className="as-recipient"><div className="as-recipient-name"><Initials name={assignment.employee}/><div><strong>{assignment.employee}</strong><span>{assignment.branch}</span></div></div><StatusPill status={assignment.status}/></div>
      <section className="as-drawer-section"><h3>Assigned resources</h3><div className="as-assigned-list">{assignment.assets.map(asset => <div className="as-assigned-asset" key={asset.id}><span className="as-box-icon"><Box size={17}/></span><div><strong>{asset.name}</strong><span>Condition on issue: {asset.condition}</span></div>{asset.receipt && <span className={'as-receipt as-receipt-' + asset.receipt.toLowerCase()}>{asset.receipt}</span>}</div>)}</div></section>
      <section className="as-drawer-section"><h3>Custody workflow</h3><div className="as-workflow">
        <div className="as-workflow-step"><span className="as-workflow-mark"><Check size={15}/></span><strong>Issued</strong><small>{assignment.issued}</small></div>
        <div className="as-workflow-step"><span className="as-workflow-mark">{confirmed ? <Check size={15}/> : '2'}</span><strong>Recipient confirms</strong><small>{confirmed ? 'Recorded' : assignment.status === 'Partially accepted' ? 'Partly recorded' : 'Pending confirmation'}</small></div>
        <div className="as-workflow-step"><span className="as-workflow-mark">{completed ? <Check size={15}/> : '3'}</span><strong>Return verified</strong><small>{completed ? 'Completed' : 'By manager'}</small></div>
      </div></section>
      <section className="as-drawer-section"><h3>Activity timeline</h3><ol className="as-timeline">{assignment.activity.map(item => <li key={item.title}><strong>{item.title}</strong><span>{item.detail}</span></li>)}</ol></section>
      <p className="as-detail-hint">Each resource is confirmed separately. Condition is recorded at issue and reviewed again when returned. A PDF handover record is part of the approved production workflow.</p>
    </div>
    <footer className="as-drawer-footer"><Button onClick={close}>Close</Button>{primaryAction && <Button variant="primary" onClick={() => setAction(primaryAction)}>{primaryAction}</Button>}</footer>
    {action === 'Review receipt' ? <ReceiptConfirmationDialog assignment={assignment} close={() => setAction(null)}/> :
      action && <PreviewNotice heading={action} body={'The ' + action.toLowerCase() + ' workflow will be enabled after the authenticated API, role permissions and audit events are implemented. No record has been updated.'} close={() => setAction(null)}/>}
  </aside></div>;
}

export default function AssignmentsPage() {
  const [tab, setTab] = useState<AssignmentTab>('All assignments');
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('All branches');
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [creating, setCreating] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const visible = useMemo(() => assignments.filter(assignment => {
    const tabMatch = tab === 'All assignments' ||
      (tab === 'Pending' && assignment.status === 'Pending confirmation') ||
      (tab === 'Active' && (assignment.status === 'Active' || assignment.status === 'Partially accepted')) ||
      (tab === 'Returns' && assignment.status === 'Return requested') ||
      (tab === 'History' && assignment.status === 'Completed');
    const term = search.trim().toLowerCase();
    const searchMatch = !term || [assignment.id, assignment.employee, assignment.branch, ...assignment.assets.flatMap(asset => [asset.name, asset.id])].some(value => value.toLowerCase().includes(term));
    return tabMatch && searchMatch && (branch === 'All branches' || assignment.branch === branch);
  }), [tab, search, branch]);

  const clearFilters = () => { setSearch(''); setBranch('All branches'); };

  return <div className="as-page">
    <PageHeader eyebrow="ASSET LIFECYCLE / HANDOVERS" title="Assignments" badgeLabel="UI concept · sample data" description="Issue, acknowledge and return company assets with a clear custody trail." actions={<><Button icon={<ArrowDownToLine size={16}/>} onClick={() => setExportOpen(true)}>Export</Button><Button variant="primary" icon={<Plus size={17}/>} onClick={() => setCreating(true)}>New assignment</Button></>}/>
    <div className="as-summary">
      <Card className="as-stat"><div className="as-stat-top"><span>Active assignments</span><span className="as-stat-icon mint"><UsersRound size={19}/></span></div><strong>164</strong><small>Resources currently in use</small></Card>
      <Card className="as-stat"><div className="as-stat-top"><span>Awaiting confirmation</span><span className="as-stat-icon amber"><Clock3 size={19}/></span></div><strong>12</strong><small>Employees have pending receipts</small></Card>
      <Card className="as-stat"><div className="as-stat-top"><span>Return requests</span><span className="as-stat-icon blue"><ArrowLeftRight size={19}/></span></div><strong>7</strong><small>Awaiting manager verification</small></Card>
      <Card className="as-stat"><div className="as-stat-top"><span>Completed handovers</span><span className="as-stat-icon purple"><CheckCheck size={19}/></span></div><strong>93</strong><small>Full history preserved</small></Card>
    </div>
    <Card className="as-catalog">
      <SectionTabs tabs={tabs} selected={tab} onChange={next => setTab(next as AssignmentTab)}/>
      <div className="as-toolbar"><SearchInput className="as-search" aria-label="Search assignments" placeholder="Search employee, asset or ID..." value={search} onChange={event => setSearch(event.target.value)}/><Select className="as-branch-select" label="Filter branch" options={branches} value={branch} onChange={setBranch}/><div className="as-toolbar-spacer"/><Button onClick={clearFilters}>Clear filters</Button></div>
      <div className="as-table-scroll"><table className="as-table"><thead><tr><th>ASSIGNMENT</th><th>EMPLOYEE</th><th>RESOURCES</th><th>ISSUED</th><th>RETURN DUE</th><th>STATUS</th><th aria-label="Actions"/></tr></thead>
        <tbody>{visible.map(assignment => <tr key={assignment.id} role="button" tabIndex={0} aria-label={'Open details for ' + assignment.id} onClick={() => setSelected(assignment)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(assignment); } }}>
          <td><strong>{assignment.id}</strong><small>{assignment.branch}</small></td>
          <td><div className="as-table-person"><Initials name={assignment.employee}/><strong>{assignment.employee}</strong></div></td>
          <td><strong>{assignment.assets[0].name}</strong>{assignment.assets.length > 1 && <small>+{assignment.assets.length - 1} more asset{assignment.assets.length > 2 ? 's' : ''}</small>}</td>
          <td className="as-muted-cell">{assignment.issued}</td>
          <td className="as-muted-cell">{assignment.returnDue || '—'}</td>
          <td><StatusPill status={assignment.status}/></td>
          <td className="as-row-icon"><ArrowLeftRight size={18}/></td>
        </tr>)}</tbody>
      </table></div>
      {!visible.length && <div className="as-empty"><Box size={27}/><strong>No assignments found</strong><span>Try adjusting your search or branch filter.</span><Button onClick={clearFilters}>Clear filters</Button></div>}
      <div className="as-catalog-foot"><span>{visible.length} sample assignment{visible.length === 1 ? '' : 's'} · data is illustrative</span><span>Select a row for full details</span></div>
    </Card>
    <p className="as-page-preview"><Badge tone="blue">UI preview</Badge> Assignment records, summary counts and history are illustrative. No changes are saved.</p>
    {selected && <AssignmentDrawer key={selected.id} assignment={selected} close={() => setSelected(null)}/>}
    {creating && <NewAssignmentDialog close={() => setCreating(false)}/>}
    {exportOpen && <div className="as-overlay as-center-overlay" onMouseDown={() => setExportOpen(false)}><section className="as-preview as-export-info" role="dialog" aria-modal="true" aria-labelledby="as-export-title" onMouseDown={event => event.stopPropagation()}><span className="as-preview-icon"><CalendarDays size={22}/></span><h3 id="as-export-title">Export assignments</h3><p>Exports of real assignments will be available after the authenticated API and permissions are connected. Current sample records are not an official report.</p><Button variant="primary" onClick={() => setExportOpen(false)}>Got it</Button></section></div>}
  </div>;
}
