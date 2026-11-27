import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Box, Check, ClipboardCheck, X } from 'lucide-react';
import { Badge, Button, Checkbox, Input, Select, Textarea } from '../components/ui';
import { useToast } from '../components/toast';
import { api, type Lookups, type Transfer } from './transfers-data';

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

export function NewTransferDialog({ close,lookups,onChanged }: { close: () => void;lookups:Lookups;onChanged:()=>void }) {
  const toast=useToast();const [busy,setBusy]=useState(false);
  const label=(b:Lookups['branches'][number])=>b.name+' ('+b.code+')';
  const destinations=lookups.branches.map(label);
  const sources=lookups.branches.filter(b=>lookups.global||b.id===lookups.ownBranchId).map(label);
  const availableAssets=lookups.assets.map(a=>({...a,location:lookups.branches.filter(b=>b.id===a.branchId).map(label)[0]??''}));
  const routes=lookups.canDirect?['Manager approval','Direct dispatch']:['Manager approval'];
  const [step, setStep] = useState<1 | 2>(1);
  const [source, setSource] = useState(sources[0]??'');
  const [destination, setDestination] = useState(destinations.find(d=>d!==sources[0])??'');
  const [recipient, setRecipient] = useState('Select recipient...');
  const [route, setRoute] = useState<string>('Manager approval');
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const destId=lookups.branches.find(b=>label(b)===destination)?.id;
  const people=lookups.people.filter(p=>p.branchId===destId);
  const personLabel=(p:Lookups['people'][number])=>p.fullName+' ('+p.id.slice(0,8)+')';
  async function submit(){setBusy(true);try{await api.create({sourceId:lookups.branches.find(b=>label(b)===source)?.id,destinationId:destId,recipientId:people.find(p=>personLabel(p)===recipient)?.id,resourceIds:selected,route,reason});toast.success('Transfer created');onChanged();}catch(e){toast.error(e instanceof Error?e.message:'Create failed');}finally{setBusy(false);}}
  const bodyRef = useRef<HTMLDivElement>(null);

  useDialogEscape(() => {
    if (preview) setPreview(false);
    else if (step === 2) setStep(1);
    else close();
  });

  const choices = useMemo(() => availableAssets.filter(item => item.location === source), [source,lookups]);
  const chosen = availableAssets.filter(item => selected.includes(item.id));
  const chooseSource = (value: string) => { setSource(value); setSelected([]); setError(''); };
  const toggle = (id: string) => { setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]); setError(''); };
  const review = () => {
    if (!source||!destination||source === destination) { setError('Source and destination locations must be different.'); return; }
    if (!people.some(p=>personLabel(p)===recipient)) { setError('Choose a transfer recipient.'); return; }
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
            <FormField label="Source location" required><Select label="Source location" value={source} options={sources} onChange={chooseSource}/></FormField>
            <FormField label="Destination location" required><Select label="Destination location" value={destination} options={destinations} onChange={value => { setDestination(value); setRecipient('Select recipient...'); setError(''); }}/></FormField>
            <FormField label="Recipient" required><Select label="Recipient" value={recipient} options={['Select recipient...', ...people.map(personLabel)]} onChange={value => { setRecipient(value); setError(''); }}/></FormField>
            <FormField label="Approval route"><Select label="Approval route" value={route} options={routes} onChange={setRoute}/></FormField>
          </div>
          <section className="tr-select-resources">
            <div className="tr-picker-title"><strong>Select resources</strong><small>· {selected.length} selected</small></div>
            <div className="tr-resource-picker">{choices.length ? choices.map(item => <label key={item.id} className={'tr-resource-option ' + (selected.includes(item.id) ? 'selected' : '')}>
              <Checkbox checked={selected.includes(item.id)} onChange={() => toggle(item.id)} aria-label={'Select ' + item.name}/>
              <span><strong>{item.name}</strong><small>{item.assetCode} · {item.location}</small></span><Box size={17}/>
            </label>) : <div className="tr-no-assets">No resources are available for this location.</div>}</div>
          </section>
          <FormField label="Transfer reason" required><Textarea rows={3} placeholder="Why are these resources being moved?" value={reason} onChange={event => { setReason(event.target.value); setError(''); }}/></FormField>
          <p className="tr-info-hint">Bulk transfers are supported. Recipients accept each resource separately and any rejected item is recorded for follow-up in the transfer workflow.</p>
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
          <p className="tr-info-hint">Creating reserves the selected resources; dispatch is a separate action.</p>
        </>}
      </div>
      <footer className="tr-modal-footer">
        {step === 1 ? <span>Select available resources</span> : <Button onClick={() => { setStep(1); bodyRef.current?.scrollTo({ top: 0 }); }}>Back to edit</Button>}
        <Button variant="primary" disabled={busy} onClick={() => step === 1 ? review() : void submit()}>{step === 1 ? 'Review transfer' : 'Create transfer'} <ArrowRight size={15}/></Button>
      </footer>

    </section>
  </div>;
}

