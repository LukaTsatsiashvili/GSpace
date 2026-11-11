import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { Badge, Button, Checkbox, Input, Select } from '../components/ui';
import {
  deliveryChannels, initialReport, initialSchedule, initialScope, recipientGroups,
  reportBranches, reportCategories, reportDepartments, reportEmployees, reportFields,
  reportGrouping, reportModules, reportPeriods, reportStatuses, reportVisualizations,
  scheduleFrequencies, templates,
  type CustomReport, type ReportField, type ReportModule, type ReportScope,
  type ReportTemplate, type SavedView, type ScheduledReport, type ScheduleDraft
} from './reports-data';

function useReportsEscape(action:()=>void) {
  useEffect(()=>{
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const handler=(event:KeyboardEvent)=>{
      if(event.key!=='Escape'||document.querySelector('.ui-select[aria-expanded="true"]'))return;
      event.stopImmediatePropagation();
      action();
    };
    document.addEventListener('keydown',handler);
    return ()=>{document.removeEventListener('keydown',handler);document.body.style.overflow=previous;};
  },[action]);
}
function DialogHeading({id,eyebrow,title,subtitle,close}: {id:string;eyebrow:string;title:string;subtitle:string;close:()=>void}) {
  return <header className="rp-dialog-head"><div><Badge tone="blue">{eyebrow}</Badge>
    <h2 id={id}>{title}</h2><p>{subtitle}</p></div>
    <button type="button" className="rp-close" aria-label="Close dialog" onClick={close}><X size={17}/></button>
  </header>;
}
function Field({title,children,required=false}: {title:string;children:ReactNode;required?:boolean}) {
  return <div className="rp-field"><span>{title}{required&&<b> *</b>}</span>{children}</div>;
}
function Summary({items}: {items:{label:string;value:string}[]}) {
  return <div className="rp-summary-grid">{items.map(item=><div key={item.label}>
    <small>{item.label}</small><strong>{item.value}</strong>
  </div>)}</div>;
}
function NoticeContent({title,message,close}: {title:string;message:string;close:()=>void}) {
  return <section role="alertdialog" aria-modal="true" aria-labelledby="rp-notice-title" className="rp-notice"
    onMouseDown={e=>e.stopPropagation()}>
    <span className="rp-notice-symbol"><Check size={23}/></span>
    <h2 id="rp-notice-title">{title}</h2><p>{message}</p>
    <Button variant="primary" onClick={close}>Got it</Button>
  </section>;
}
export function ReportsNotice({title,message,close}: {title:string;message:string;close:()=>void}) {
  useReportsEscape(close);
  return <div className="rp-notice-layer" onMouseDown={close}>
    <NoticeContent title={title} message={message} close={close}/>
  </div>;
}

