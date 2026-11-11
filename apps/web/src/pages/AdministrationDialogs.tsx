import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Check, ShieldCheck, X } from 'lucide-react';
import { Badge, Button, Checkbox, Input, Select, Textarea } from '../components/ui';
import {
  accountStatuses, branchNames, departmentNames, initials, normalizeRoleCode,
  permissionDefinitions, roleName, roles, userRecords,
  type AccountStatus, type BranchRecord, type DepartmentRecord, type PermissionId,
  type RoleRecord, type UserRecord
} from './administration-data';

function useDismiss(close:()=>void) {
  useEffect(()=>{
    const old=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape' && !document.querySelector('.ui-select-options')){
        event.stopImmediatePropagation();
        close();
      }
    };
    document.addEventListener('keydown',key);
    return ()=>{document.removeEventListener('keydown',key);document.body.style.overflow=old;};
  },[close]);
}
function Header({eyebrow,title,subtitle,close,id}:{eyebrow:string;title:string;subtitle:string;close:()=>void;id:string}) {
  return <header className="am-modal-header"><div><Badge tone="blue">{eyebrow}</Badge>
    <h2 id={id}>{title}</h2><p>{subtitle}</p></div>
    <button type="button" aria-label="Close modal" className="am-close" onClick={close}><X size={16}/></button>
  </header>;
}
function Field({label,required=false,children}:{label:string;required?:boolean;children:ReactNode}) {
  return <label className="am-field"><span>{label}{required&&' *'}</span>{children}</label>;
}
function DisplayField({label,value}:{label:string;value:string}) {
  return <div className="am-display-field"><small>{label}</small><strong>{value}</strong></div>;
}
function Summary({data}:{data:{label:string;value:string}[]}) {
  return <div className="am-summary">{data.map(item=><DisplayField key={item.label} label={item.label} value={item.value}/>)}</div>;
}
function Note({children}:{children:ReactNode}) {return <p className="am-info">{children}</p>;}
function NoticeBody({title,description,done}:{title:string;description:string;done:()=>void}) {
  return <div className="am-notice" role="alertdialog" aria-modal="true" aria-labelledby="am-notice-title"
    onMouseDown={e=>e.stopPropagation()}>
    <span className="am-notice-symbol"><Check size={22}/></span>
    <h2 id="am-notice-title">{title}</h2><p>{description}</p><Button variant="primary" onClick={done}>Got it</Button>
  </div>;
}
export function AdminNotice({title,description,close}:{title:string;description:string;close:()=>void}) {
  useDismiss(close);
  return <div className="am-notice-layer" onMouseDown={close}><NoticeBody title={title} description={description} done={close}/></div>;
}

export function UserDetailsDrawer({user,close,onEdit,onReset}:{user:UserRecord;close:()=>void;onEdit:()=>void;onReset:()=>void}) {
  useDismiss(close);
  const protectedAccount=user.role==='SYSTEM_ADMIN';
  return <div className="am-overlay" onMouseDown={close}>
    <aside className="am-modal am-drawer" role="dialog" aria-modal="true" aria-labelledby="am-user-details-title"
      onMouseDown={e=>e.stopPropagation()}>
      <Header id="am-user-details-title" eyebrow={'EMPLOYEE ACCOUNT · '+user.id} title={user.name}
        subtitle="Identity, organizational membership and access rights." close={close}/>
      <div className="am-modal-body">
        <div className="am-detail-pills"><span className={'am-status '+user.status.toLowerCase()}>{user.status}</span>
          {protectedAccount&&<span className="am-status protected">Protected</span>}</div>
        <Summary data={[
          {label:'Email',value:user.email},{label:'Role',value:roleName(user.role)},
          {label:'Branch',value:user.branch},{label:'Department',value:user.department},
          {label:'Phone',value:user.phone},{label:'Last active',value:user.lastActive}
        ]}/>
        <section className="am-detail-section"><h3>Access policy</h3>
          <Note>One role and one primary branch per employee. Permissions are determined by both role and resource scope. Only central administration can change assigned roles.</Note>
        </section>
        <section className="am-detail-section"><h3>Account security</h3>
          <p className="am-muted-copy">Account deactivation revokes access while retaining related audit and resource history. The last active System Administrator account cannot be deactivated.</p>
        </section>
      </div>
      <footer className="am-modal-footer"><Button onClick={close}>Close</Button><span className="am-spacer"/>
        <Button onClick={onReset}>Reset password</Button><Button variant="primary" onClick={onEdit}>Edit account</Button></footer>
    </aside>
  </div>;
}

