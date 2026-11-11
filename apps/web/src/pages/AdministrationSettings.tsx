import { useEffect, useState } from 'react';
import { Box, Check, X } from 'lucide-react';
import { Badge, Button, Input } from '../components/ui';
import { settingsSections } from './administration-data';
import './administration-settings.css';

/**
 * Administration Settings visual foundation.
 *
 * Values in these screens are illustrative defaults only. No settings are loaded
 * from or written to a server. Authorization, validation of policy semantics,
 * immutable audit history and persistence belong to the backend stage.
 */
type SettingId = 'general' | 'resources' | 'notifications' | 'security' | 'storage' | 'system';
type SettingField = {
  id: string;
  label: string;
  value: string;
  /** Operational values must never be presented as editable configuration. */
  readonly?: boolean;
};
type SettingDefinition = {
  id: SettingId;
  title: string;
  fields: readonly SettingField[];
};
const definitions: readonly SettingDefinition[] = [
  { id:'general', title:'General', fields:[
    {id:'company',label:'Company name',value:'GTEX'},
    {id:'language',label:'Primary language',value:'English'},
    {id:'currency',label:'Default currency',value:'GEL'},
    {id:'timezone',label:'Time zone',value:'Asia/Tbilisi'}
  ]},
  { id:'resources', title:'Resource policy', fields:[
    {id:'prefix',label:'Resource ID prefix',value:'RES'},
    {id:'condition',label:'Default condition',value:'Good'},
    {id:'restriction',label:'Assignment restriction',value:'Block assets in maintenance'},
    {id:'authorization',label:'Disposal authorization',value:'Required'}
  ]},
  { id:'notifications', title:'Notifications', fields:[
    {id:'confirmations',label:'Assignment confirmations',value:'Enabled'},
    {id:'renewals',label:'License renewals',value:'30 / 14 / 7 days'},
    {id:'incidents',label:'Critical incidents',value:'Immediate'},
    {id:'channels',label:'Channels',value:'Email + in-app'}
  ]},
  { id:'security', title:'Security', fields:[
    {id:'expiry',label:'Session expiry',value:'8 hours'},
    {id:'password',label:'Password minimum',value:'6 characters'},
    {id:'inactive',label:'Inactive account access',value:'Blocked'},
    {id:'actions',label:'Admin actions',value:'Audit required'}
  ]},
  { id:'storage', title:'Storage', fields:[
    {id:'attachments',label:'Attachment storage',value:'Database-backed'},
    {id:'uploads',label:'Multiple uploads',value:'Enabled'},
    {id:'documents',label:'Allowed document types',value:'Images / PDFs / Office'},
    {id:'retention',label:'Retention',value:'Policy-controlled'}
  ]},
  { id:'system', title:'System', fields:[
    {id:'version',label:'Application version',value:'Prototype v1',readonly:true},
    {id:'jobs',label:'Background jobs',value:'Healthy',readonly:true},
    {id:'backup',label:'Last backup',value:'Nov 06, 2026',readonly:true},
    {id:'maintenance',label:'Maintenance mode',value:'Disabled'}
  ]}
];

function useSettingsEscape(onClose:()=>void) {
  useEffect(()=>{
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const handler=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
    };
    document.addEventListener('keydown',handler);
    return ()=>{
      document.removeEventListener('keydown',handler);
      document.body.style.overflow=previous;
    };
  },[onClose]);
}