type ReceiptDecision = 'Accept' | 'Report issue' | 'Decide later';
const receiptChoices: ReceiptDecision[] = ['Accept', 'Report issue', 'Decide later'];

export function TransferReceiptDialog({ transfer, close,onChanged }: { transfer: Transfer; close: () => void;onChanged:()=>void }) {
  const toast=useToast();const [busy,setBusy]=useState(false);
  const [damage,setDamage]=useState<Record<string,boolean>>({});
  async function submit(){setBusy(true);try{
    const decisionsToSend=await Promise.all(transfer.items.filter(i=>i.state!=='Received'&&decisions[i.id]!=='Decide later').map(async i=>{
      const f=files[i.id];let evidence;if(f){if(f.size>2097152)throw Error('Photo exceeds 2 MB');const raw=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(f);});evidence={filename:f.name,mimeType:f.type,base64:raw.split(',')[1]};}
      return {itemId:i.key,decision:decisions[i.id]==='Accept'?'ACCEPT':'REPORT_ISSUE',notes,damaged:!!damage[i.id],evidence};
    }));if(!decisionsToSend.length)throw Error('Select at least one decision');await api.receipt(transfer.key,decisionsToSend);toast.success('Receipt saved');onChanged();
  }catch(e){toast.error(e instanceof Error?e.message:'Receipt failed');}finally{setBusy(false);}}
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
    <DialogHeading id="tr-receipt-title" eyebrow={preview ? 'RECEIPT PREVIEW' : 'ITEM RECEIPT'} title={preview ? 'Review receipt decisions' : 'Review received resources'} subtitle="Each resource is accepted or reported separately." close={close}/>
    <div className="tr-new-content">
      <div className="tr-receipt-items">{transfer.items.map(item => <div className="tr-receipt-item-wrap" key={item.id}>
        <div className="tr-receipt-item"><span className="tr-review-box"><Box size={17}/></span><div><strong>{item.name}</strong><small>{item.id} · {item.state}</small></div>
          {preview || item.state==='Received' ? <span className="tr-receipt-choice">{decisions[item.id]}</span> : <Select label={'Receipt decision: ' + item.name} value={decisions[item.id]} options={receiptChoices} onChange={value => setDecisions(p => ({ ...p, [item.id]: value as ReceiptDecision }))}/>}
        </div>
        {decisions[item.id] === 'Report issue' && !preview && <div className="tr-evidence"><label htmlFor={'tr-evidence-' + item.id}>Photo evidence (required for damage)</label>
          <Input id={'tr-evidence-' + item.id} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setFiles(p => ({ ...p, [item.id]: event.target.files?.[0] }))}/>
          <Checkbox checked={!!damage[item.id]} onChange={()=>setDamage(p=>({...p,[item.id]:!p[item.id]}))}/> Damaged<small>JPEG, PNG or WebP, max 2 MB.</small></div>}
        {preview && files[item.id] && <small className="tr-evidence-name">Selected photo: {files[item.id]?.name}</small>}
      </div>)}</div>
      {preview ? <p className="tr-info-hint">These choices are not submitted. Unresolved items remain pending in the future production workflow.</p> : <>
        <p className="tr-info-hint">Only a complete item-by-item acceptance can close the transfer. Reported issues require further manager review.</p>
        <FormField label="Notes (required for issues and resolution)"><Textarea rows={3} placeholder="Add context about the received items" value={notes} onChange={event => setNotes(event.target.value)}/></FormField>
      </>}
      {preview && notes.trim() && <p className="tr-review-reason">{notes}</p>}
    </div>
    <footer className="tr-modal-footer"><Button onClick={() => preview ? setPreview(false) : close()}>{preview ? 'Back to edit' : 'Back'}</Button>
      <Button variant="primary" disabled={busy} onClick={() => preview ? void submit() : setPreview(true)}>{preview ? 'Confirm receipt' : 'Review receipt'} <ArrowRight size={14}/></Button>
    </footer>

  </section></div>;
}

