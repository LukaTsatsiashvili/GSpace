import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus, ShieldCheck, X } from 'lucide-react';
import { Button, Checkbox, Input, SearchInput, Textarea } from '../components/ui';
import { useAuth } from '../auth/AuthGate';
import AdministrationFeedback from './AdministrationFeedback';

type RoleRecord = { id: string; code: string; name: string; description: string; active: boolean; protected: boolean; userCount: number; permissions: string[] };
type PermissionRecord = { id: string; name: string; description: string };

async function api<T>(path: string, options?: { method: 'POST' | 'PATCH'; body: object }): Promise<T> {
  let init: RequestInit = { credentials: 'same-origin', cache: 'no-store' };
  if (options) {
    const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
    if (!csrf.ok) throw new Error('Could not initialize secure request.');
    const token = await csrf.json() as { csrfToken: string };
    init = { ...init, method: options.method, headers: {
      'Content-Type': 'application/json', 'X-CSRF-Token': token.csrfToken
    }, body: JSON.stringify(options.body) };
  }
  const response = await fetch('/api/v1/admin' + path, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(payload.error?.message || 'Unable to complete the request.');
  }
  return response.json() as Promise<T>;
}

function Dialog({ title, description, close, children, footer }: {
  title: string; description: string; close: () => void; children: ReactNode; footer: ReactNode
}) {
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.ui-select-options')) close();
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = old; };
  }, [close]);
  return <div className="am-overlay am-center" onMouseDown={close}>
    <section className="am-modal am-form-modal am-role-modal" role="dialog" aria-modal="true"
      aria-label={title} onMouseDown={event => event.stopPropagation()}>
      <header className="am-modal-header"><div><h2>{title}</h2><p>{description}</p></div>
        <button type="button" className="am-close" aria-label="Close" onClick={close}><X size={16}/></button></header>
      <div className="am-modal-body">{children}</div>
      <footer className="am-modal-footer">{footer}</footer>
    </section>
  </div>;
}

function Editor({ role, permissions, canManage, onClose, onSaved }: {
  role: RoleRecord | null; permissions: PermissionRecord[]; canManage: boolean; onClose: () => void; onSaved: () => void
}) {
  const readOnly = !canManage || !!role?.protected || role?.code === 'SYSTEM_ADMIN' || (role !== null && !role.active);
  const [name, setName] = useState(role?.name ?? '');
  const [code, setCode] = useState(role?.code ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [selected, setSelected] = useState<string[]>(role?.permissions ?? ['assets.view']);
  const [review, setReview] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const close = () => review ? setReview(false) : onClose();
  function toggle(key: string, checked: boolean) {
    setSelected(current => checked ? [...new Set([...current, key])] : current.filter(id => id !== key));
    setError('');
  }
  function validate() {
    if (!name.trim() || name.trim().length < 3) { setError('Role name must have at least 3 characters.'); return; }
    if (!role && !/^[A-Z][A-Z0-9_]{2,63}$/.test(code)) { setError('Use a unique code with 3–64 uppercase letters, digits and underscores.'); return; }
    if (!selected.length) { setError('Select at least one permission.'); return; }
    setError(''); setReview(true);
  }
  async function save() {
    if (pending || readOnly) return;
    setPending(true); setError('');
    try {
      const body = { name: name.trim(), description: description.trim(), permissions: selected };
      if (role) await api('/roles/' + role.id, { method: 'PATCH', body });
      else await api('/roles', { method: 'POST', body: { ...body, code } });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save role.'); }
    finally { setPending(false); }
  }
  return <Dialog title={role ? (readOnly ? 'View protected role' : review ? 'Review role changes' : 'Edit role permissions') :
    review ? 'Review new role' : 'Create custom role'}
    description={review ? 'Confirm the role definition before applying changes.' : 'One immutable role code and a controlled set of permissions.'}
    close={close}
    footer={<>
      <Button onClick={close}>{review ? 'Back' : 'Close'}</Button><span className="am-spacer"/>
      {!readOnly && <Button variant="primary" disabled={pending} onClick={review ? () => void save() : validate}>
        {pending ? 'Saving...' : review ? role ? 'Save changes' : 'Create role' : 'Review'}
      </Button>}
    </>}>
    {review ? <div className="am-summary">
      {([['Role', name], ['Code', code], ['Permissions', String(selected.length)], ['Description', description || '—']] as const).map(([label, value]) =>
        <div key={label} className="am-display-field"><small>{label}</small><strong>{value}</strong></div>)}
    </div> : <>
      <div className="am-form-grid">
        <label className="am-field"><span>Role name *</span>
          <Input value={name} readOnly={!!readOnly} maxLength={120} placeholder="e.g. Regional Controller"
            onChange={e=>{setName(e.target.value);if(!role)setCode(e.target.value.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,''));setError('');}}/>
        </label>
        <label className="am-field"><span>Unique code *</span>
          <Input value={code} readOnly={!!role || !!readOnly} maxLength={64}
            onChange={e=>{setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,''));setError('');}}/>
        </label>
        <label className="am-field am-span-full"><span>Description</span>
          <Textarea rows={3} value={description} readOnly={!!readOnly} maxLength={500} onChange={e=>setDescription(e.target.value)}/>
        </label>
      </div>
      <div className="am-permission-heading"><h3>Permissions <span>{selected.length} selected</span></h3>
        {!readOnly && <div><Button onClick={()=>setSelected(permissions.map(p=>p.id))}>Select all</Button>
          <Button onClick={()=>setSelected([])}>Clear</Button></div>}
      </div>
      <div className="am-permissions">{permissions.map(p=>
        <label key={p.id} className={'am-permission-option' + (selected.includes(p.id) ? ' selected' : '')}>
          <Checkbox checked={selected.includes(p.id)} disabled={!!readOnly}
            onChange={event=>toggle(p.id,event.target.checked)}/>
          <span><strong>{p.name}</strong><small>{p.description}</small></span>
        </label>
      )}</div>
      {readOnly && <p className="am-info">This role is read-only for your account or protected by the system.</p>}
    </>}
    {error && <p className="am-error" role="alert">{error}</p>}
  </Dialog>;
}