function SettingDialog({definition,close}:{definition:SettingDefinition;close:()=>void}) {
  const [values,setValues]=useState<Record<string,string>>(
    ()=>Object.fromEntries(definition.fields.map(field=>[field.id,field.value]))
  );
  const [review,setReview]=useState(false);
  const [confirmed,setConfirmed]=useState(false);
  const [error,setError]=useState('');
  useSettingsEscape(()=>{
    if(confirmed)setConfirmed(false);
    else if(review)setReview(false);
    else close();
  });
  const change=(id:string,value:string)=>{
    setValues(previous=>({...previous,[id]:value}));
    setError('');
  };
  const preview=()=>{
    const blank=definition.fields.find(field=>!values[field.id]?.trim());
    if(blank){setError(blank.label+' cannot be empty.');return;}
    const overlong=definition.fields.find(field=>(values[field.id]?.length??0)>120);
    if(overlong){setError(overlong.label+' must contain no more than 120 characters.');return;}
    setError('');
    setReview(true);
  };
  const dismiss=()=>{if(confirmed){setConfirmed(false);return;}close();};
  return <div className="am-overlay am-center" onMouseDown={dismiss}>
    <section className="am-modal am-form-modal am-settings-modal" role="dialog" aria-modal="true" aria-labelledby="am-settings-title"
      onMouseDown={event=>event.stopPropagation()}>
      <header className="am-modal-header">
        <div><Badge tone="blue">SYSTEM CONFIGURATION</Badge>
          <h2 id="am-settings-title">{review?definition.title+' · Review':definition.title}</h2>
          <p>{review?'Review the sample configuration before continuing.':'Global settings · System Administrator only.'}</p>
        </div>
        <button type="button" className="am-close" onClick={close} aria-label="Close configuration"><X size={16}/></button>
      </header>
      <div className="am-modal-body">
        {review
          ? <div className="am-settings-review">
              {definition.fields.map(field=><div key={field.id} className="am-display-field">
                <small>{field.label}</small><strong>{values[field.id]}</strong>
              </div>)}
            </div>
          : <div className="am-form-grid">
              {definition.fields.map(field=><div className="am-field" key={field.id}>
                <label htmlFor={'am-settings-'+definition.id+'-'+field.id}>{field.label}</label>
                <Input id={'am-settings-'+definition.id+'-'+field.id}
                  value={values[field.id]} readOnly={field.readonly}
                  aria-readonly={field.readonly||undefined}
                  onChange={event=>change(field.id,event.target.value)}
                  maxLength={120}/>
              </div>)}
            </div>
        }
        <p className="am-info">
          {review
            ? 'Design preview only. No changes will be saved, applied to sessions or sent to a production API.'
            : 'Only the System Administrator can save global configuration changes. Administrative updates require validation, auditing and appropriate session handling.'}
        </p>
        {error&&<p className="am-error" role="alert">{error}</p>}
      </div>
      <footer className="am-modal-footer">
        {review?<Button onClick={()=>setReview(false)}>Back to edit</Button>:<Button onClick={close}>Close</Button>}
        <span className="am-spacer"/>
        <Button variant="primary" onClick={review?()=>setConfirmed(true):preview}>
          {review?'Confirm preview':'Preview configuration'}{review&&<Check size={15}/>}
        </Button>
      </footer>
      {confirmed&&<div className="am-notice-layer" onMouseDown={event=>{event.stopPropagation();setConfirmed(false);}}>
        <div className="am-notice" role="alertdialog" aria-modal="true" aria-labelledby="am-settings-confirm-title"
          onMouseDown={event=>event.stopPropagation()}>
          <div className="am-notice-symbol"><Check size={22}/></div>
          <h2 id="am-settings-confirm-title">Configuration preview complete</h2>
          <p>{definition.title} settings were reviewed. No organization settings, users, permissions or system services were changed.</p>
          <Button variant="primary" onClick={()=>setConfirmed(false)}>Got it</Button>
        </div>
      </div>}
    </section>
  </div>;
}

export default function AdministrationSettings() {
  const [selected,setSelected]=useState<SettingId|null>(null);
  const setting=definitions.find(definition=>definition.id===selected);
  return <>
    <div className="am-settings-list">
      {settingsSections.map((section,index)=><div className="am-settings-row" key={section.title}>
        <span className="am-settings-row-icon"><Box size={19}/></span>
        <div className="am-settings-row-copy">
          <strong>{section.title}</strong><small>{section.description}</small>
        </div>
        <Button onClick={()=>setSelected(definitions[index].id)} aria-label={'Configure '+section.title}>Configure</Button>
      </div>)}
    </div>
    <div className="am-table-footer">Only System Administrators may alter global system configuration; all changes are audited.</div>
    {setting&&<SettingDialog key={setting.id} definition={setting} close={()=>setSelected(null)}/>}
  </>;
}
