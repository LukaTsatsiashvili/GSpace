import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Check, FileText, UploadCloud, X } from 'lucide-react';
import { Badge, Button, Input, NumberInput, Select } from '../components/ui';
import { currencyText, employees, initials, licenseBranches, type LicenseModel, type LicenseRecord, type LicenseStatus } from './licenses-data';

type View = 'details' | 'renewal' | 'seats';

function useLicenseEscape(close: () => void) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('.ui-select[aria-expanded="true"]')) return;
      event.stopImmediatePropagation();
      close();
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = previous; };
  }, [close]);
}

function DialogHeader({ eyebrow, title, subtitle, id, close }: {
  eyebrow: string; title: string; subtitle: string; id: string; close: () => void;
}) {
  return <header className="lic-dialog-head"><div><Badge tone="blue">{eyebrow}</Badge><h2 id={id}>{title}</h2><p>{subtitle}</p></div>
    <button className="lic-close" type="button" aria-label="Close dialog" onClick={close}><X size={17}/></button>
  </header>;
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <div className="lic-field"><label>{label}{required && <b> *</b>}</label>{children}</div>;
}

function DetailsGrid({ cells }: { cells: { label: string; value: string; children?: ReactNode }[] }) {
  return <div className="lic-detail-grid">{cells.map(cell => <div key={cell.label}><small>{cell.label}</small>
    <strong>{cell.value}</strong>{cell.children}</div>)}</div>;
}

function NoticeContent({ title, text, close }: { title: string; text: string; close: () => void }) {
  return <section className="lic-notice" role="alertdialog" aria-modal="true" aria-labelledby="lic-notice-title" onMouseDown={e => e.stopPropagation()}>
    <span className="lic-notice-mark"><Check size={22}/></span><h2 id="lic-notice-title">{title}</h2><p>{text}</p>
    <Button variant="primary" onClick={close}>Got it</Button>
  </section>;
}

export function LicenseNotice({ title, text, close }: { title: string; text: string; close: () => void }) {
  useLicenseEscape(close);
  return <div className="lic-notice-overlay" onMouseDown={close}><NoticeContent title={title} text={text} close={close}/></div>;
}

function StatusPill({ status }: { status: LicenseStatus }) {
  return <span className={'lic-status lic-status-' + status.toLowerCase().replace(' ', '-')}><i/>{status}</span>;
}