export default function AdministrationRoles() {
  const { user } = useAuth();
  const canManage = user.role.key === 'SYSTEM_ADMIN';
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dismissNotice = useCallback(() => setNotice(''), []);
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState<RoleRecord | null | undefined>(undefined);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [roleData, permissionData] = await Promise.all([
        api<{ roles: RoleRecord[] }>('/roles'),
        api<{ permissions: PermissionRecord[] }>('/permissions')
      ]);
      setRoles(roleData.roles); setPermissions(permissionData.permissions);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load roles.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(()=>{void load();},[load]);
  const visible = useMemo(()=>roles.filter(role => {
    const q = query.trim().toLowerCase();
    return !q || [role.name,role.code,role.description,...role.permissions].some(v=>v.toLowerCase().includes(q));
  }),[roles,query]);
  return <>
    <div className="am-toolbar am-role-toolbar">
      <SearchInput className="am-search" aria-label="Search roles or permissions"
        placeholder="Search roles or permissions..." value={query} onChange={event=>setQuery(event.target.value)}/>
      <span className="am-spacer"/>
      {canManage && <Button variant="primary" icon={<Plus size={16}/>} onClick={()=>setEditor(null)}>Create role</Button>}
    </div>
    {error && <div className="am-empty" role="alert">{error} <Button onClick={()=>void load()}>Retry</Button></div>}
    {notice && <AdministrationFeedback message={notice} onDismiss={dismissNotice}/>}
    {loading ? <div className="am-empty">Loading roles from PostgreSQL...</div> :
      <div className="am-role-grid">
        {visible.map(role=><div className="am-role-card" key={role.id}>
          <div className="am-role-top">
            <span className="am-role-icon"><ShieldCheck size={20}/></span>
            <div><div className="am-role-name">{role.name}
              {role.protected && <span className="am-status protected"><i/>Protected</span>}</div>
              <small>{role.code}</small>
            </div>
          </div>
          <p>{role.description}</p>
          <div className="am-role-bottom"><span>{role.userCount} user{role.userCount===1?'':'s'} · {role.permissions.length} permissions</span>
            <Button onClick={()=>setEditor(role)}>{role.protected || !canManage ? 'View role' : 'Edit role'}</Button></div>
        </div>)}
      </div>}
    {!loading && !visible.length && <div className="am-empty">No roles match your search.</div>}
    <div className="am-table-footer">Role codes are immutable. Protected roles cannot be edited. Changes to permissions immediately revoke affected sessions.</div>
    {editor !== undefined && <Editor role={editor} permissions={permissions} canManage={canManage}
      onClose={()=>setEditor(undefined)} onSaved={()=>{setEditor(undefined);setNotice('Role saved successfully.');void load();}}/>}
  </>;
}