export function AdvancedReportFiltersDialog({initial,apply,close}: {
  initial:ReportScope;apply:(next:ReportScope)=>void;close:()=>void;
}) {
  const [scope,setScope]=useState<ReportScope>({...initial});
  const [customStart,setCustomStart]=useState('');
  const [customEnd,setCustomEnd]=useState('');
  const [error,setError]=useState('');
  useReportsEscape(close);
  const change=(key:keyof ReportScope,value:string)=>setScope(prev=>({...prev,[key]:value}));
  const applyFilters=()=>{
    if(scope.period==='Custom range'&&(!customStart||!customEnd||customStart>customEnd)) {
      setError('Choose a valid start and end date for the custom range.');return;
    }
    setError('');apply(scope);
  };
  return <div className="rp-overlay" onMouseDown={close}>
    <section className="rp-dialog" role="dialog" aria-modal="true" aria-labelledby="rp-filters-title"
      onMouseDown={e=>e.stopPropagation()}>
      <DialogHeading id="rp-filters-title" eyebrow="ADVANCED FILTERS" title="Refine analytics scope"
        subtitle="Combine date, people, category and status filters." close={close}/>
      <div className="rp-dialog-body">
        <div className="rp-form-grid">
          <Field title="Branch"><Select label="Filter branch" value={scope.branch} options={reportBranches}
            onChange={value=>change('branch',value)}/></Field>
          <Field title="Department"><Select label="Filter department" value={scope.department} options={reportDepartments}
            onChange={value=>change('department',value)}/></Field>
          <Field title="Employee"><Select label="Filter employee" value={scope.employee} options={reportEmployees}
            onChange={value=>change('employee',value)}/></Field>
          <Field title="Category"><Select label="Filter category" value={scope.category} options={reportCategories}
            onChange={value=>change('category',value)}/></Field>
          <Field title="Status"><Select label="Filter status" value={scope.status} options={reportStatuses}
            onChange={value=>change('status',value)}/></Field>
          <Field title="Date range"><Select label="Date range" value={scope.period} options={reportPeriods}
            onChange={value=>{change('period',value);setError('');}}/></Field>
          {scope.period==='Custom range'&&<>
            <Field title="From" required><Input aria-label="Custom start date" type="date"
              value={customStart} onChange={e=>{setCustomStart(e.target.value);setError('');}}/></Field>
            <Field title="To" required><Input aria-label="Custom end date" type="date"
              value={customEnd} onChange={e=>{setCustomEnd(e.target.value);setError('');}}/></Field>
          </>}
        </div>
        <p className="rp-info-banner">Branch options represent the user's permitted scope; employee or sensitive financial fields may require additional rights. This preview does not enforce production permissions.</p>
        {error&&<p className="rp-error" role="alert">{error}</p>}
      </div>
      <footer className="rp-dialog-footer"><Button onClick={()=>{setScope(initialScope);setCustomStart('');setCustomEnd('');setError('');}}>
          Reset filters</Button><span className="rp-footer-spacer"/>
        <Button variant="primary" onClick={applyFilters}>Apply filters</Button>
      </footer>
    </section>
  </div>;
}