type UserDraft={name:string;email:string;role:string;branch:string;department:string;status:AccountStatus;phone:string};
export function UserEditorDialog({user,close}:{user?:UserRecord|null;close:()=>void}) {
  const edit=Boolean(user);
  const locked=user?.role==='SYSTEM_ADMIN';
  const [form,setForm]=useState<UserDraft>({
    name:user?.name??'',email:user?.email??'',role:user?.role??'EMPLOYEE',
    branch:user?.branch??'Head Office',department:user?.department??'Operations',
    status:user?.status??'Active',phone:user?.phone??''
  });
  const [review,setReview]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState(false);
  const change=(key:keyof UserDraft,value:string)=>{setForm(old=>({...old,[key]:value}));setError('');};
  const dismiss=()=>{if(notice)setNotice(false);else if(review)setReview(false);else close();};
  useDismiss(dismiss);
  const validate=()=>{
    if(!form.name.trim()||form.name.trim().split(/\s+/).length<2){setError('Enter a full name (first and last name).');return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())){setError('Enter a valid work email address.');return;}
    if(!edit&&userRecords.some(u=>u.email.toLowerCase()===form.email.trim().toLowerCase())){setError('A sample account already uses this email.');return;}
    if(edit&&userRecords.some(u=>u.id!==user?.id&&u.email.toLowerCase()===form.email.trim().toLowerCase())){setError('Another sample account already uses this email.');return;}
    if(!roles.some(role=>role.code===form.role)){setError('Choose an available role.');return;}
    if(locked&&(form.role!=='SYSTEM_ADMIN'||form.status!=='Active')){setError('The protected administrator role and active state cannot be changed in this preview.');return;}
    setError('');setReview(true);
  };
  return <div className="am-overlay am-center" onMouseDown={close}>
    <section className="am-modal am-form-modal" role="dialog" aria-modal="true" aria-labelledby="am-user-form-title"
      onMouseDown={e=>e.stopPropagation()}>
      <Header id="am-user-form-title"
        eyebrow={review?'ACCOUNT REVIEW':edit?'EDIT USER · '+user?.id:'NEW USER'}
        title={review?(edit?'Review account changes':'Review new user'):edit?'Edit user account':'Create employee account'}
        subtitle={review?'Confirm the sample user configuration before continuing.':edit?'Update employee profile and membership.':'Assign exactly one role and one primary branch.'}
        close={close}/>
      <div className="am-modal-body">
        {review ? <>
          <Summary data={[
            {label:'Full name',value:form.name},{label:'Work email',value:form.email},
            {label:'Role',value:roleName(form.role)},{label:'Primary branch',value:form.branch},
            {label:'Department',value:form.department},{label:'Account status',value:form.status},
            {label:'Phone',value:form.phone||'Not provided'}
          ]}/>
          <Note>UI demonstration only. No user will be created or updated, and no permissions or active sessions will change.</Note>
        </> : <>
          <div className="am-form-grid">
            <Field label="Full name" required><Input aria-label="Full name" placeholder="First and last name" value={form.name} onChange={e=>change('name',e.target.value)}/></Field>
            <Field label="Work email" required><Input aria-label="Work email" type="email" placeholder="name@company.com" value={form.email} onChange={e=>change('email',e.target.value)}/></Field>
            <Field label="Role" required>{locked?<Input aria-label="Protected role" readOnly value="System Administrator"/>:
              <Select label="User role" options={roles.filter(r=>!r.protected).map(r=>r.name)}
                value={roleName(form.role)} onChange={name=>change('role',roles.find(r=>r.name===name)?.code??form.role)}/>}</Field>
            <Field label="Primary branch" required><Select label="Primary branch" options={branchNames} value={form.branch} onChange={value=>change('branch',value)}/></Field>
            <Field label="Department"><Select label="Department" options={departmentNames} value={form.department} onChange={value=>change('department',value)}/></Field>
            <Field label="Account status">{locked?<Input aria-label="Protected account status" readOnly value="Active"/>:
              <Select label="Account status" options={accountStatuses} value={form.status} onChange={value=>change('status',value as AccountStatus)}/>}</Field>
            <Field label="Phone"><Input aria-label="Phone" type="tel" placeholder="+995 ..." value={form.phone} onChange={e=>change('phone',e.target.value)}/></Field>
            <Field label="Access scope"><Input aria-label="Access scope" readOnly value="Role + assigned branch"/></Field>
          </div>
          <Note>Only authorized administrators can create accounts. Role changes are restricted to central administration, and the last active System Administrator cannot be disabled. This screen only previews the workflow.</Note>
          {error&&<p className="am-error" role="alert">{error}</p>}
        </>}
      </div>
      <footer className="am-modal-footer">
        {review?<Button onClick={()=>setReview(false)}>Back to edit</Button>:<span className="am-footer-hint">Administrative action · audited in production</span>}
        <span className="am-spacer"/>
        <Button variant="primary" onClick={()=>review?setNotice(true):validate()}>
          {review?'Confirm preview':edit?'Review changes':'Review new user'} <ArrowRight size={15}/>
        </Button>
      </footer>
      {notice&&<div className="am-notice-layer" onMouseDown={e=>{e.stopPropagation();setNotice(false);}}>
        <NoticeBody title="Account preview complete" description="The account configuration has been reviewed. No account, permissions or stored data were changed." done={()=>setNotice(false)}/>
      </div>}
    </section>
  </div>;
}

