import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeftRight, ArrowRight, Box, Check, CheckCircle2, ClipboardCheck, X } from 'lucide-react';
import { Badge, Button, Input, SearchInput, Select, Textarea } from '../components/ui';
import { availableAssets, destinations, people, routes, type Transfer, type TransferResource } from './transfers-data';

function useDialogEscape(onEscape: () => void) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (document.querySelector('.ui-select[aria-expanded="true"]')) return;
      event.stopImmediatePropagation();
      onEscape();
    }
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previous;
    };
  }, [onEscape]);
}

function DialogHeading({ eyebrow, title, subtitle, close, id }: {
  eyebrow: string; title: string; subtitle: string; close: () => void; id: string;
}) {
  return <header className="tr-modal-heading"><div>
    <Badge tone="blue">{eyebrow}</Badge>
    <h2 id={id}>{title}</h2><p>{subtitle}</p>
  </div><button type="button" className="tr-icon-close" aria-label="Close dialog" onClick={close}><X size={17}/></button></header>;
}

function FormField({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return <label className="tr-field"><span>{label}{required && <b> *</b>}</span>{children}</label>;
}

function AssetLine({ item, badge }: { item: { id: string; name: string }; badge: string }) {
  return <div className="tr-review-resource"><span className="tr-review-box"><Box size={18}/></span><div><strong>{item.name}</strong><small>{item.id}</small></div><span className="tr-review-flag"><span/> {badge}</span></div>;
}

export function TransferPreviewMessage({ title, description, close }: { title: string; description: string; close: () => void }) {
  return <div className="tr-preview-overlay" onMouseDown={close}><section role="alertdialog" aria-modal="true" aria-labelledby="tr-preview-title" className="tr-preview-box" onMouseDown={event => event.stopPropagation()}>
    <span className="tr-preview-check"><ClipboardCheck size={23}/></span><h3 id="tr-preview-title">{title}</h3><p>{description}</p><Button variant="primary" onClick={close}>Got it</Button>
  </section></div>;
}

export function NewTransferDialog({ close }: { close: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [source, setSource] = useState('Head Office');
  const [destination, setDestination] = useState('Tbilisi Store 01');
  const [recipient, setRecipient] = useState('Select recipient...');
  const [route, setRoute] = useState<string>('Manager approval');
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useDialogEscape(() => {
    if (preview) setPreview(false);
    else if (step === 2) setStep(1);
    else close();
  });

  const choices = useMemo(() => availableAssets.filter(item => item.location === source && (item.name + ' ' + item.id).toLowerCase().includes(assetSearch.trim().toLowerCase())), [source, assetSearch]);
  const chosen = availableAssets.filter(item => selected.includes(item.id));
  const chooseSource = (value: string) => { setSource(value); setSelected([]); setError(''); setAssetSearch(''); };
  const toggle = (id: string) => { setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); setError(''); };
  const review = () => {
    if (source === destination) { setError('Source and destination locations must be different.'); return; }
    if (recipient === 'Select recipient...') { setError('Choose a transfer recipient.'); return; }
    if (selected.length === 0) { setError('Select at least one resource to transfer.'); return; }
    if (!reason.trim()) { setError('Please provide a transfer reason.'); return; }
    setError(''); setStep(2); bodyRef.current?.scrollTo({ top: 0 });
  };

  return <div className="tr-modal-overlay" onMouseDown={close}>
    <section role="dialog" aria-modal="true" aria-labelledby="tr-new-title" className="tr-modal tr-new-modal" onMouseDown={event => event.stopPropagation()}>
      <DialogHeading id="tr-new-title" eyebrow={'NEW TRANSFER · 0' + step + ' / 02'} title={step === 1 ? 'Create branch transfer' : 'Review transfer'} subtitle={step === 1 ? 'Choose source, destination and resources to dispatch.' : 'Confirm the planned handover before dispatch.'} close={close}/>
      <div className="tr-new-content" ref={bodyRef}>
        <div className="tr-wizard-steps" aria-label="Transfer creation steps">
          <span className={step === 1 ? 'active' : ''}>1 · Transfer details</span>
          <span className={step === 2 ? 'active' : ''}>2 · Review</span>
        </div>
        {step === 1 ? <>
          <div className="tr-input-grid">
            <FormField label="Source location" required><Select label="Source location" value={source} options={destinations} onChange={chooseSource}/></FormField>
            <FormField label="Destination location" required><Select label="Destination location" value={destination} options={destinations} onChange={value => { setDestination(value); setError(''); }}/></FormField>
            <FormField label="Recipient" required><Select label="Recipient" value={recipient} options={['Select recipient...', ...people]} onChange={value => { setRecipient(value); setError(''); }}/></FormField>
            <FormField label="Approval route"><Select label="Approval route" value={route} options={routes} onChange={setRoute}/></FormField>
          </div>
          <section className="tr-select-resources">
            <div className="tr-picker-title"><strong>Select resources</strong><small>· {selected.length} selected</small></div>
            <SearchInput aria-label="Search resources for transfer" placeholder="Search available assets..." value={assetSearch} onChange={event => setAssetSearch(event.target.value)}/>
            <div className="tr-resource-picker">{choices.length ? choices.map(item => <label key={item.id} className={'tr-resource-option ' + (selected.includes(item.id) ? 'selected' : '')}>
              <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} aria-label={'Select ' + item.name}/>
              <span><strong>{item.name}</strong><small>{item.id} · {item.location}</small></span><Box size={17}/>
            </label>) : <div className="tr-no-assets">No sample resources are available for this location or search. Try Head Office.</div>}</div>
          </section>
          <FormField label="Transfer reason" required><Textarea rows={3} placeholder="Why are these resources being moved?" value={reason} onChange={event => { setReason(event.target.value); setError(''); }}/></FormField>
          <p className="tr-info-hint">Bulk transfers are supported. Recipients accept each resource separately and any rejected item is recorded for follow-up in the future production workflow.</p>
          {error && <p className="tr-error" role="alert">{error}</p>}
        </> : <>
          <div className="tr-review-fields">
            <div><span>From</span><strong>{source}</strong></div><div><span>To</span><strong>{destination}</strong></div>
            <div><span>Recipient</span><strong>{recipient}</strong></div><div><span>Workflow</span><strong>{route}</strong></div>
          </div>
          <section className="tr-review-section"><h3>Selected resources</h3><div className="tr-resource-review-list">
            {chosen.map(item => <AssetLine key={item.id} item={item} badge="Requires receipt"/>)}
          </div></section>
          <section className="tr-review-section"><h3>Reason</h3><p className="tr-review-reason">{reason}</p></section>
          <p className="tr-info-hint">This preview does not dispatch resources or change stock locations.</p>
        </>}
      </div>
      <footer className="tr-modal-footer">
        {step === 1 ? <span>Design preview · no transfer created</span> : <Button onClick={() => { setStep(1); bodyRef.current?.scrollTo({ top: 0 }); }}>Back to edit</Button>}
        <Button variant="primary" onClick={() => step === 1 ? review() : setPreview(true)}>{step === 1 ? 'Review transfer' : 'Preview transfer'} <ArrowRight size={15}/></Button>
      </footer>
      {preview && <TransferPreviewMessage title="Transfer preview ready" description="The transfer has been reviewed, but no dispatch, stock location change, approval, receipt, notification or audit record has been created." close={() => setPreview(false)}/>}
    </section>
  </div>;
}