export function TransferDetails({ transfer, close, onReceipt,onChanged }: { transfer: Transfer; close: () => void; onReceipt: () => void;onChanged:()=>void }) {
  const toast=useToast();const [busy,setBusy]=useState(false);const [action,setAction]=useState('');const [note,setNote]=useState('');
  async function apply(){setBusy(true);try{await api.action(transfer.key,action,note);toast.success('Transfer updated');setAction('');setNote('');onChanged();}catch(e){toast.error(e instanceof Error?e.message:'Action failed');}finally{setBusy(false);}}
  useDialogEscape(close);
  const complete = transfer.status === 'Completed';
  const approved = transfer.status !== 'Pending approval';
  const inProgress = transfer.status === 'Awaiting receipt' || transfer.status === 'Partially received';
  const actionVisible = transfer.actions.receipt;
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
            <div><strong>{item.name}</strong><small>{item.id} · {item.notes||item.state}</small>{item.evidenceName&&<a href={"/api/v1/transfers/"+transfer.key+"/items/"+item.key+"/evidence"}>{item.evidenceName}</a>}</div>
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
          {transfer.activity.map(item => <li key={item.title+item.date}><strong>{item.title}</strong><small>{new Date(item.date).toLocaleString()} {item.notes}</small></li>)}
        </ol></section>
        <p className="tr-info-hint">A transfer is closed only when the recipient confirms every resource. Partial acceptance keeps remaining items pending.</p>
      </div>
      <div className="tr-details-section">{action&&<><strong>Confirm {action}</strong><Textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Reason / note"/><Button disabled={busy} onClick={()=>void apply()}>Confirm</Button><Button onClick={()=>setAction('')}>Back</Button></>}</div><footer className="tr-drawer-footer">{!action&&<>{transfer.actions.approve&&<><Button onClick={()=>setAction('approve')}>Approve</Button><Button onClick={()=>setAction('reject')}>Reject</Button></>}{transfer.actions.dispatch&&<Button onClick={()=>setAction('dispatch')}>Dispatch</Button>}{transfer.actions.arrive&&<Button onClick={()=>setAction('arrive')}>Record arrival</Button>}{transfer.actions.cancel&&<Button onClick={()=>setAction('cancel')}>Cancel transfer</Button>}</>}<Button onClick={close}>Close</Button>{actionVisible && <Button variant="primary" onClick={onReceipt}>Review receipt <ArrowRight size={15}/></Button>}</footer>
    </aside>
  </div>;
}

function TransferStatusPill({ status }: { status: Transfer['status'] }) {
  return <span className={'tr-status tr-' + status.toLowerCase().replace(/\s+/g, '-')}><i/>{status}</span>;
}