export function ResetPasswordDialog({user,close,back}:{user:UserRecord;close:()=>void;back:()=>void}) {
  const [reason,setReason]=useState('');
  const [notice,setNotice]=useState(false);
  const [error,setError]=useState('');
  useDismiss(()=>notice?setNotice(false):close());
  return <div className="am-overlay am-center" onMouseDown={close}>
    <section className="am-modal am-form-modal" role="dialog" aria-modal="true" aria-labelledby="am-password-title" onMouseDown={e=>e.stopPropagation()}>
      <Header id="am-password-title" eyebrow="ACCOUNT SECURITY" title="Reset employee password" subtitle={user.name+' · '+user.id} close={close}/>
      <div className="am-modal-body">
        <div className="am-form-grid">
          <Field label="Employee"><Input aria-label="Employee" readOnly value={user.name}/></Field>
          <Field label="Session policy"><Input aria-label="Session policy" readOnly value="Revoke active sessions"/></Field>
          <div className="am-span-full"><Field label="Administrative reason" required><Textarea aria-label="Administrative reason" rows={3} placeholder="State why a password reset is required..." value={reason} onChange={e=>{setReason(e.target.value);setError('');}}/></Field></div>
        </div>
        <Note>In production, password reset permissions and confirmation are required. Existing sessions are revoked and the action is added to the security audit.</Note>
        {error&&<p className="am-error" role="alert">{error}</p>}
      </div>
      <footer className="am-modal-footer"><Button onClick={back}>Back</Button><span className="am-spacer"/>
        <Button variant="primary" onClick={()=>{if(!reason.trim()){setError('An administrative reason is required.');return;}setNotice(true);}}>Preview reset</Button>
      </footer>
      {notice&&<div className="am-notice-layer" onMouseDown={e=>{e.stopPropagation();setNotice(false);}}>
        <NoticeBody title="Password reset preview" description={'An authorized administrator would request a password reset for '+user.name+'. Reason: '+reason.trim()+'. No password or active session was changed.'} done={()=>setNotice(false)}/>
      </div>}
    </section>
  </div>;
}