export function CreateReportDialog({template,saved,close}: {
  template:ReportTemplate|null;saved:SavedView|null;close:()=>void;
}) {
  const [report,setReport]=useState<CustomReport>(()=>({
    ...initialReport,
    title:saved?.title??(template?template.title+' · Custom view':''),
    dataSource:template?.module??initialReport.dataSource,
    fields:[...initialReport.fields],
    branch:saved?.scope==='Head Office'?'Head Office':'All permitted branches'
  }));
  const [step,setStep]=useState<'edit'|'review'>('edit');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState(false);
  const change=<K extends keyof CustomReport>(key:K,value:CustomReport[K])=>
    setReport(current=>({...current,[key]:value}));
  const dismiss=()=>{
    if(notice){setNotice(false);return;}
    if(step==='review'){setStep('edit');return;}
    close();
  };
  useReportsEscape(dismiss);
  const toggleField=(field:ReportField,checked:boolean)=>{
    change('fields',checked?[...report.fields,field]:report.fields.filter(item=>item!==field));
    setError('');
  };
  const review=()=>{
    if(!report.title.trim()){setError('Report name is required.');return;}
    if(!report.fields.length){setError('Select at least one included field.');return;}
    setError('');setStep('review');
  };
  return <div className="rp-overlay" onMouseDown={close}>
    <section className="rp-dialog" role="dialog" aria-modal="true" aria-labelledby="rp-builder-title"
      onMouseDown={e=>e.stopPropagation()}>
      <DialogHeading id="rp-builder-title" eyebrow={step==='edit'?'CUSTOM REPORT BUILDER':'REPORT CONFIGURATION'}
        title={step==='edit'?'Create or customize report':'Review custom report'}
        subtitle={step==='edit'?'Choose data source, scope, columns and chart layout.':'Review the selected configuration before continuing.'}
        close={close}/>
      <div className="rp-dialog-body">
        {step==='edit'&&<>
          <div className="rp-form-grid">
            <Field title="Report name" required><Input aria-label="Report name" placeholder="e.g. Monthly branch assets"
              value={report.title} onChange={e=>{change('title',e.target.value);setError('');}}/></Field>
            <Field title="Data source"><Select label="Report data source" value={report.dataSource}
              options={reportModules} onChange={value=>change('dataSource',value as ReportModule)}/></Field>
            <Field title="Branch"><Select label="Report branch" options={reportBranches} value={report.branch}
              onChange={value=>change('branch',value)}/></Field>
            <Field title="Period"><Select label="Report period" options={reportPeriods} value={report.period}
              onChange={value=>change('period',value)}/></Field>
            <Field title="Group by"><Select label="Group by" options={reportGrouping} value={report.groupBy}
              onChange={value=>change('groupBy',value)}/></Field>
            <Field title="Visualization"><Select label="Report visualization" value={report.visualization}
              options={reportVisualizations} onChange={value=>change('visualization',value)}/></Field>
          </div>
          <section className="rp-builder-fields"><h3>Included fields</h3>
            <div className="rp-checkbox-grid">{reportFields.map(field=><label key={field}
              className={'rp-checkbox-option'+(report.fields.includes(field)?' selected':'')}>
              <Checkbox checked={report.fields.includes(field)} onChange={e=>toggleField(field,e.target.checked)}/>
              <span>{field}</span>
            </label>)}</div>
          </section>
          <p className="rp-info-banner">Fields outside the user's permissions will be omitted or masked. Saved views do not grant additional access to report data.</p>
          {error&&<p className="rp-error" role="alert">{error}</p>}
        </>}
        {step==='review'&&<>
          <Summary items={[
            {label:'Name',value:report.title.trim()},{label:'Module',value:report.dataSource},
            {label:'Branch',value:report.branch},{label:'Period',value:report.period},
            {label:'Layout',value:report.visualization}
          ]}/>
          <p className="rp-info-banner">UI demonstration only. No report is saved, emailed, shared or exported.</p>
        </>}
      </div>
      <footer className="rp-dialog-footer">
        {step==='edit'?<span className="rp-footer-note">Design preview · no database writes</span>
          :<Button onClick={()=>setStep('edit')}>Back to edit</Button>}
        <span className="rp-footer-spacer"/>
        <Button variant="primary" onClick={()=>step==='edit'?review():setNotice(true)}>
          {step==='edit'?'Preview report':'Confirm preview'}
          {step==='edit'?<ArrowRight size={15}/>:<Check size={15}/>}
        </Button>
      </footer>
      {notice&&<div className="rp-notice-layer" onMouseDown={e=>{e.stopPropagation();setNotice(false);}}>
        <NoticeContent title="Report preview complete"
          message={'“'+report.title.trim()+'” has been reviewed as a '+report.dataSource+
            ' report with '+report.fields.length+' selected fields. No saved report, export or permission change has occurred.'}
          close={()=>setNotice(false)}/>
      </div>}
    </section>
  </div>;
}

