import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Box, Check, ClipboardCheck, FileText, X } from 'lucide-react';
import { Badge, Button, Input, NumberInput, Select, Textarea } from '../components/ui';
import {
  currencies, formatCost, incidents, issueTypes, priorityOptions, repeatFrequencies, responsibleTeams,
  type Incident, type IssueType, type PreventiveSchedule, type ServiceChannel
} from './maintenance-data';

function useMaintenanceEscape(onEscape: () => void) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function handleKey(event: KeyboardEvent) {
      if (event.key !== 'Escape' || document.querySelector('.ui-select[aria-expanded="true"]')) return;
      event.stopImmediatePropagation();
      onEscape();
    }
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); document.body.style.overflow = previous; };
  }, [onEscape]);
}

function DialogHeader({ eyebrow, title, subtitle, close, id }: {
  eyebrow: string; title: string; subtitle: string; close: () => void; id: string;
}) {
  return <header className="mt-dialog-head"><div>
    <Badge tone="blue">{eyebrow}</Badge><h2 id={id}>{title}</h2><p>{subtitle}</p>
  </div><button type="button" className="mt-dialog-close" aria-label="Close dialog" onClick={close}><X size={17}/></button></header>;
}

function Field({ title, required = false, children }: { title: string; required?: boolean; children: ReactNode }) {
  return <div className="mt-field"><span>{title}{required && <b> *</b>}</span>{children}</div>;
}