export function RoleEditorDialog({role,close}:{role?:RoleRecord|null;close:()=>void}) {
  const editing=Boolean(role);
  const readonly=Boolean(role?.protected);
  const [name,setName]=useState(role?.name??'');
  const [code,setCode]=useState(role?.code??'');
  const [description,setDescription]=useState(role?.description??'');
  const [selected,setSelected]=useState<PermissionId[]>(role?.permissions??['assets.view']);
  const [review,setReview]=useState(false);
  const [notice,setNotice]=useState(false);
  const [error,setError]=useState('');
  useDismiss(()=>{if(notice)setNotice(false);else if(review)setReview(false);else close();});
  const choose=(id:PermissionId,checked:boolean)=>{
    if(readonly)return;
    setSelected(previous=>checked?[...new Set([...previous,id])]:previous.filter(item=>item!==id));
  };
  const validate=()=>{
    if(!name.trim()){setError('Role name is required.');return;}
    if(!editing && !/^[A-Z][A-Z0-9_]{2,63}$/.test(code)){setError('Enter a unique code using 3–64 uppercase letters, digits and underscores.');return;}
    if(!editing && roles.some(existing=>existing.code===code)){setError('A role with this code already exists.');return;}
    if(!selected.length){setError('Select at least one permission.');return;}
    setError('');setReview(true);
  };
  return <div className="am-overlay am-center" onMouseDown={close}>
    <section className="am-modal am-form-modal am-role-modal" role="dialog" aria-modal="true" aria-labelledby="am-role-title" onMouseDown={e=>e.stopPropagation()}>
      <Header id="am-role-title" eyebrow={review?'ROLE REVIEW':!editing?'NEW ROLE':readonly?'PROTECTED ROLE':'EDIT ROLE · '+role?.code}
        title={review?'Review role permissions':readonly?'View protected role':editing?'Edit role permissions':'Create custom role'}
        subtitle={review?'Review the sample permission set before continuing.':'Configure a unique role name, code and permission set.'} close={close}/>
      <div className="am-modal-body">
        {review ? <>
          <Summary data={[
            {label:'Role',value:name},{label:'Unique code',value:code},
            {label:'Permissions selected',value:String(selected.length)},{label:'Description',value:description||'Not provided'}
          ]}/>
          <div className="am-selected-preview">{selected.map(id=><span key={id}>{permissionDefinitions.find(p=>p.id===id)?.name??id}</span>)}</div>
          <Note>Preview only. No role is created, changed, assigned or saved to the database.</Note>
        </> : <>
          <div className="am-form-grid">
            <Field label="Role name" required><Input aria-label="Role name" placeholder="e.g. Regional Controller" readOnly={readonly} value={name}
              onChange={e=>{setName(e.target.value);if(!editing)setCode(normalizeRoleCode(e.target.value));setError('');}}/></Field>
            <Field label="Unique code" required><Input aria-label="Unique role code" placeholder="REGIONAL_CONTROLLER" readOnly={editing||readonly} value={code}
              onChange={e=>{setCode(normalizeRoleCode(e.target.value));setError('');}}/></Field>
            <div className="am-span-full"><Field label="Description"><Textarea aria-label="Role description" rows={3} readOnly={readonly} placeholder="Purpose and access scope..."
              value={description} onChange={e=>setDescription(e.target.value)}/></Field></div>
          </div>
          <div className="am-permission-heading"><h3>Permissions <span>{selected.length} selected</span></h3>
            {!readonly&&<div><Button onClick={()=>setSelected(permissionDefinitions.map(p=>p.id))}>Select all</Button>
              <Button onClick={()=>setSelected([])}>Clear</Button></div>}
          </div>
          <div className="am-permissions">
            {permissionDefinitions.map(permission=><label key={permission.id} className={'am-permission-option'+(selected.includes(permission.id)?' selected':'')}>
              <Checkbox checked={selected.includes(permission.id)} disabled={readonly} onChange={e=>choose(permission.id,e.target.checked)}/>
              <span><strong>{permission.name}</strong><small>{permission.description}</small></span>
            </label>)}
          </div>
          {readonly?<Note>System Administrator is a protected role. Its code and permissions cannot be changed through this preview.</Note>
            :<Note>Permissions grant access only within permitted resource scope. Sensitive data must still be protected by server-side authorization.</Note>}
          {error&&<p className="am-error" role="alert">{error}</p>}
        </>}
      </div>
      <footer className="am-modal-footer">
        {readonly?<><span className="am-footer-hint">Protected, view-only role</span><span className="am-spacer"/><Button variant="primary" onClick={close}>Close</Button></>:
          <>{review?<Button onClick={()=>setReview(false)}>Back to edit</Button>:<span className="am-footer-hint">Permission changes preview only</span>}
            <span className="am-spacer"/><Button variant="primary" onClick={()=>review?setNotice(true):validate()}>
              {review?'Confirm preview':'Review permissions'} <ArrowRight size={15}/>
            </Button></>}
      </footer>
      {notice&&<div className="am-notice-layer" onMouseDown={e=>{e.stopPropagation();setNotice(false);}}>
        <NoticeBody title="Role preview complete" description="The permission configuration was reviewed. No roles or access permissions have been modified." done={()=>setNotice(false)}/>
      </div>}
    </section>
  </div>;
}

