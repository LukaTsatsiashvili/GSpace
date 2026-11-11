import { useEffect, useState, type ReactNode } from 'react';
import { Check, ClipboardCopy, Download, FileJson, X } from 'lucide-react';
import { Badge, Button, Input, NumberInput, Select } from '../components/ui';
import {
  auditActionOptions, auditActorOptions, auditBranchOptions, demoFilters,
  diagnosticEvents, displayTimestamp, resultOptions, severityOptions, timeRanges,
  sampleAuditJSON, type AuditEvent, type AuditFilters, type DiagnosticEvent
} from './audit-data';

function useDialogEscape(close:()=>void) {
  useEffect(()=>{
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const handler=(event:KeyboardEvent)=>{
      if(event.key!=='Escape'||document.querySelector('.ui-select[aria-expanded="true"]'))return;
      event.stopImmediatePropagation();
      close();
    };
    document.addEventListener('keydown',handler);
    return ()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=previous;};
  },[close]);
}
function DialogHead({id,eyebrow,title,subtitle,close}:{id:string;eyebrow:string;title:string;subtitle:string;close:()=>void}) {
  return <header className="ad-dialog-head"><div><Badge tone="blue">{eyebrow}</Badge><h2 id={id}>{title}</h2><p>{subtitle}</p></div>
    <button type="button" className="ad-dialog-close" aria-label="Close dialog" onClick={close}><X size={17}/></button>
  </header>;
}
function Field({name,children}:{name:string;children:ReactNode}) {
  return <div className="ad-field"><span>{name}</span>{children}</div>;
}
function Summary({items}:{items:{label:string;value:string}[]}) {
  return <div className="ad-summary-grid">{items.map(item=><div key={item.label}><small>{item.label}</small><strong>{item.value}</strong></div>)}</div>;
}
function Info({children}:{children:ReactNode}) { return <p className="ad-info-banner">{children}</p>; }
function SeverityPill({value}:{value:string}) {
  return <span className={'ad-pill ad-severity-'+value.toLowerCase()}><i/>{value}</span>;
}
function ResultPill({value}:{value:string}) {
  return <span className={'ad-pill ad-result-'+value.toLowerCase().replace(/ /g,'-')}><i/>{value}</span>;
}
function NoticeContent({title,description,close}:{title:string;description:string;close:()=>void}) {
  return <div className="ad-notice" role="alertdialog" aria-modal="true" aria-labelledby="ad-notice-heading"
    onMouseDown={event=>event.stopPropagation()}>
    <span className="ad-notice-icon"><Check size={23}/></span>
    <h2 id="ad-notice-heading">{title}</h2><p>{description}</p>
    <Button variant="primary" onClick={close}>Got it</Button>
  </div>;
}
export function AuditNotice({title,description,close}:{title:string;description:string;close:()=>void}) {
  useDialogEscape(close);
  return <div className="ad-notice-layer" onMouseDown={close}>
    <NoticeContent title={title} description={description} close={close}/>
  </div>;
}

