import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, ClipboardCheck, Paperclip, UploadCloud, X } from 'lucide-react';
import { Badge, Button, Input, Select, Textarea } from '../components/ui';
import { approvalTypes, branches, currency, deadlines, deadlineBehaviors, type ApprovalPattern, type ApprovalRequest, type RequestType } from './approvals-data';

export function useApprovalEscape(close: () => void) {
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape' || document.querySelector('.ui-select[aria-expanded="true"]')) return;
      event.stopImmediatePropagation();
      close();
    }
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = old; };
  }, [close]);
}

export function PreviewMessage({ title, description, close }: { title: string; description: string; close: () => void }) {
  return <div className="ap-preview-layer" onMouseDown={close}>
    <section className="ap-preview-message" role="alertdialog" aria-modal="true" aria-labelledby="ap-message-title" onMouseDown={event => event.stopPropagation()}>
      <span className="ap-preview-icon"><ClipboardCheck size={23}/></span>
      <h3 id="ap-message-title">{title}</h3><p>{description}</p>
      <Button variant="primary" onClick={close}>Got it</Button>
    </section>
  </div>;
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="ap-form-field"><span>{label}{required && <b> *</b>}</span>{children}</label>;
}

function ModalHeader({ eyebrow, title, subtitle, close, id }: { eyebrow: string; title: string; subtitle: string; close: () => void; id: string }) {
  return <header className="ap-modal-head"><div><Badge tone="blue">{eyebrow}</Badge><h2 id={id}>{title}</h2><p>{subtitle}</p></div>
    <button className="ap-close" type="button" aria-label="Close dialog" onClick={close}><X size={17}/></button>
  </header>;
}

function OptionCard({ checked, title, text, onClick }: { checked: boolean; title: string; text: string; onClick: () => void }) {
  return <button className={'ap-pattern-card' + (checked ? ' selected' : '')} type="button" aria-pressed={checked} onClick={onClick}>
    <strong>{title}</strong><span>{text}</span>
  </button>;
}