export function LicenseDialog({ license, initialView, close }: { license: LicenseRecord; initialView: View; close: () => void }) {
  const [view, setView] = useState<View>(initialView);
  const [autoRenew, setAutoRenew] = useState(license.autoRenew ? 'Enabled' : 'Disabled');
  const [renewalDate, setRenewalDate] = useState(() => license.renewal ? new Date(license.renewal).toISOString().slice(0, 10) : '');
  const [reminders, setReminders] = useState<number[]>([30, 14, 7]);
  const [renewalOwner, setRenewalOwner] = useState(license.owner);
  const [employee, setEmployee] = useState('Select employee...');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [releaseCandidate, setReleaseCandidate] = useState('');

  useLicenseEscape(() => {
    if (message) setMessage('');
    else if (view !== 'details') setView('details');
    else close();
  });

  const viewClose = () => { if (view === 'details') close(); else setView('details'); };
  const showPolicyPreview = () => {
    if (!renewalDate) { setError('Please specify a valid renewal date.'); return; }
    setError('');
    setMessage('Renewal policy reviewed: ' + autoRenew.toLowerCase() + ', reminders at ' + (reminders.length ? reminders.sort((a,b) => b-a).join(', ') + ' days' : 'no offsets') + ', owned by ' + renewalOwner + '. This is a design preview; no reminders or records were changed.');
  };
  const showSeatPreview = () => {
    if (employee === 'Select employee...') { setError('Select an employee to preview an assignment.'); return; }
    if (license.total <= license.assigned) { setError('There are no available seats to assign.'); return; }
    if (license.users.includes(employee)) { setError('This employee is already listed among the example assignments.'); return; }
    setError('');
    setMessage('Assignment preview: ' + employee + ' would receive a seat for ' + license.name + '. No assignments, seat totals or audit records were changed.');
  };

  return <div className="lic-overlay" onMouseDown={close}>
    <aside className={'lic-dialog ' + (view === 'details' ? 'lic-detail-drawer' : 'lic-settings-dialog')} role="dialog" aria-modal="true"
      aria-labelledby="lic-dialog-title" onMouseDown={e => e.stopPropagation()}>
      <DialogHeader id="lic-dialog-title" eyebrow={view === 'details' ? license.id : view === 'renewal' ? 'RENEWAL POLICY' : 'SEAT MANAGEMENT'}
        title={license.name} subtitle={view === 'details' ? license.vendor + ' · ' + license.edition : view === 'renewal'
          ? 'Configure upcoming renewal alerts and escalation behavior.' : 'Assign or release license seats with an audit trail.'} close={close}/>
      {view === 'details' ? <>
        <div className="lic-dialog-body">
          <div className="lic-detail-meta"><StatusPill status={license.status}/><span>{license.model} license</span><span>{license.autoRenew ? 'Auto-renew enabled' : 'Manual renewal'}</span></div>
          <section className="lic-block"><h3>Subscription overview</h3>
            <DetailsGrid cells={[
              { label: 'License owner', value: license.owner }, { label: 'Branch / department', value: license.branch },
              { label: 'Billing frequency', value: license.billing }, { label: 'Cost in original currency', value: currencyText(license.amount, license.currency) },
              { label: 'Start date', value: license.start }, { label: 'Next renewal', value: license.renewal || '—' }
            ]}/>
          </section>
          <section className="lic-block"><h3>Seat usage</h3>
            <DetailsGrid cells={[{ label: 'Assigned seats', value: license.assigned + ' of ' + license.total,
              children: <div className="lic-meter"><span style={{ width: (license.total ? license.assigned / license.total * 100 : 0) + '%' }}/></div> },
              { label: 'Available seats', value: String(license.total - license.assigned) }]}/>
            {license.users.length ? <div className="lic-users-list">{license.users.map(name => <div className="lic-person" key={name}>
              <span className="lic-avatar">{initials(name)}</span><div><strong>{name}</strong><small>{license.model === 'Device-bound' ? 'Assigned device' : 'Assigned user'}</small></div>
              <span className="lic-mini-assigned"><i/>Assigned</span>
            </div>)}</div> : <p className="lic-muted-note">No current seat assignments in this example.</p>}
            {license.assigned > license.users.length && <p className="lic-muted-note">Showing {license.users.length} sample assignment{license.users.length === 1 ? '' : 's'} of {license.assigned} allocated seats.</p>}
          </section>
          <section className="lic-block"><h3>Renewal & reminders</h3><div className="lic-inline-info"><small>Reminder schedule</small><strong>30 days · 14 days · 7 days</strong>
            <span>Auto-renew: {license.autoRenew ? 'On' : 'Off'} · Expiry retains notification and historical record.</span></div></section>
          <section className="lic-block"><h3>Contracts & invoices</h3><div className="lic-document-list">
            {license.documents.map(document => <button key={document} type="button" className="lic-document"
              onClick={() => setMessage('"' + document + '" is a sample document name. File preview and download require an authenticated document API.')}>
              <FileText size={16}/><strong>{document}</strong><small>Preview record</small></button>)}</div></section>
          <section className="lic-block"><h3>Activity history</h3><div className="lic-timeline">
            <div><strong>License record reviewed</strong><small>Nov 06, 2026 · Renewal and seat status tracked</small></div>
            <div><strong>Subscription added</strong><small>{license.start} · Audit history retained</small></div>
          </div></section>
          <p className="lic-info-banner">On employee departure, assigned licenses are flagged for review and a release task is created. No recipient confirmation is needed for seat assignment.</p>
        </div><footer className="lic-dialog-footer"><Button onClick={close}>Close</Button><span className="lic-footer-space"/>
          <Button onClick={() => { setView('renewal'); setError(''); }}>Renewal settings</Button>
          <Button variant="primary" onClick={() => { setView('seats'); setError(''); }}>Manage seats</Button></footer>
      </> : view === 'renewal' ? <>
        <div className="lic-dialog-body">
          <div className="lic-form-grid">
            <Field label="Auto-renewal"><Select label="Auto-renewal" options={['Enabled', 'Disabled']} value={autoRenew} onChange={setAutoRenew}/></Field>
            <Field label="Renewal date"><Input type="date" value={renewalDate} onChange={e => { setRenewalDate(e.target.value); setError(''); }}/></Field>
          </div>
          <section className="lic-block"><h3>Reminder offsets</h3><div className="lic-reminder-list">
            {[30, 14, 7, 1].map(day => <label className={'lic-reminder ' + (reminders.includes(day) ? 'selected' : '')} key={day}>
              <input type="checkbox" checked={reminders.includes(day)} onChange={e => setReminders(current => e.target.checked ? [...current, day] : current.filter(value => value !== day))}/>
              <span><strong>{day} {day === 1 ? 'day' : 'days'} before expiry</strong><small>Email and in-app notification</small></span></label>)}
          </div></section>
          <section className="lic-block"><Field label="Renewal owner"><Select label="Renewal owner" options={employees} value={renewalOwner} onChange={setRenewalOwner}/></Field></section>
          <p className="lic-info-banner">Reminders never renew or cancel a subscription by themselves. An expired license retains its record, notification and cost history.</p>
          {error && <p className="lic-validation" role="alert">{error}</p>}
        </div>
        <footer className="lic-dialog-footer"><Button onClick={viewClose}>Back</Button><span className="lic-footer-space"/><Button variant="primary" onClick={showPolicyPreview}>Preview policy</Button></footer>
      </> : <>
        <div className="lic-dialog-body">
          <DetailsGrid cells={[{ label: 'Assigned', value: license.assigned + ' / ' + license.total },
            { label: 'Available', value: String(license.total - license.assigned) }]}/>
          <section className="lic-block"><h3>Current assignments</h3>
            {license.users.length ? <div className="lic-assignment-list">{license.users.map(name => <div key={name} className="lic-person">
              <span className="lic-avatar">{initials(name)}</span><div><strong>{name}</strong><small>{license.model === 'Device-bound' ? 'Device seat' : 'Employee seat'} · assignment recorded</small></div>
              <Button onClick={() => { setReleaseCandidate(name); setMessage('Release preview: ' + name + ' would be unassigned from ' + license.name + '. No seat or audit record has changed.'); }}>Release</Button>
            </div>)}</div> : <p className="lic-muted-note">No current sample assignments.</p>}
            {license.assigned > license.users.length && <p className="lic-muted-note">Only example assignment names are shown; the summary includes additional sample allocations.</p>}
          </section>
          <section className="lic-block"><Field label={license.model === 'Device-bound' ? 'Assign to device (preview)' : 'Assign to employee'}>
            <Select label="Select recipient" value={employee} options={['Select employee...', ...employees]} onChange={value => { setEmployee(value); setError(''); }}/></Field></section>
          <p className="lic-info-banner">Seat availability is automatically derived from assignments. Employee offboarding creates a review/release task; all changes are auditable.</p>
          {error && <p className="lic-validation" role="alert">{error}</p>}
        </div><footer className="lic-dialog-footer"><Button onClick={viewClose}>Back</Button><span className="lic-footer-space"/><Button variant="primary" onClick={showSeatPreview}>Preview assignment</Button></footer>
      </>}
      {message && <div className="lic-notice-overlay" onMouseDown={() => { setMessage(''); setReleaseCandidate(''); }}>
        <NoticeContent title={releaseCandidate ? 'Release preview' : 'Design preview'} text={message} close={() => { setMessage(''); setReleaseCandidate(''); }}/></div>}
    </aside>
  </div>;
}