export function AdvancedAuditFiltersDialog({initial,apply,close,diagnostics=false}:{
  initial:AuditFilters;apply:(filters:AuditFilters)=>void;close:()=>void;diagnostics?:boolean;
}) {
  const [form,setForm]=useState<AuditFilters>({...initial});
  const [error,setError]=useState('');
  useDialogEscape(close);
  const change=(key:keyof AuditFilters,value:string)=>{
    setForm(previous=>({...previous,[key]:value}));
    setError('');
  };
  const submit=()=>{
    if(form.range==='Custom range' && (!form.startDate||!form.endDate||form.startDate>form.endDate)){
      setError('Choose a valid start and end date.');return;
    }
    apply(form);
  };
  return <div className="ad-overlay ad-centered" onMouseDown={close}>
    <section className="ad-dialog ad-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="ad-filters-title"
      onMouseDown={event=>event.stopPropagation()}>
      <DialogHead id="ad-filters-title" eyebrow="ADVANCED AUDIT FILTERS" title="Refine event history"
        subtitle="Filter the audit trail by actor, action, branch and outcome." close={close}/>
      <div className="ad-dialog-body">
        <div className="ad-form-grid">
          {!diagnostics && <>
            <Field name="Actor"><Select label="Filter actor" value={form.actor} options={auditActorOptions} onChange={value=>change('actor',value)}/></Field>
            <Field name="Action"><Select label="Filter action" value={form.action} options={auditActionOptions} onChange={value=>change('action',value)}/></Field>
            <Field name="Branch"><Select label="Filter branch" value={form.branch} options={auditBranchOptions} onChange={value=>change('branch',value)}/></Field>
            <Field name="Result"><Select label="Filter result" value={form.result} options={resultOptions} onChange={value=>change('result',value)}/></Field>
          </>}
          <Field name="Date range"><Select label="Filter date range" value={form.range} options={timeRanges} onChange={value=>change('range',value)}/></Field>
          <Field name="Severity"><Select label="Filter severity" value={form.severity} options={severityOptions} onChange={value=>change('severity',value)}/></Field>
          {form.range==='Custom range' && <>
            <Field name="From"><Input aria-label="Audit start date" type="date" value={form.startDate} onChange={event=>change('startDate',event.target.value)}/></Field>
            <Field name="To"><Input aria-label="Audit end date" type="date" value={form.endDate} onChange={event=>change('endDate',event.target.value)}/></Field>
          </>}
        </div>
        <Info>Server-side filtering and pagination protect performance for large audit histories. Search supports event ID, target entity and Request ID. This screen uses sample records.</Info>
        {error&&<p className="ad-error" role="alert">{error}</p>}
      </div>
      <footer className="ad-dialog-footer">
        <Button onClick={()=>{setForm({...demoFilters});setError('');}}>Clear filters</Button>
        <span className="ad-footer-spacer"/>
        <Button variant="primary" onClick={submit}>Apply filters</Button>
      </footer>
    </section>
  </div>;
}