export function NewRequestDialog({ close }: { close: () => void }) {
  const [typeName, setTypeName] = useState('Purchase request');
  const [branch, setBranch] = useState('Head Office');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [additionalFields, setAdditionalFields] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState(false);
  const [error, setError] = useState('');
  const upload = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const requestType = useMemo(() => approvalTypes.find(item => item.name === typeName) ?? approvalTypes[0], [typeName]);

  useApprovalEscape(() => {
    if (message) setMessage(false);
    else if (review) setReview(false);
    else close();
  });
  const goToReview = () => {
    if (!title.trim() || !reason.trim()) { setError('Please complete the request title and business justification.'); return; }
    if (amount && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) { setError('Enter a valid estimated amount, or leave it blank.'); return; }
    setError('');
    setReview(true);
    body.current?.scrollTo({ top: 0 });
  };
  const goBack = () => { setReview(false); body.current?.scrollTo({ top: 0 }); };
  const chooseFiles = (items: FileList | null) => {
    if (!items?.length) return;
    setFiles(previous => [...previous, ...Array.from(items)]);
    if (upload.current) upload.current.value = '';
  };

  return <div className="ap-overlay ap-modal-center" onMouseDown={close}>
    <section className={'ap-modal ap-request-modal' + (review ? ' ap-review-modal' : '')} role="dialog" aria-modal="true" aria-labelledby="ap-new-request-title" onMouseDown={event => event.stopPropagation()}>
      <ModalHeader id="ap-new-request-title" eyebrow={review ? 'REQUEST SUMMARY' : 'NEW REQUEST · DESIGN PREVIEW'} title={review ? 'Review before submission' : 'Create a request'} subtitle={review ? 'A final check of the request and its approval path.' : 'Dynamic fields and approval paths follow the selected request type.'} close={close}/>
      <div className="ap-modal-content" ref={body}>
        {review ? <>
          <div className="ap-review-grid">
            <div><span>Title</span><strong>{title.trim()}</strong></div>
            <div><span>Request type</span><strong>{typeName}</strong></div>
            <div><span>Branch</span><strong>{branch}</strong></div>
            <div><span>Estimated amount</span><strong>{amount.trim() ? currency(Number(amount)) : 'Not set'}</strong></div>
          </div>
          <section className="ap-review-section"><h3>Reason</h3><p>{reason.trim()}</p></section>
          {Object.values(additionalFields).some(value => value.trim()) && <section className="ap-review-section">
            <h3>Type-specific information</h3>
            <dl className="ap-extra-summary">{Object.entries(additionalFields).filter(([,value]) => value.trim()).map(([key,value]) =>
              <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
          </section>}
          <section className="ap-review-section"><h3>Workflow snapshot</h3>
            <div className="ap-review-route">{requestType.route} · {requestType.pattern} · Version {requestType.version}</div>
          </section>
          <p className="ap-attachment-summary">{files.length} attachment(s) selected · file contents are not uploaded in this preview.</p>
          {files.length > 0 && <ul className="ap-review-files">{files.map((file, i) => <li key={file.name + i}>{file.name}</li>)}</ul>}
        </> : <>
          <section className="ap-form-block"><div className="ap-form-heading"><h3>Request information</h3><p>Required fields are marked with an asterisk.</p></div>
            <div className="ap-form-grid">
              <Field label="Request type" required><Select label="Request type" value={typeName} options={approvalTypes.filter(item => item.active).map(item => item.name)} onChange={next => { setTypeName(next); setAdditionalFields({}); setError(''); }}/></Field>
              <Field label="Branch"><Select label="Branch" value={branch} options={branches} onChange={setBranch}/></Field>
              <Field label="Request title" required><Input value={title} onChange={e => { setTitle(e.target.value); setError(''); }} placeholder="e.g. New laptop for store"/></Field>
              <Field label="Estimated amount"><Input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 4250 GEL"/></Field>
              <div className="ap-full"><Field label="Business justification" required><Textarea rows={3} value={reason} onChange={e => { setReason(e.target.value); setError(''); }} placeholder="What is needed and why?"/></Field></div>
            </div>
          </section>
          <section className="ap-form-block"><h3>Type-specific form</h3>
            <div className="ap-type-context"><strong>{requestType.name}</strong><span>Configured fields: {requestType.formFields.join(', ')}</span><Badge tone="blue">Form v{requestType.version}</Badge>
              <button type="button" className="ap-context-toggle" onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide fields' : 'Fill configured fields'} <ArrowRight size={13}/></button>
              {expanded && <div className="ap-configured-fields">{requestType.formFields.map(field => <Field key={field} label={field}><Input value={additionalFields[field] ?? ''} placeholder={'Enter ' + field.toLowerCase()} onChange={e => setAdditionalFields(p => ({ ...p, [field]: e.target.value }))}/></Field>)}</div>}
            </div>
          </section>
          <section className="ap-form-block"><h3>Approval route</h3>
            <div className="ap-route"><strong>{requestType.route}</strong><span>Each approver acts {requestType.pattern === 'Sequential' ? 'in sequence' : 'in parallel'}. Deadline reminders can escalate but never auto-approve.</span>
              <div className="ap-route-steps"><span>Submitted</span><ArrowRight size={15}/><span>{requestType.route}</span><ArrowRight size={15}/><span>Completed</span></div>
            </div>
          </section>
          <section className="ap-form-block"><h3>Supporting attachments</h3>
            <input className="ap-hidden-input" type="file" multiple ref={upload} onChange={e => chooseFiles(e.target.files)}/>
            <button className="ap-upload-zone" type="button" onClick={() => upload.current?.click()}>
              <UploadCloud size={22}/><strong>Choose files to attach</strong><span>PDF, images, spreadsheets or documents · multiple files</span>
            </button>
            {files.length ? <div className="ap-attachments">{files.map((file, i) => <div key={file.name + i}><Paperclip size={14}/><span>{file.name}</span>
              <button type="button" aria-label={'Remove ' + file.name} onClick={() => setFiles(p => p.filter((_,index) => index !== i))}><X size={14}/></button></div>)}</div> : <p className="ap-muted-note">No files selected</p>}
          </section>
          <p className="ap-compact-hint">New workflow versions apply to new requests only. Submitted requests keep their original form and approval path.</p>
          {error && <p className="ap-validation" role="alert">{error}</p>}
        </>}
      </div>
      <footer className="ap-modal-foot">
        {review ? <Button onClick={goBack}>Back to edit</Button> : <span>{'Prototype · no data will be submitted'}</span>}
        <Button variant="primary" onClick={() => review ? setMessage(true) : goToReview()}>{review ? 'Preview submission ✓' : 'Review request →'}</Button>
      </footer>
      {message && <PreviewMessage title="Submission preview ready" description="Your request has been reviewed as a design preview. No request, approval, notification or file has been created or uploaded." close={() => setMessage(false)}/>}
    </section>
  </div>;
}


export function ReviewDecisionDialog({ request, initial = 'Approve', close }: { request: ApprovalRequest; initial?: 'Approve' | 'Request changes' | 'Reject'; close: () => void }) {
  const [decision, setDecision] = useState<'Approve' | 'Request changes' | 'Reject'>(initial);
  const [comment, setComment] = useState('');
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  useApprovalEscape(() => review ? setReview(false) : close());
  const preview = () => {
    if (decision !== 'Approve' && !comment.trim()) { setError('Please add a reason for this decision.'); return; }
    setError('');
    setReview(true);
  };
  return <div className="ap-overlay ap-modal-center" onMouseDown={close}>
    <section className="ap-modal ap-decision-modal" role="dialog" aria-modal="true" aria-labelledby="ap-decision-title" onMouseDown={e => e.stopPropagation()}>
      <ModalHeader id="ap-decision-title" eyebrow="APPROVAL DECISION · PREVIEW"
        title={review ? 'Review approval decision' : 'Review request decision'}
        subtitle={review ? 'Confirm the chosen decision before closing this preview.' : 'Choose an action. No request status will be updated.'}
        close={close}/>
      <div className="ap-modal-content">
        <div className="ap-decision-summary"><strong>{request.title}</strong><span>{request.id} · {request.requester} · Step {request.step} of {request.totalSteps}</span></div>
        <h3 className="ap-decision-heading">Decision</h3>
        {review ? <>
          <div className="ap-review-route">{decision}</div>
          <section className="ap-review-section"><h3>Comment</h3><p>{comment.trim() || 'No comment'}</p></section>
          <p className="ap-compact-hint">Preview only. No decision is saved, and no notifications or audit entries are created.</p>
        </> : <>
          <div className="ap-decision-choices" role="group" aria-label="Approval decision">
            {(['Approve', 'Request changes', 'Reject'] as const).map(value => <button key={value} type="button" aria-pressed={decision === value}
              className={'ap-decision-option' + (decision === value ? ' selected' : '')} onClick={() => { setDecision(value); setError(''); }}>{value}</button>)}
          </div>
          <label className="ap-form-field"><span>Comment {decision === 'Approve' ? '(optional)' : '(required)'}</span>
            <Textarea value={comment} onChange={e => { setComment(e.target.value); setError(''); }} rows={3} placeholder="Add context for the requester"/></label>
          {error && <p className="ap-validation" role="alert">{error}</p>}
          <p className="ap-compact-hint">This is a demonstration of the approval interface; no decision can be submitted without backend authorization.</p>
        </>}
      </div>
      <footer className="ap-modal-foot">{review ? <Button onClick={() => setReview(false)}>Back to edit</Button> : <Button onClick={close}>Close</Button>}
        <Button variant="primary" onClick={() => review ? close() : preview()}>{review ? 'Close preview' : 'Preview decision'}</Button></footer>
    </section>
  </div>;
}

export function RequestTypeDialog({ close, initial }: { close: () => void; initial?: RequestType }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [code, setCode] = useState(initial?.code ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [fields, setFields] = useState(initial?.formFields.join(', ') ?? '');
  const [pattern, setPattern] = useState<ApprovalPattern>(initial?.pattern ?? 'Sequential');
  const [approvers, setApprovers] = useState(initial?.route ?? '');
  const [deadline, setDeadline] = useState(initial?.deadline ?? '3 business days');
  const [behavior, setBehavior] = useState(initial?.deadlineBehavior ?? 'Reminder then escalate');
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState(false);
  const [error, setError] = useState('');
  const body = useRef<HTMLDivElement>(null);
  useApprovalEscape(() => {
    if (message) setMessage(false);
    else if (review) setReview(false);
    else close();
  });
  const previewType = () => {
    if (!name.trim() || !code.trim() || !approvers.trim()) { setError('Name, unique code and approvers are required.'); return; }
    if (!/^[A-Z][A-Z0-9_]*$/.test(code.trim())) { setError('Use an uppercase code with letters, numbers or underscores.'); return; }
    setError('');
    setReview(true);
    body.current?.scrollTo({ top: 0 });
  };

  return <div className="ap-overlay ap-modal-center" onMouseDown={close}>
    <section className="ap-modal ap-type-modal" role="dialog" aria-modal="true" aria-labelledby="ap-new-type-title" onMouseDown={event => event.stopPropagation()}>
      <ModalHeader id="ap-new-type-title" eyebrow={review ? 'REQUEST TYPE PREVIEW' : initial ? 'REQUEST TYPE · DESIGN PREVIEW' : 'NEW REQUEST TYPE'} title={review ? 'Review request type' : initial ? 'Configure request type' : 'Configure request type'} subtitle={review ? 'Configuration overview · no changes saved' : 'Define the form and approval route.'} close={close}/>
      <div className="ap-modal-content" ref={body}>
        {review ? <>
          <div className="ap-review-grid"><div><span>Name</span><strong>{name}</strong></div><div><span>Unique code</span><strong>{code}</strong></div>
            <div><span>Approval pattern</span><strong>{pattern}</strong></div><div><span>Version</span><strong>{initial ? initial.version + 1 : 1} · proposed</strong></div>
            <div><span>Default deadline</span><strong>{deadline}</strong></div><div><span>Deadline behavior</span><strong>{behavior}</strong></div>
          </div>
          <section className="ap-review-section"><h3>Description</h3><p>{description || 'Not specified'}</p></section>
          <section className="ap-review-section"><h3>Configured form fields</h3><p>{fields || 'No additional fields'}</p></section>
          <section className="ap-review-section"><h3>Approval route</h3><div className="ap-review-route">{approvers} · {pattern}</div></section>
          <p className="ap-compact-hint">New types start at version 1. Changing existing types would create a new version; historical request snapshots remain unchanged.</p>
        </> : <>
          <div className="ap-form-grid">
            <Field label="Name" required><Input value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="e.g. Equipment request"/></Field>
            <Field label="Unique code" required><Input value={code} onChange={e => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,'')); setError(''); }} placeholder="EQUIPMENT"/></Field>
            <div className="ap-full"><Field label="Description"><Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this type for?"/></Field></div>
            <div className="ap-full"><Field label="Form fields"><Textarea rows={3} value={fields} onChange={e => setFields(e.target.value)} placeholder="Field names separated by commas"/></Field></div>
          </div>
          <section className="ap-form-block"><h3>Approval pattern</h3>
            <div className="ap-pattern-grid">
              <OptionCard checked={pattern === 'Sequential'} title="Sequential" text="Each approver signs off in order, one step at a time." onClick={() => setPattern('Sequential')}/>
              <OptionCard checked={pattern === 'Parallel'} title="Parallel" text="Multiple approvers can decide at the same time." onClick={() => setPattern('Parallel')}/>
            </div>
          </section>
          <div className="ap-form-grid">
            <div className="ap-full"><Field label="Approvers (roles or named users)" required><Input value={approvers} onChange={e => { setApprovers(e.target.value); setError(''); }} placeholder="e.g. Line Manager → Finance Manager"/></Field></div>
            <Field label="Default deadline"><Select label="Default deadline" value={deadline} options={deadlines} onChange={setDeadline}/></Field>
            <Field label="Deadline behavior"><Select label="Deadline behavior" value={behavior} options={deadlineBehaviors} onChange={setBehavior}/></Field>
          </div>
          <p className="ap-compact-hint">A new type starts at version 1. Existing request snapshots do not change. Types with history are deactivated, not deleted.</p>
          {error && <p className="ap-validation" role="alert">{error}</p>}
        </>}
      </div>
      <footer className="ap-modal-foot">
        {review ? <Button onClick={() => setReview(false)}>Back to edit</Button> : <span>Draft configuration</span>}
        <Button variant="primary" onClick={() => review ? setMessage(true) : previewType()}>{review ? 'Preview configuration ✓' : 'Preview type'}</Button>
      </footer>
      {message && <PreviewMessage title="Request type preview ready" description="This is a demonstration of the configuration. No request type or workflow version has been created or updated in the database." close={() => setMessage(false)}/>}
    </section>
  </div>;
}