function SummaryGrid({ values }: { values: { label: string; value: string }[] }) {
  return <div className="mt-detail-grid">{values.map(({ label, value }) =>
    <div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>;
}

function PreviewNoticeContent({ title, description, close }: {
  title: string; description: string; close: () => void;
}) {
  return <section className="mt-notice" role="alertdialog" aria-modal="true" aria-labelledby="mt-notice-title" onMouseDown={event => event.stopPropagation()}>
    <span className="mt-notice-icon"><ClipboardCheck size={23}/></span>
    <h2 id="mt-notice-title">{title}</h2><p>{description}</p><Button variant="primary" onClick={close}>Got it</Button>
  </section>;
}
export function MaintenanceNotice({ title, description, close }: {
  title: string; description: string; close: () => void;
}) {
  useMaintenanceEscape(close);
  return <div className="mt-notice-layer" onMouseDown={close}><PreviewNoticeContent title={title} description={description} close={close}/></div>;
}

function FilePicker({ files, addFiles, removeFile, caption }: {
  files: File[]; addFiles: (files: FileList | null) => void; removeFile: (index: number) => void; caption: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return <>
    <input className="mt-file-input" type="file" multiple ref={ref} aria-label="Choose supporting documents"
      onChange={event => { addFiles(event.target.files); event.target.value = ''; }}/>
    <button type="button" className={'mt-upload-zone' + (dragging ? ' dragging' : '')}
      onClick={() => ref.current?.click()}
      onDragEnter={event => { event.preventDefault(); setDragging(true); }}
      onDragOver={event => event.preventDefault()}
      onDragLeave={event => { event.preventDefault(); setDragging(false); }}
      onDrop={event => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}>
      <Box size={21}/><strong>{caption}</strong><small>Multiple files supported · preview only</small>
    </button>
    {files.length ? <div className="mt-file-list">{files.map((file, index) =>
      <div key={file.name + ':' + index}><FileText size={14}/><span>{file.name}</span>
        <button type="button" aria-label={'Remove ' + file.name} onClick={() => removeFile(index)}><X size={15}/></button>
      </div>)}</div> : <p className="mt-no-files">No files selected</p>}
  </>;
}

export function ReportIncidentDialog({ close }: { close: () => void }) {
  const [resource, setResource] = useState(incidents[0].resource);
  const [issue, setIssue] = useState<IssueType>('Malfunction');
  const [priority, setPriority] = useState('Medium');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [review, setReview] = useState(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState('');
  const body = useRef<HTMLDivElement>(null);
  const resourceOptions = [...new Set(incidents.map(item => item.resource))];
  const addFiles = (items: FileList | null) => { if (items?.length) setFiles(prev => [...prev, ...Array.from(items)]); setError(''); };

  useMaintenanceEscape(() => {
    if (notice) setNotice(false);
    else if (review) { setReview(false); body.current?.scrollTo(0, 0); }
    else close();
  });
  const toReview = () => {
    if (!description.trim()) { setError('Please describe the issue before continuing.'); return; }
    if (issue === 'Damage' && !files.length) { setError('Please add a photo or supporting evidence for a damaged resource.'); return; }
    setError(''); setReview(true); body.current?.scrollTo(0, 0);
  };

  return <div className="mt-overlay" onMouseDown={close}>
    <aside className="mt-dialog mt-form-drawer" role="dialog" aria-modal="true" aria-labelledby="mt-report-title"
      onMouseDown={event => event.stopPropagation()}>
      <DialogHeader id="mt-report-title" eyebrow={review ? 'INCIDENT REVIEW' : 'REPORT AN INCIDENT'}
        title={review ? 'Review reported issue' : 'Report resource issue'}
        subtitle={review ? 'Confirm the information before creating the sample incident.' : 'Create an incident for an assigned or branch-managed asset.'}
        close={close}/>
      <div className="mt-dialog-body" ref={body}>
        {review ? <>
          <SummaryGrid values={[
            { label: 'Resource', value: resource },
            { label: 'Issue type', value: issue },
            { label: 'Priority', value: priority },
            { label: 'Reporter', value: 'Sandro Papiashvili' }
          ]}/>
          <section className="mt-form-section"><h3>Description</h3><p className="mt-review-copy">{description}</p></section>
          {files.length > 0 && <div className="mt-evidence-preview">{files.map((file, index) =>
            <span key={file.name + index}><FileText size={14}/>{file.name}</span>)}</div>}
          <p className="mt-info-banner">{files.length} evidence file(s) selected. No production incident or file upload will occur.</p>
        </> : <>
          <section className="mt-form-section mt-first-section"><h3>Resource & issue</h3>
            <div className="mt-form-grid">
              <Field title="Affected resource" required><Select label="Affected resource" value={resource} options={resourceOptions} onChange={setResource}/></Field>
              <Field title="Issue type" required><Select label="Issue type" value={issue} options={issueTypes} onChange={value => { setIssue(value as IssueType); setError(''); }}/></Field>
              <Field title="Priority" required><Select label="Priority" value={priority} options={priorityOptions} onChange={setPriority}/></Field>
              <Field title="Reported by"><Input readOnly aria-label="Reported by" value="Sandro Papiashvili"/></Field>
              <div className="mt-full"><Field title="Issue description" required>
                <Textarea rows={4} aria-label="Issue description" placeholder="Describe the symptoms, circumstances and impact..."
                  value={description} onChange={event => { setDescription(event.target.value); setError(''); }}/>
              </Field></div>
            </div>
          </section>
          <section className="mt-form-section"><h3>Supporting evidence</h3>
            <FilePicker files={files} addFiles={addFiles} removeFile={index => setFiles(prev => prev.filter((_,i) => i !== index))}
              caption="Choose photos, videos or documents"/>
            <p className="mt-muted-note">Evidence is required for damaged assets; all selected files remain in the browser.</p>
          </section>
          <p className="mt-info-banner">Reporting requires no approval. A repair may require manager approval; resource availability is restricted while maintenance is underway.</p>
          {error && <p className="mt-validation" role="alert">{error}</p>}
        </>}
      </div>
      <footer className="mt-dialog-footer">
        {review ? <Button onClick={() => { setReview(false); body.current?.scrollTo(0, 0); }}>Back to edit</Button>
          : <span className="mt-footer-hint">Step 1 of 2 · Incident preview</span>}
        <span className="mt-footer-spacer"/>
        <Button variant="primary" onClick={() => review ? setNotice(true) : toReview()}>
          {review ? 'Preview report' : 'Review incident'} {review ? <Check size={15}/> : <ArrowRight size={15}/>}</Button>
      </footer>
      {notice && <div className="mt-notice-layer" onMouseDown={event => { event.stopPropagation(); setNotice(false); }}>
        <PreviewNoticeContent title="Incident preview complete"
          description="The incident was reviewed successfully. No incident, evidence file, approval, notification or audit record was saved."
          close={() => setNotice(false)}/></div>}
    </aside>
  </div>;
}

export function PreventiveScheduleDialog({ initial, close }: { initial: PreventiveSchedule | null; close: () => void }) {
  const [task, setTask] = useState(initial?.task ?? '');
  const [assetGroup, setAssetGroup] = useState(initial?.assetGroup ?? '');
  const [frequency, setFrequency] = useState(initial?.frequency ?? 'Every 3 months');
  const [serviceDate, setServiceDate] = useState(initial?.nextService ? new Date(initial.nextService).toISOString().slice(0,10) : '');
  const [team, setTeam] = useState(initial?.owner ?? 'IT Support');
  const [review, setReview] = useState(Boolean(initial));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(false);

  useMaintenanceEscape(() => {
    if (notice) setNotice(false);
    else if (review) setReview(false);
    else close();
  });
  const validate = () => {
    if (!task.trim() || !assetGroup.trim()) { setError('Maintenance task and asset/group are required.'); return; }
    if (!serviceDate || Number.isNaN(Date.parse(serviceDate))) { setError('Please choose a valid next service date.'); return; }
    setError(''); setReview(true);
  };

  return <div className="mt-overlay" onMouseDown={close}><aside className="mt-dialog mt-form-drawer" role="dialog" aria-modal="true"
    aria-labelledby="mt-plan-title" onMouseDown={event => event.stopPropagation()}>
    <DialogHeader id="mt-plan-title" eyebrow="PREVENTIVE MAINTENANCE"
      title={review ? 'Review maintenance schedule' : 'Plan preventive service'}
      subtitle="Set recurring maintenance for selected assets or asset groups." close={close}/>
    <div className="mt-dialog-body">
      <div className="mt-form-grid">
        <Field title="Maintenance task" required><Input aria-label="Maintenance task" placeholder="e.g. Device inspection"
          value={task} readOnly={review} onChange={event => { setTask(event.target.value); setError(''); }}/></Field>
        <Field title="Asset / group" required><Input aria-label="Asset / group" placeholder="Resource or branch fleet"
          value={assetGroup} readOnly={review} onChange={event => { setAssetGroup(event.target.value); setError(''); }}/></Field>
        <Field title="Repeat frequency"><Select label="Repeat frequency" options={repeatFrequencies}
          value={frequency} onChange={value => { if (!review) setFrequency(value); }}/></Field>
        <Field title="Next service date"><Input type="date" aria-label="Next service date"
          value={serviceDate} readOnly={review} onChange={event => { setServiceDate(event.target.value); setError(''); }}/></Field>
        <Field title="Responsible team"><Select label="Responsible team" options={responsibleTeams}
          value={team} onChange={value => { if (!review) setTeam(value); }}/></Field>
      </div>
      <p className="mt-info-banner">Upcoming maintenance can generate reminders. A completed service becomes part of the resource's full maintenance history.</p>
      {error && <p className="mt-validation" role="alert">{error}</p>}
    </div>
    <footer className="mt-dialog-footer">
      {review ? <Button onClick={() => setReview(false)}>Back to edit</Button> : <Button onClick={close}>Close</Button>}
      <span className="mt-footer-spacer"/>
      <Button variant="primary" onClick={() => review ? setNotice(true) : validate()}>Preview schedule</Button>
    </footer>
    {notice && <div className="mt-notice-layer" onMouseDown={event => { event.stopPropagation(); setNotice(false); }}>
      <PreviewNoticeContent title="Maintenance schedule preview"
        description="The schedule details have been reviewed. No recurring task, notification or maintenance record was created or updated."
        close={() => setNotice(false)}/></div>}
  </aside></div>;
}

function IncidentStatusPill({ status }: { status: Incident['status'] }) {
  return <span className={'mt-pill mt-status-' + status.toLowerCase().replace(/\s+/g,'-')}><i className="mt-pill-dot"/>{status}</span>;
}
function IncidentPriorityPill({ priority }: { priority: Incident['priority'] }) {
  return <span className={'mt-pill mt-priority-' + priority.toLowerCase()}><i className="mt-pill-dot"/>{priority}</span>;
}

export function IncidentDetailsDrawer({ incident, close }: { incident: Incident; close: () => void }) {
  const [view, setView] = useState<'details' | 'assignment' | 'resolution'>('details');
  const [notice, setNotice] = useState('');
  useMaintenanceEscape(() => {
    if (notice) setNotice('');
    else if (view !== 'details') setView('details');
    else close();
  });
  const back = () => setView('details');
  return <div className="mt-overlay" onMouseDown={close}>
    <aside className={'mt-dialog ' + (view === 'details' ? 'mt-details-drawer' : 'mt-workflow-drawer')}
      role="dialog" aria-modal="true" aria-labelledby="mt-details-title" onMouseDown={event => event.stopPropagation()}>
      <DialogHeader id="mt-details-title" close={close}
        eyebrow={view === 'details' ? 'INCIDENT DETAILS · ' + incident.id : view === 'assignment' ? 'SERVICE ASSIGNMENT' : 'RESOLUTION & CLOSURE'}
        title={view === 'details' ? incident.resource : view === 'assignment' ? 'Assign repair or investigation' : 'Record service resolution'}
        subtitle={view === 'details' ? 'Review issue, assigned service, expense and activity history.'
          : incident.id + ' · ' + incident.resource}/>
      {view === 'details' ? <>
        <div className="mt-dialog-body">
          <div className="mt-detail-tags"><IncidentStatusPill status={incident.status}/><IncidentPriorityPill priority={incident.priority}/>
            <span>{incident.id} · {incident.resourceId}</span></div>
          <SummaryGrid values={[
            {label:'Issue type',value:incident.issue},{label:'Reported by',value:incident.reporter},
            {label:'Reported on',value:incident.reported},{label:'Location',value:incident.branch},
            {label:'Service owner',value:incident.assignedTo},{label:'Asset condition',value:incident.condition}
          ]}/>
          <section className="mt-form-section"><h3>Reported issue</h3><p className="mt-review-copy mt-description">{incident.description}</p></section>
          <section className="mt-form-section"><h3>Service workflow</h3><div className="mt-steps">
            <div className="mt-step completed"><span className="mt-step-dot"><Check size={15}/></span><div><strong>Incident reported</strong>
              <small>Submission immediately creates a record and logs the reporter.</small></div></div>
            <div className={'mt-step' + (incident.workflowStep === 2 ? ' current' : incident.workflowStep === 3 ? ' completed' : '')}>
              <span className="mt-step-dot">{incident.workflowStep === 3 ? <Check size={14}/> : '2'}</span>
              <div><strong>Service assignment</strong><small>Internal technician or external provider; repair approval when required.</small></div></div>
            <div className={'mt-step' + (incident.workflowStep === 3 ? ' current' : '')}>
              <span className="mt-step-dot">3</span><div><strong>Resolution & condition review</strong>
                <small>Authorized closure requires resolution notes and reassessed condition.</small></div></div>
          </div></section>
          <section className="mt-form-section"><h3>Service & costs</h3><SummaryGrid values={[
            {label:'Provider',value:incident.provider},{label:'Estimated / recorded cost',value:formatCost(incident.cost,incident.currency)}
          ]}/></section>
          <section className="mt-form-section"><h3>Evidence & documents</h3>{incident.evidence.length ?
            <div className="mt-evidence-preview">{incident.evidence.map(name => <span key={name}><FileText size={14}/>{name} · sample</span>)}</div>
            : <p className="mt-muted-note">No evidence attached to this sample record.</p>}</section>
          <section className="mt-form-section"><h3>Audit timeline</h3>
            <p className="mt-info-banner">{incident.reporter} reported {incident.issue.toLowerCase()} on {incident.reported}. Further actions will be logged with their actor and timestamp.</p>
          </section>
          <p className="mt-info-banner">Assets in maintenance cannot be assigned to another employee.</p>
        </div>
        <footer className="mt-dialog-footer"><Button onClick={close}>Close</Button>
          <span className="mt-footer-spacer"/><Button onClick={() => setView('assignment')}>Assign service</Button>
          <Button variant="primary" onClick={() => setView('resolution')}>Record resolution</Button></footer>
      </> : view === 'assignment' ? <ServiceAssignmentForm incident={incident} back={back} preview={setNotice}/>
        : <ResolutionForm incident={incident} back={back} preview={setNotice}/>}
      {!!notice && <div className="mt-notice-layer" onMouseDown={event => { event.stopPropagation(); setNotice(''); }}>
        <PreviewNoticeContent title="Workflow preview" description={notice} close={() => setNotice('')}/></div>}
    </aside>
  </div>;
}

function ServiceAssignmentForm({ incident, back, preview }: {
  incident: Incident; back: () => void; preview: (message: string) => void;
}) {
  const [channel, setChannel] = useState<ServiceChannel>('Internal team');
  const [assignee, setAssignee] = useState('IT Support');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [currency, setCurrency] = useState('GEL');
  const [approval, setApproval] = useState('Manager approval required');
  const [error, setError] = useState('');
  const chooseChannel = (value: ServiceChannel) => {
    setChannel(value); setAssignee(value === 'Internal team' ? 'IT Support' : 'TechCare Service'); setError('');
  };
  const review = () => {
    const amount = Number(estimatedCost);
    if (estimatedCost && (!Number.isFinite(amount) || amount < 0)) { setError('Enter a non-negative estimated repair cost.'); return; }
    setError(''); preview('Service assignment preview: ' + incident.id + ' would be assigned to ' + assignee +
      ' via ' + channel.toLowerCase() + '. Estimated cost: ' + (estimatedCost ? formatCost(amount,currency) : 'not specified') +
      '. Approval policy: ' + approval + '. No production assignment, approval or audit record has been changed.');
  };

  return <>
    <div className="mt-dialog-body">
      <Field title="Service channel"><div className="mt-channel-options">
        {(['Internal team','External provider'] as ServiceChannel[]).map(value =>
          <button type="button" key={value} aria-pressed={channel === value}
            className={'mt-channel-choice' + (channel === value ? ' selected' : '')} onClick={() => chooseChannel(value)}>
            <strong>{value}</strong><small>{value === 'Internal team' ? 'Assign a colleague or IT support specialist.' : 'Register a service company and estimate.'}</small>
          </button>)}</div></Field>
      <div className="mt-form-grid mt-workflow-fields">
        <Field title={channel === 'Internal team' ? 'Assigned technician' : 'External provider'} required>
          <Select label="Assigned technician or provider" value={assignee}
            options={channel === 'Internal team' ? ['IT Support','Facilities','Operations','Branch Manager']
              : ['TechCare Service','PrintFix','Authorized repair center']}
            onChange={setAssignee}/></Field>
        <Field title="Estimated repair cost"><NumberInput aria-label="Estimated repair cost" min={0} step="0.01"
          placeholder="e.g. 250" value={estimatedCost} onChange={event => { setEstimatedCost(event.target.value); setError(''); }}/></Field>
        <Field title="Currency"><Select label="Currency" options={currencies} value={currency} onChange={setCurrency}/></Field>
        <Field title="Approval requirement"><Select label="Approval requirement" value={approval}
          options={['Manager approval required','No manager approval','Follow configured policy']} onChange={setApproval}/></Field>
      </div>
      <p className="mt-info-banner">Service assignment and any required approval are logged separately. Reporting itself never waits for approval.</p>
      {error && <p className="mt-validation" role="alert">{error}</p>}
    </div>
    <footer className="mt-dialog-footer"><Button onClick={back}>Back</Button><span className="mt-footer-spacer"/>
      <Button variant="primary" onClick={review}>Preview assignment</Button></footer>
  </>;
}

function ResolutionForm({ incident, back, preview }: {
  incident: Incident; back: () => void; preview: (message: string) => void;
}) {
  const [outcome, setOutcome] = useState('Repaired / returned to service');
  const [condition, setCondition] = useState('Good');
  const [cost, setCost] = useState(incident.cost ? String(incident.cost) : '');
  const [currency, setCurrency] = useState<string>(incident.currency);
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const addFiles = (items: FileList | null) => { if (items?.length) setFiles(prev => [...prev,...Array.from(items)]); };
  const review = () => {
    const amount = Number(cost);
    if (cost && (!Number.isFinite(amount) || amount < 0)) { setError('Final repair cost must be zero or higher.'); return; }
    if (!notes.trim()) { setError('Resolution notes or a closure reason are required.'); return; }
    setError('');
    preview('Resolution preview for ' + incident.id + ': ' + outcome + ', condition ' + condition.toLowerCase() +
      ', final cost ' + (cost ? formatCost(amount,currency) : 'not entered') + ', ' + files.length +
      ' locally selected document(s). No production incident status, asset condition, expenses or audit records have changed.');
  };

  return <>
    <div className="mt-dialog-body">
      <div className="mt-form-grid">
        <Field title="Resolution outcome" required><Select label="Resolution outcome" value={outcome}
          options={['Repaired / returned to service','Replaced','Unrepairable / retirement review','Lost / disposal review']}
          onChange={setOutcome}/></Field>
        <Field title="Reassessed condition" required><Select label="Reassessed condition" value={condition}
          options={['Good','Needs attention','Damaged','Unusable']} onChange={setCondition}/></Field>
        <Field title="Final cost"><NumberInput aria-label="Final cost" min={0} step="0.01"
          value={cost} onChange={event => { setCost(event.target.value); setError(''); }}/></Field>
        <Field title="Currency"><Select label="Currency" options={currencies} value={currency} onChange={setCurrency}/></Field>
        <div className="mt-full"><Field title="Resolution notes / closure reason" required><Textarea aria-label="Resolution notes / closure reason" rows={4}
          placeholder="Explain the repair outcome, testing and closure decision..." value={notes}
          onChange={event => { setNotes(event.target.value); setError(''); }}/></Field></div>
      </div>
      <section className="mt-form-section"><h3>Supporting document</h3>
        <FilePicker files={files} addFiles={addFiles} removeFile={index => setFiles(prev => prev.filter((_,i) => i !== index))}
          caption="Choose service report or invoice"/>
        <p className="mt-muted-note">Optional for this preview</p>
      </section>
      <p className="mt-info-banner">Closure must be authorized and creates an audit trail. An unrepairable or lost resource may require a separate disposal review.</p>
      {error && <p className="mt-validation" role="alert">{error}</p>}
    </div>
    <footer className="mt-dialog-footer"><Button onClick={back}>Back</Button><span className="mt-footer-spacer"/>
      <Button variant="primary" onClick={review}>Preview closure</Button></footer>
  </>;
}