export function BranchEditorDialog({branch,close}:{branch?:BranchRecord|null;close:()=>void}) {
  const [name,setName]=useState(branch?.name??'');
  const [city,setCity]=useState(branch?.city??'');
  const [manager,setManager]=useState(branch?.manager??userRecords[0].name);
  const [status,setStatus]=useState<AccountStatus>(branch?.status??'Active');
  const [review,setReview]=useState(false);
  const [notice,setNotice]=useState(false);
  const [error,setError]=useState('');
  useDismiss(()=>notice?setNotice(false):review?setReview(false):close());
  const validate=()=>{
    if(!name.trim()){setError('Branch name is required.');return;}
    if(!branch&&branchNames.some(b=>b.toLowerCase()===name.trim().toLowerCase())){setError('A sample branch with this name already exists.');return;}
    setError('');setReview(true);
  };
  return <div className="am-overlay am-center" onMouseDown={close}>
    <section className="am-modal am-form-modal" role="dialog" aria-modal="true" aria-labelledby="am-branch-title" onMouseDown={e=>e.stopPropagation()}>
      <Header id="am-branch-title" eyebrow={review?'BRANCH REVIEW':branch?'EDIT BRANCH':'NEW BRANCH'}
        title={review?'Review branch':branch?'Edit branch':'Add branch'}
        subtitle="Manage company branch identity and responsibility." close={close}/>
      <div className="am-modal-body">
        {review?<><Summary data={[{label:'Branch name',value:name},{label:'City',value:city||'Not specified'},{label:'Branch manager',value:manager},{label:'Status',value:status}]}/><Note>Preview only. No branch or reporting scope is modified.</Note></>:
          <><div className="am-form-grid">
            <Field label="Branch name" required><Input aria-label="Branch name" placeholder="Enter name" value={name} onChange={e=>{setName(e.target.value);setError('');}}/></Field>
            <Field label="City / location"><Input aria-label="City or location" placeholder="City" value={city} onChange={e=>setCity(e.target.value)}/></Field>
            <Field label="Branch manager"><Select label="Branch manager" options={userRecords.map(u=>u.name)} value={manager} onChange={setManager}/></Field>
            <Field label="Status"><Select label="Branch status" options={accountStatuses} value={status} onChange={v=>setStatus(v as AccountStatus)}/></Field>
          </div><Note>An employee can belong to one primary branch. Branch scope controls resource visibility. Changes require authorization and audit logging.</Note>
          {error&&<p className="am-error" role="alert">{error}</p>}</>}
      </div>
      <footer className="am-modal-footer">{review?<Button onClick={()=>setReview(false)}>Back to edit</Button>:<Button onClick={close}>Close</Button>}
        <span className="am-spacer"/><Button variant="primary" onClick={()=>review?setNotice(true):validate()}>
          {review?'Confirm preview':'Preview branch'}</Button></footer>
      {notice&&<div className="am-notice-layer" onMouseDown={e=>{e.stopPropagation();setNotice(false);}}>
        <NoticeBody title="Branch preview complete" description="The branch configuration has been reviewed. No organization branch was created or changed." done={()=>setNotice(false)}/></div>}
    </section>
  </div>;
}