export function AuditEventDrawer({event,close}:{event:AuditEvent;close:()=>void}) {
  const [message,setMessage]=useState('');
  useDialogEscape(()=>{if(message)setMessage('');else close();});
  const copyJSON=async()=>{
    try {
      if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(sampleAuditJSON(event));
      setMessage('Sample event JSON copied to your clipboard. This contains only demonstration fields, not production secrets.');
    } catch {
      setMessage('Clipboard permission is unavailable. You can use Export event to save the sample JSON instead.');
    }
  };
  const exportEvent=()=>{
    try {
      const blob=new Blob([sampleAuditJSON(event)],{type:'application/json'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='sample-'+event.id+'.json';
      document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
      setMessage('Sample event JSON exported. No real audit records or sensitive payloads were accessed.');
    } catch {
      setMessage('Could not create the local sample export in this browser.');
    }
  };
  return <div className="ad-overlay" onMouseDown={close}>
    <aside className="ad-dialog ad-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="ad-event-title"
      onMouseDown={e=>e.stopPropagation()}>
      <DialogHead id="ad-event-title" eyebrow={'AUDIT EVENT · '+event.id} title={event.action}
        subtitle={event.description} close={close}/>
      <div className="ad-dialog-body">
        <div className="ad-detail-tags"><ResultPill value={event.result}/><SeverityPill value={event.severity}/>
          <span>{event.category.toLowerCase()} · sample immutable record</span></div>
        <Summary items={[
          {label:'Actor',value:event.actor},{label:'Timestamp',value:displayTimestamp(event.timestamp)},
          {label:'Module',value:event.module},{label:'Entity',value:event.entity},
          {label:'Branch',value:event.branch},{label:'Action',value:event.action},
          {label:'IP address',value:event.ip+' (sample)'},{label:'Request ID',value:event.requestId}
        ]}/>
        <section className="ad-detail-section"><h3>Changed fields · Before / After</h3>
          {event.previous&&event.next?
            <div className="ad-change-grid">
              <div className="ad-change-card"><div className="ad-change-head previous">Previous values</div>
                <p>{event.previous.field}</p><strong>{event.previous.value}</strong></div>
              <div className="ad-change-card"><div className="ad-change-head next">New values</div>
                <p>{event.next.field}</p><strong>{event.next.value}</strong></div>
            </div>:
            <p className="ad-muted-copy">No before/after values are available for this sample event. Passwords, authentication secrets and private payloads are never shown.</p>}
        </section>
        <section className="ad-detail-section"><h3>Event context</h3>
          <Info>{event.description} Request: {event.requestId} · user agent and technical metadata may be viewed by authorized investigators after backend integration.</Info>
        </section>
        <section className="ad-detail-section"><h3>Security & integrity</h3>
          <p className="ad-muted-copy">This example represents an append-only audit event. Actual access controls, immutable storage, retention and redaction must be implemented on the server. Sensitive authentication secrets and private document contents must not be logged.</p>
        </section>
      </div>
      <footer className="ad-dialog-footer"><Button onClick={close}>Close</Button><span className="ad-footer-spacer"/>
        <Button icon={<ClipboardCopy size={15}/>} onClick={copyJSON}>Copy event JSON</Button>
        <Button variant="primary" icon={<Download size={15}/>} onClick={exportEvent}>Export event</Button>
      </footer>
      {message&&<div className="ad-notice-layer" onMouseDown={e=>{e.stopPropagation();setMessage('');}}>
        <NoticeContent title="Event action" description={message} close={()=>setMessage('')}/>
      </div>}
    </aside>
  </div>;
}

export function DiagnosticEventDrawer({event,close}:{event:DiagnosticEvent;close:()=>void}) {
  useDialogEscape(close);
  return <div className="ad-overlay" onMouseDown={close}>
    <aside className="ad-dialog ad-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="ad-diagnostic-title"
      onMouseDown={e=>e.stopPropagation()}>
      <DialogHead id="ad-diagnostic-title" eyebrow={'DIAGNOSTIC EVENT · '+event.id} title={event.service}
        subtitle={event.description} close={close}/>
      <div className="ad-dialog-body">
        <div className="ad-detail-tags"><SeverityPill value={event.severity}/><ResultPill value={event.status}/></div>
        <Summary items={[
          {label:'Timestamp',value:displayTimestamp(event.timestamp)},
          {label:'Service',value:event.service},
          {label:'Operation',value:event.operation},
          {label:'Error code',value:event.errorCode},
          {label:'Request ID',value:event.requestId},
          {label:'Elapsed time',value:event.duration.toLocaleString()+' ms'}
        ]}/>
        <section className="ad-detail-section"><h3>Diagnostic summary</h3>
          <p className="ad-muted-copy">{event.summary}</p>
        </section>
        <section className="ad-detail-section"><h3>Recovery & alerting</h3>
          <Info>Critical diagnostics notify authorized administrators. Technical retention is shorter than business audit retention. Stack traces, secrets and personal payloads are excluded from this sample UI.</Info>
        </section>
      </div>
      <footer className="ad-dialog-footer ad-footer-right"><Button variant="primary" onClick={close}>Close</Button></footer>
    </aside>
  </div>;
}

export function MonitoringSettingsDialog({close}:{close:()=>void}) {
  const [alerts,setAlerts]=useState('Enabled');
  const [notify,setNotify]=useState('System administrators');
  const [delivery,setDelivery]=useState('In-app + email');
  const [interval,setInterval]=useState('Every 5 minutes');
  const [preview,setPreview]=useState(false);
  useDialogEscape(()=>{if(preview)setPreview(false);else close();});
  return <div className="ad-overlay ad-centered" onMouseDown={close}>
    <section className="ad-dialog ad-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="ad-monitor-title"
      onMouseDown={e=>e.stopPropagation()}>
      <DialogHead id="ad-monitor-title" eyebrow="SYSTEM MONITORING" title="Monitoring & alerts"
        subtitle="Illustrative system-health notification preferences." close={close}/>
      <div className="ad-dialog-body">
        <div className="ad-form-grid">
          <Field name="Critical alerts"><Select label="Critical alerts" value={alerts} options={['Enabled','Disabled']} onChange={setAlerts}/></Field>
          <Field name="Notify"><Select label="Notify group" value={notify} options={['System administrators','IT Support','Auditors']} onChange={setNotify}/></Field>
          <Field name="Delivery"><Select label="Alert delivery" value={delivery} options={['In-app + email','In-app','Email']} onChange={setDelivery}/></Field>
          <Field name="Check interval"><Select label="Monitoring interval" value={interval} options={['Every minute','Every 5 minutes','Every 15 minutes','Every hour']} onChange={setInterval}/></Field>
        </div>
        <Info>Health signals cover API, jobs, database, storage, integrations, backup and integrity. Only authorized administrators can inspect technical diagnostics.</Info>
      </div>
      <footer className="ad-dialog-footer"><Button onClick={close}>Close</Button><span className="ad-footer-spacer"/>
        <Button variant="primary" onClick={()=>setPreview(true)}>Preview alerts</Button>
      </footer>
      {preview&&<div className="ad-notice-layer" onMouseDown={e=>{e.stopPropagation();setPreview(false);}}>
        <NoticeContent title="Monitoring preview"
          description={'Critical alerts: '+alerts+'; notify: '+notify+'; delivery: '+delivery+'; check interval: '+interval+'. This does not update a real monitor, send email or activate alerts.'}
          close={()=>setPreview(false)}/></div>}
    </section>
  </div>;
}

export function RetentionSettingsDialog({close}:{close:()=>void}) {
  const [business,setBusiness]=useState('180');
  const [security,setSecurity]=useState('365');
  const [diagnostics,setDiagnostics]=useState('30');
  const [archive,setArchive]=useState('Enabled');
  const [error,setError]=useState('');
  const [preview,setPreview]=useState(false);
  useDialogEscape(()=>{if(preview)setPreview(false);else close();});
  const review=()=>{
    const vals=[business,security,diagnostics];
    if(vals.some(v=>!v.trim()||!Number.isInteger(Number(v))||Number(v)<1||Number(v)>3650)){
      setError('Retention must be a whole number between 1 and 3650 days.');return;
    }
    setError('');setPreview(true);
  };
  return <div className="ad-overlay ad-centered" onMouseDown={close}>
    <section className="ad-dialog ad-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="ad-retention-title"
      onMouseDown={e=>e.stopPropagation()}>
      <DialogHead id="ad-retention-title" eyebrow="LOG RETENTION POLICY" title="Configure retention"
        subtitle="Illustrative governance controls for different log categories." close={close}/>
      <div className="ad-dialog-body">
        <div className="ad-form-grid">
          <Field name="Business audit retention"><NumberInput aria-label="Business audit retention days" min={1} max={3650} step={1} value={business} onChange={e=>setBusiness(e.target.value)}/></Field>
          <Field name="Security audit retention"><NumberInput aria-label="Security audit retention days" min={1} max={3650} step={1} value={security} onChange={e=>setSecurity(e.target.value)}/></Field>
          <Field name="Diagnostics retention"><NumberInput aria-label="Diagnostics retention days" min={1} max={3650} step={1} value={diagnostics} onChange={e=>setDiagnostics(e.target.value)}/></Field>
          <Field name="Protected archive"><Select label="Protected archive" options={['Enabled','Disabled']} value={archive} onChange={setArchive}/></Field>
        </div>
        <Info>Production policies require approved administrative governance. Immutable audit archives are not deletable by ordinary users; diagnostics may be archived or cleaned after retention.</Info>
        {error&&<p className="ad-error" role="alert">{error}</p>}
      </div>
      <footer className="ad-dialog-footer"><Button onClick={close}>Close</Button><span className="ad-footer-spacer"/>
        <Button variant="primary" onClick={review}>Preview policy</Button>
      </footer>
      {preview&&<div className="ad-notice-layer" onMouseDown={e=>{e.stopPropagation();setPreview(false);}}>
        <NoticeContent title="Retention policy preview"
          description={'Business audit: '+business+' days; security audit: '+security+' days; diagnostics: '+diagnostics+' days; protected archive: '+archive+'. No records have been deleted, archived or modified.'}
          close={()=>setPreview(false)}/></div>}
    </section>
  </div>;
}