export function AddLicenseDialog({ close }: { close: () => void }) {
  const [model, setModel] = useState<LicenseModel>('Individual');
  const [product, setProduct] = useState('');
  const [vendor, setVendor] = useState('');
  const [seats, setSeats] = useState('1');
  const [owner, setOwner] = useState(employees[0]);
  const [branch, setBranch] = useState(licenseBranches[0]);
  const [billing, setBilling] = useState('Yearly');
  const [cost, setCost] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [date, setDate] = useState('');
  const [autoRenew, setAutoRenew] = useState('Enabled');
  const [files, setFiles] = useState<File[]>([]);
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);

  useLicenseEscape(() => {
    if (message) setMessage(false);
    else if (review) { setReview(false); scrollArea.current?.scrollTo(0, 0); }
    else close();
  });

  const chooseFiles = (items: FileList | null) => {
    if (items) setFiles(current => [...current, ...Array.from(items)]);
    if (fileInput.current) fileInput.current.value = '';
  };
  function next() {
    if (!product.trim() || !vendor.trim()) { setError('Product/service name and vendor are required.'); return; }
    if (!Number.isInteger(Number(seats)) || Number(seats) < 1) { setError('Enter at least one seat as a whole number.'); return; }
    if (!cost.trim() || !Number.isFinite(Number(cost)) || Number(cost) < 0) { setError('Enter a valid recurring cost.'); return; }
    if (!date || Number.isNaN(Date.parse(date))) { setError('Choose a valid renewal / expiry date.'); return; }
    setError(''); setReview(true); scrollArea.current?.scrollTo(0, 0);
  }

  return <div className="lic-overlay lic-create-overlay" onMouseDown={close}>
    <section className="lic-dialog lic-create-dialog" role="dialog" aria-modal="true" aria-labelledby="lic-create-title" onMouseDown={e => e.stopPropagation()}>
      <DialogHeader id="lic-create-title" close={close} eyebrow={review ? 'LICENSE SUMMARY' : 'NEW LICENSE · DESIGN PREVIEW'}
        title={review ? 'Review new license' : 'Add license or subscription'}
        subtitle={review ? 'Confirm the configuration before adding it.' : 'Register ownership, billing, seats and renewal details.'}/>
      <div className="lic-dialog-body" ref={scrollArea}>
        {review ? <>
          <DetailsGrid cells={[{ label: 'Product', value: product.trim() }, { label: 'Vendor', value: vendor.trim() },
            { label: 'License model', value: model + ' · ' + seats + ' seats' },
            { label: 'Billing', value: cost + ' ' + currency + ' / ' + billing },
            { label: 'Owner', value: owner }, { label: 'Renewal', value: date }]}/>
          <p className="lic-info-banner">Auto-renew: {autoRenew} · reminders 30 / 14 / 7 days · no production record will be created.</p>
          {!!files.length && <p className="lic-muted-note">{files.length} locally selected document{files.length === 1 ? '' : 's'} (not uploaded): {files.map(file => file.name).join(', ')}</p>}
        </> : <>
          <section className="lic-block lic-first-block"><h3>License model</h3><div className="lic-model-options">
            {([
              ['Individual', 'Assigned to one named person'],
              ['Multi-user', 'Shared seat pool with named users'],
              ['Device-bound', 'Assigned to hardware or device ID']
            ] as const).map(([name, explanation]) =>
              <button type="button" key={name} className={'lic-model-option ' + (model === name ? 'selected' : '')} aria-pressed={model === name} onClick={() => {
                setModel(name); if (name === 'Individual') setSeats('1');
              }}><strong>{name}</strong><small>{explanation}</small></button>)}
          </div></section>
          <section className="lic-block"><h3>Product information</h3>
            <div className="lic-form-grid">
              <Field label="Product / service name" required><Input value={product} onChange={e => { setProduct(e.target.value); setError(''); }} placeholder="e.g. Microsoft 365"/></Field>
              <Field label="Vendor" required><Input value={vendor} onChange={e => { setVendor(e.target.value); setError(''); }} placeholder="e.g. Microsoft"/></Field>
              <Field label="Total seats" required><NumberInput value={seats} min={1} step={1} inputMode="numeric" disabled={model === 'Individual'} onChange={e => { setSeats(e.target.value); setError(''); }}/></Field>
              <Field label="License owner"><Select label="License owner" options={employees} value={owner} onChange={setOwner}/></Field>
              <Field label="Branch / department"><Select label="Branch / department" options={licenseBranches} value={branch} onChange={setBranch}/></Field>
              <Field label="Billing cycle"><Select label="Billing cycle" options={['Monthly', 'Quarterly', 'Yearly', 'Custom']} value={billing} onChange={setBilling}/></Field>
              <Field label="Recurring cost" required><NumberInput value={cost} onChange={e => { setCost(e.target.value); setError(''); }} min={0} step="0.01" placeholder="e.g. 1200"/></Field>
              <Field label="Currency"><Select label="Currency" options={['USD', 'EUR', 'GEL']} value={currency} onChange={setCurrency}/></Field>
              <Field label="Renewal / expiry date" required><Input type="date" value={date} onChange={e => { setDate(e.target.value); setError(''); }}/></Field>
              <Field label="Auto-renewal"><Select label="Auto-renewal" options={['Enabled', 'Disabled']} value={autoRenew} onChange={setAutoRenew}/></Field>
            </div>
          </section>
          <section className="lic-block"><h3>Contract documents</h3>
            <input ref={fileInput} type="file" multiple className="lic-file-input" aria-label="Select contract documents"
              onChange={e => chooseFiles(e.target.files)}/>
            <button type="button" className="lic-upload-zone" onClick={() => fileInput.current?.click()}>
              <UploadCloud size={22}/><strong>Choose contracts, invoices or licenses</strong><span>Multiple documents supported · selection preview only</span>
            </button>
            {files.length ? <div className="lic-file-list">{files.map((file,index) =>
              <div key={file.name + index}><FileText size={15}/><span>{file.name}</span><button type="button" aria-label={'Remove ' + file.name} onClick={() => setFiles(previous => previous.filter((_,i) => i !== index))}><X size={15}/></button></div>)}</div>
              : <p className="lic-muted-note">No documents selected</p>}
          </section>
          <p className="lic-info-banner">Assignments require no recipient confirmation, and reminders default to 30 / 14 / 7 days. Expense history is recorded in original currency after API integration.</p>
          {error && <p className="lic-validation" role="alert">{error}</p>}
        </>}
      </div>
      <footer className="lic-dialog-footer">{review ? <Button onClick={() => { setReview(false); scrollArea.current?.scrollTo(0, 0); }}>Back to edit</Button>
        : <span className="lic-footer-hint">Sample-only workflow</span>}<span className="lic-footer-space"/>
        <Button variant="primary" onClick={() => review ? setMessage(true) : next()}>
          {review ? 'Preview registration' : 'Review license'} <ArrowRight size={15}/></Button></footer>
      {message && <div className="lic-notice-overlay" onMouseDown={() => setMessage(false)}><NoticeContent title="License preview complete"
        text="The new license was reviewed successfully. No subscription, expense, document, notification or database record was created."
        close={() => setMessage(false)}/></div>}
    </section>
  </div>;
}