export function DepartmentEditorDialog({department,close}:{department?:DepartmentRecord|null;close:()=>void}) {
  const [name,setName]=useState(department?.name??'');
  const [branch,setBranch]=useState(department?.branch??'Head Office');
  const [lead,setLead]=useState(department?.lead??userRecords[0].name);
  const [status,setStatus]=useState<AccountStatus>(department?.status??'Active');
  const [review,setReview]=useState(false);
  const [notice,setNotice]=useState(false);
  const [error,setError]=useState('');
  useDismiss(()=>notice?setNotice(false):review?setReview(false):close());
  const validate=()=>{
    if(!name.trim()){setError('Department name is required.');return;}
    if(!department&&departmentNames.some(d=>d.toLowerCase()===name.trim().toLowerCase())){setError('A sample department with this name already exists.');return;}
    setError('');setReview(true);
  };
  return <div className="am-overlay am-center" onMouseDown={close}>
    <section className="am-modal am-form-modal" role="dialog" aria-modal="true" aria-labelledby="am-dept-title" onMouseDown={e=>e.stopPropagation()}>
      <Header id="am-dept-title" eyebrow={review?'DEPARTMENT REVIEW':department?'EDIT DEPARTMENT':'NEW DEPARTMENT'}
        title={review?'Review department':department?'Edit department':'Add department'}
        subtitle="Organize employees by functional department." close={close}/>
      <div className="am-modal-body">
        {review?<><Summary data={[{label:'Department',value:name},{label:'Primary branch',value:branch},{label:'Department lead',value:lead},{label:'Status',value:status}]}/><Note>Preview only. No department or historical membership is modified.</Note></>:
          <><div className="am-form-grid">
            <Field label="Department name" required><Input aria-label="Department name" placeholder="Enter name" value={name} onChange={e=>{setName(e.target.value);setError('');}}/></Field>
            <Field label="Primary branch"><Select label="Department primary branch" options={branchNames} value={branch} onChange={setBranch}/></Field>
            <Field label="Department lead"><Select label="Department lead" options={userRecords.map(u=>u.name)} value={lead} onChange={setLead}/></Field>
            <Field label="Status"><Select label="Department status" options={accountStatuses} value={status} onChange={v=>setStatus(v as AccountStatus)}/></Field>
          </div><Note>Deactivating a department preserves historical membership, assignments and audit records. Changes require authorization and audit logging.</Note>
          {error&&<p className="am-error" role="alert">{error}</p>}</>}
      </div>
      <footer className="am-modal-footer">{review?<Button onClick={()=>setReview(false)}>Back to edit</Button>:<Button onClick={close}>Close</Button>}
        <span className="am-spacer"/><Button variant="primary" onClick={()=>review?setNotice(true):validate()}>
          {review?'Confirm preview':'Preview department'}</Button></footer>
      {notice&&<div className="am-notice-layer" onMouseDown={e=>{e.stopPropagation();setNotice(false);}}>
        <NoticeBody title="Department preview complete" description="The department configuration has been reviewed. No department was created or changed." done={()=>setNotice(false)}/></div>}
    </section>
  </div>;
}