type ReceiptDecision = 'Accept' | 'Report issue' | 'Decide later';
const receiptChoices: ReceiptDecision[] = ['Accept', 'Report issue', 'Decide later'];

export function TransferReceiptDialog({ transfer, close }: { transfer: Transfer; close: () => void }) {
  const [decisions, setDecisions] = useState<Record<string, ReceiptDecision>>(() => Object.fromEntries(
    transfer.items.map(item => [item.id, item.state === 'Received' ? 'Accept' : 'Decide later'])
  ));
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<Record<string, File | undefined>>({});
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState(false);
  useDialogEscape(() => {
    if (message) setMessage(false);
    else if (preview) setPreview(false);
    else close();
  });

  return <div className="tr-modal-overlay" onMouseDown={close}><section className="tr-modal tr-receipt-modal" role="dialog" aria-modal="true" aria-labelledby="tr-receipt-title" onMouseDown={event => event.stopPropagation()}>
    <DialogHeading id="tr-receipt-title" eyebrow={preview ? 'RECEIPT PREVIEW' : 'ITEM RECEIPT · DESIGN PREVIEW'} title={preview ? 'Review receipt decisions' : 'Review received resources'} subtitle="Each resource is accepted or reported separately." close={close}/>
    <div className="tr-new-content">
      <div className="tr-receipt-items">{transfer.items.map(item => <div className="tr-receipt-item-wrap" key={item.id}>
        <div className="tr-receipt-item"><span className="tr-review-box"><Box size={17}/></span><div><strong>{item.name}</strong><small>{item.id} · {item.state}</small></div>
          {preview ? <span className="tr-receipt-choice">{decisions[item.id]}</span> : <Select label={'Receipt decision: ' + item.name} value={decisions[item.id]} options={receiptChoices} onChange={value => setDecisions(p => ({ ...p, [item.id]: value as ReceiptDecision }))}/>}
        </div>
        {decisions[item.id] === 'Report issue' && !preview && <div className="tr-evidence"><label htmlFor={'tr-evidence-' + item.id}>Optional photo evidence</label>
          <Input id={'tr-evidence-' + item.id} type="file" accept="image/*" onChange={event => setFiles(p => ({ ...p, [item.id]: event.target.files?.[0] }))}/>
          <small>Selected photos remain on this device and are not uploaded.</small></div>}
        {preview && files[item.id] && <small className="tr-evidence-name">Selected photo: {files[item.id]?.name}</small>}
      </div>)}</div>
      {preview ? <p className="tr-info-hint">These choices are not submitted. Unresolved items remain pending in the future production workflow.</p> : <>
        <p className="tr-info-hint">Only a complete item-by-item acceptance can close the transfer. Reported issues require further manager review.</p>
        <FormField label="Notes (optional)"><Textarea rows={3} placeholder="Add context about the received items" value={notes} onChange={event => setNotes(event.target.value)}/></FormField>
      </>}
      {preview && notes.trim() && <p className="tr-review-reason">{notes}</p>}
    </div>
    <footer className="tr-modal-footer"><Button onClick={() => preview ? setPreview(false) : close()}>{preview ? 'Back to edit' : 'Back'}</Button>
      <Button variant="primary" onClick={() => preview ? setMessage(true) : setPreview(true)}>{preview ? 'Preview confirmation' : 'Review receipt'} <ArrowRight size={14}/></Button>
    </footer>
    {message && <TransferPreviewMessage title="Receipt confirmation preview" description="Your item decisions have only been previewed. No transfer status, approval, stock location or database record has changed." close={() => setMessage(false)}/>}
  </section></div>;
}