export function ScheduleReportDialog({initial,close}: {initial:ScheduledReport|null;close:()=>void}) {
  const [schedule,setSchedule]=useState<ScheduleDraft>(()=>({
    ...initialSchedule,
    name:initial?.title??'',
    reportId:initial?.reportId??initialSchedule.reportId,
    frequency:initial?.frequency.split(' · ')[0]??initialSchedule.frequency,
    channel:initial?.delivery??initialSchedule.channel,
    audience:initial?.audience??initialSchedule.audience,
    time:initial?.time??initialSchedule.time
  }));
  const [step,setStep]=useState<'edit'|'review'>('edit');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState(false);
  const change=<K extends keyof ScheduleDraft>(key:K,value:ScheduleDraft[K])=>
    setSchedule(current=>({...current,[key]:value}));
  const dismiss=()=>{
    if(notice){setNotice(false);return;}
    if(step==='review'){setStep('edit');return;}
    close();
  };
  useReportsEscape(dismiss);
  const named=(id:string)=>templates.find(template=>template.id===id)?.title??templates[0].title;
  const toReview=()=>{
    if(!schedule.name.trim()){setError('Schedule name is required.');return;}
    if(!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(schedule.time.trim())){
      setError('Enter delivery time as HH:MM, for example 09:00.');return;
    }
    setError('');setStep('review');
  };
  return <div className="rp-overlay" onMouseDown={close}>
    <section className="rp-dialog" role="dialog" aria-modal="true" aria-labelledby="rp-schedule-title"
      onMouseDown={e=>e.stopPropagation()}>
      <DialogHeading id="rp-schedule-title" eyebrow={step==='edit'?'SCHEDULED DELIVERY':'SCHEDULE REVIEW'}
        title={step==='edit'?'Schedule report delivery':'Review report schedule'}
        subtitle={step==='edit'?'Choose a frequency, channel and authorized recipients.':'Confirm the sample delivery configuration.'}
        close={close}/>
      <div className="rp-dialog-body">
        {step==='edit'&&<>
          <div className="rp-form-grid">
            <Field title="Schedule name" required><Input aria-label="Schedule name"
              placeholder="e.g. Weekly asset summary" value={schedule.name}
              onChange={e=>{change('name',e.target.value);setError('');}}/></Field>
            <Field title="Report"><Select label="Report to deliver" value={named(schedule.reportId)}
              options={templates.map(item=>item.title)}
              onChange={value=>change('reportId',templates.find(item=>item.title===value)?.id??templates[0].id)}/></Field>
            <Field title="Frequency"><Select label="Schedule frequency" value={schedule.frequency}
              options={scheduleFrequencies} onChange={value=>change('frequency',value)}/></Field>
            <Field title="Delivery channel"><Select label="Delivery channel" value={schedule.channel}
              options={deliveryChannels} onChange={value=>change('channel',value)}/></Field>
            <Field title="Recipient group"><Select label="Recipient group" value={schedule.audience}
              options={recipientGroups} onChange={value=>change('audience',value)}/></Field>
            <Field title="Delivery time"><Input aria-label="Delivery time" value={schedule.time}
              placeholder="09:00" onChange={e=>{change('time',e.target.value);setError('');}}/></Field>
          </div>
          <section className="rp-rule-section"><h3>Access & delivery rules</h3>
            <p className="rp-info-banner">Each recipient must have report visibility and branch scope permissions. Sending financial or personal data requires explicit sensitive-data permission. Every scheduled delivery is auditable.</p>
          </section>
          {error&&<p className="rp-error" role="alert">{error}</p>}
        </>}
        {step==='review'&&<>
          <Summary items={[
            {label:'Schedule',value:schedule.name.trim()},{label:'Report',value:named(schedule.reportId)},
            {label:'Frequency',value:schedule.frequency},{label:'Delivery',value:schedule.channel},
            {label:'Audience',value:schedule.audience},{label:'Time',value:schedule.time}
          ]}/>
          <p className="rp-info-banner">Preview only: no email, in-app notification, recurring task or scheduler job will be created.</p>
        </>}
      </div>
      <footer className="rp-dialog-footer">
        {step==='edit'?<Button onClick={close}>Close</Button>
          :<Button onClick={()=>setStep('edit')}>Back to edit</Button>}
        <span className="rp-footer-spacer"/>
        <Button variant="primary" onClick={()=>step==='edit'?toReview():setNotice(true)}>
          {step==='edit'?'Review schedule':'Confirm preview'}
          {step==='edit'?<ArrowRight size={15}/>:<Check size={15}/>}
        </Button>
      </footer>
      {notice&&<div className="rp-notice-layer" onMouseDown={e=>{e.stopPropagation();setNotice(false);}}>
        <NoticeContent title="Scheduled report preview"
          message={'“'+schedule.name.trim()+'” is configured for '+schedule.frequency.toLowerCase()+
            ' delivery via '+schedule.channel+'. No scheduled job, email, report or database record was created.'}
          close={()=>setNotice(false)}/>
      </div>}
    </section>
  </div>;
}