export function TransferDetails({ transfer, close, onReceipt }: { transfer: Transfer; close: () => void; onReceipt: () => void }) {
  useDialogEscape(close);
  const complete = transfer.status === 'Completed';
  const approved = transfer.status !== 'Pending approval';
  const inProgress = transfer.status === 'Awaiting receipt' || transfer.status === 'Partially received';
  const actionVisible = inProgress;
  const steps = [
    { title: 'Transfer initiated', detail: transfer.created + ' · ' + transfer.sender, done: true },
    { title: transfer.route, detail: 'Dispatch authorized and recorded', done: approved },
    { title: 'Recipient confirms items', detail: 'Each resource can be accepted separately; unresolved items remain open.', done: complete }
  ];
  return <div className="tr-drawer-overlay" onMouseDown={close}>
    <aside className="tr-drawer" role="dialog" aria-modal="true" aria-labelledby="tr-details-heading" onMouseDown={event => event.stopPropagation()}>
      <DialogHeading id="tr-details-heading" eyebrow={transfer.id} title="Transfer details" subtitle="Dispatch, approval and receipt history" close={close}/>
      <div className="tr-drawer-body">
        <div className="tr-detail-status"><TransferStatusPill status={transfer.status}/><span>{transfer.created} · {transfer.route}</span></div>
        <section className="tr-details-section"><h3>Transfer route</h3><div className="tr-detail-grid">
          <div><small>From</small><strong>{transfer.source}</strong></div>
          <div><small>To</small><strong>{transfer.destination}</strong></div>
          <div><small>Sender</small><strong>{transfer.sender}</strong></div>
          <div><small>Recipient</small><strong>{transfer.recipient}</strong></div>
        </div></section>
        <section className="tr-details-section"><h3>Transferred resources <span>· {transfer.items.length} item(s)</span></h3><div className="tr-detail-resources">
          {transfer.items.map(item => <div key={item.id} className="tr-detail-resource">
            <span className="tr-review-box"><Box size={16}/></span>
            <div><strong>{item.name}</strong><small>Individual receipt confirmation tracked</small></div>
            <span className={'tr-resource-status ' + (item.state === 'Received' ? 'received' : 'waiting')}><span/>{complete ? 'Completed' : item.state}</span>
          </div>)}
        </div></section>
        <section className="tr-details-section"><h3>Movement workflow</h3><div className="tr-workflow-list">
          {steps.map((item, index) => <div className={'tr-workflow-step ' + (item.done ? 'done' : 'pending') + ((index === 2 && inProgress) ? ' current' : '')} key={item.title}>
            <span className="tr-step-mark">{item.done ? <Check size={16}/> : index + 1}</span>
            <div><strong>{item.title}</strong><small>{item.detail}</small></div>
          </div>)}
        </div></section>
        <section className="tr-details-section"><h3>Activity history</h3><ol className="tr-activity">
          {transfer.activity.map(item => <li key={item.title}><strong>{item.title}</strong><small>{item.date}</small></li>)}
        </ol></section>
        <p className="tr-info-hint">A transfer is closed only when the recipient confirms every resource. Partial acceptance keeps remaining items pending.</p>
      </div>
      <footer className="tr-drawer-footer"><Button onClick={close}>Close</Button>{actionVisible && <Button variant="primary" onClick={onReceipt}>Review receipt <ArrowRight size={15}/></Button>}</footer>
    </aside>
  </div>;
}

function TransferStatusPill({ status }: { status: Transfer['status'] }) {
  return <span className={'tr-status tr-' + status.toLowerCase().replace(/\s+/g, '-')}><i/>{status}</span>;
}
