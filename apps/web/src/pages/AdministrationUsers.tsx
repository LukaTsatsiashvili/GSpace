import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeftRight, Check, Copy, Plus, X } from 'lucide-react';
import { Button, Input, SearchInput, Select, Textarea } from '../components/ui';
import { useAuth } from '../auth/AuthGate';

type Role = { id: string; key: string; name: string; protected: boolean };
type Branch = { id: string; name: string };
type Department = { id: string; name: string; branchId?: string };
type Account = {
  id: string; name: string; email: string; role: Role; branch: Branch;
  department: Department | null; active: boolean; pendingActivation: boolean;
  phone: string; lastActive: string | null;
};
type Lookups = { roles: Role[]; branches: Branch[]; departments: Department[] };
export type AdminSummary = { total: number; active: number; inactive: number; roles: number; branches: number };
type FormValues = {
  name: string; email: string; roleId: string; branchId: string;
  departmentId: string; active: boolean; phone: string;
};

async function readError(response: Response) {
  const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
  return data.error?.message || 'Request failed. Please try again.';
}
async function api<T>(path: string, options?: { method: 'POST' | 'PATCH'; body: object }): Promise<T> {
  let init: RequestInit = { credentials: 'same-origin', cache: 'no-store' };
  if (options) {
    const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
    if (!csrf.ok) throw new Error('Unable to initialize secure request.');
    const token = await csrf.json() as { csrfToken: string };
    init = {
      ...init, method: options.method,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token.csrfToken },
      body: JSON.stringify(options.body)
    };
  }
  const result = await fetch('/api/v1/admin' + path, init);
  if (!result.ok) throw new Error(await readError(result));
  return result.status === 204 ? undefined as T : result.json() as Promise<T>;
}

function Initials({ name }: { name: string }) {
  return <span className="am-avatar">{name.trim().split(/\s+/).slice(0,2).map(word => word.charAt(0)).join('').toUpperCase()}</span>;
}
function Status({ user }: { user: Account }) {
  const label = !user.active ? 'Inactive' : user.pendingActivation ? 'Pending' : 'Active';
  return <span className={'am-status ' + (label === 'Pending' ? 'inactive' : label.toLowerCase())}><i/>{label}</span>;
}
function Modal({ title, description, close, children, footer, drawer = false }: {
  title: string; description: string; close: () => void; children: ReactNode;
  footer: ReactNode; drawer?: boolean;
}) {
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.ui-select-options')) close();
    };
    document.addEventListener('keydown', handler);
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = old; };
  }, [close]);
  return <div className={'am-overlay ' + (drawer ? '' : 'am-center')} onMouseDown={close}>
    <section className={'am-modal ' + (drawer ? 'am-drawer' : 'am-form-modal')} role="dialog" aria-modal="true"
      aria-label={title} onMouseDown={e => e.stopPropagation()}>
      <header className="am-modal-header"><div><h2>{title}</h2><p>{description}</p></div>
        <button type="button" className="am-close" aria-label="Close" onClick={close}><X size={16}/></button></header>
      <div className="am-modal-body">{children}</div>
      <footer className="am-modal-footer">{footer}</footer>
    </section>
  </div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="am-field"><span>{label}</span>{children}</label>;
}
function Form({ user, lookups, close, saved }: {
  user: Account | null; lookups: Lookups; close: () => void;
  saved: (activationPath: string | null) => void;
}) {
  const [form, setForm] = useState<FormValues>({
    name: user?.name ?? '', email: user?.email ?? '',
    roleId: user?.role.id ?? lookups.roles.find(r => r.key === 'EMPLOYEE')?.id ?? lookups.roles[0]?.id ?? '',
    branchId: user?.branch.id ?? lookups.branches[0]?.id ?? '',
    departmentId: user?.department?.id ?? '', active: user?.active ?? true, phone: user?.phone ?? ''
  });
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [passwordNote, setPasswordNote] = useState(false);
  const { user: principalUser } = useAuth();
  const isSelf = user?.id === principalUser.id;
  const isProtected = user?.role.protected ?? false;
  const branches = lookups.branches;
  const departments = lookups.departments.filter(d => d.branchId === form.branchId);
  const roleOptions = lookups.roles.filter(r => !r.protected || user?.role.id === r.id);
  const assignableRoles = isSelf || isProtected ? lookups.roles.filter(r => r.id === user?.role.id) : roleOptions;
  const change = (key: keyof FormValues, value: string | boolean) => {
    setForm(old => ({ ...old, [key]: value, ...(key === 'branchId' ? { departmentId: '' } : {}) }));
    setError('');
  };
  const selectedRole = lookups.roles.find(r => r.id === form.roleId);
  const selectedBranch = branches.find(b => b.id === form.branchId);
  const selectedDepartment = lookups.departments.find(d => d.id === form.departmentId);
  const closeModal = useCallback(() => review ? setReview(false) : close(), [review, close]);

  function validate() {
    if (form.name.trim().split(/\s+/).length < 2) { setError('Enter first and last name.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setError('Enter a valid work email.'); return; }
    if (!selectedRole || !selectedBranch) { setError('Choose role and branch.'); return; }
    setReview(true);
    setError('');
  }
  async function save() {
    if (pending) return;
    setPending(true); setError('');
    try {
      const body = {
        name: form.name.trim(), email: form.email.trim(), roleId: form.roleId, branchId: form.branchId,
        departmentId: form.departmentId || null, active: form.active, phone: form.phone.trim() || null
      };
      if (user) {
        await api('/users/' + user.id, { method: 'PATCH', body });
        saved(null);
      } else {
        const result = await api<{ activationPath: string | null }>('/users', { method: 'POST', body });
        saved(result.activationPath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save account.');
    } finally { setPending(false); }
  }
  return <Modal title={review ? 'Review account details' : user ? 'Edit user account' : 'Create employee account'}
    description={review ? 'Review the information before saving it in PostgreSQL.' : 'Assign one role and one primary branch.'}
    close={closeModal}
    footer={<>
      <Button onClick={review ? () => setReview(false) : close}>{review ? 'Back to edit' : 'Cancel'}</Button>
      <span className="am-spacer"/>
      <Button variant="primary" disabled={pending} onClick={review ? () => void save() : validate}>
        {pending ? 'Saving...' : review ? (user ? 'Save changes' : 'Create account') : 'Review changes'}
      </Button>
    </>}>
    {review ? <div className="am-summary">
      {[
        ['Full name', form.name], ['Email', form.email], ['Role', selectedRole?.name ?? '—'],
        ['Branch', selectedBranch?.name ?? '—'], ['Department', selectedDepartment?.name ?? 'None'],
        ['Status', form.active ? 'Active' : 'Inactive'], ['Phone', form.phone || 'Not provided']
      ].map(([label, value]) => <div className="am-display-field" key={label}><small>{label}</small><strong>{value}</strong></div>)}
    </div> : <div className="am-form-grid">
      <Field label="Full name *"><Input aria-label="Full name" value={form.name} onChange={e => change('name', e.target.value)} placeholder="First and last name"/></Field>
      <Field label="Work email *"><Input type="email" aria-label="Work email" value={form.email} onChange={e => change('email', e.target.value)} placeholder="name@company.com"/></Field>
      <Field label="Role *"><Select label="Role" value={selectedRole?.name ?? ''}
        options={assignableRoles.map(r => r.name)} onChange={name => change('roleId', lookups.roles.find(r => r.name === name)?.id ?? form.roleId)}/></Field>
      <Field label="Primary branch *"><Select label="Primary branch" value={selectedBranch?.name ?? ''}
        options={branches.map(b => b.name)} onChange={name => change('branchId', branches.find(b => b.name === name)?.id ?? form.branchId)}/></Field>
      <Field label="Department"><Select label="Department"
        value={selectedDepartment?.name ?? 'No department'}
        options={['No department', ...departments.map(d => d.name)]}
        onChange={name => change('departmentId', departments.find(d => d.name === name)?.id ?? '')}/></Field>
      <Field label="Account status"><Select label="Account status" value={form.active ? 'Active' : 'Inactive'}
        options={isSelf || isProtected ? ['Active'] : ['Active', 'Inactive']}
        onChange={name => change('active', name === 'Active')}/></Field>
      <Field label="Phone"><Input aria-label="Phone" type="tel" placeholder="+995 ..." value={form.phone}
        onChange={e => change('phone', e.target.value)}/></Field>
      <Field label="Access scope"><Input aria-label="Access scope" readOnly value="Assigned role + primary branch"/></Field>
    </div>}
    <p className="am-info">{user
      ? 'Changes to role, branch, account status or email revoke active sessions. Every update is audited.'
      : 'New accounts receive a single-use activation link in local development. Passwords are chosen by employees, not by administrators.'}</p>
    {error && <p className="am-error" role="alert">{error}</p>}
    {passwordNote && <p className="am-info">Account passwords are set using the separate secure activation/reset flow.</p>}
  </Modal>;
}
function ResetDialog({ user, close, saved }: {
  user: Account; close: () => void; saved: (activationPath: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function reset() {
    if (pending) return;
    if (reason.trim().length < 10) { setError('Enter at least 10 characters explaining this reset.'); return; }
    setPending(true); setError('');
    try {
      const result = await api<{ activationPath: string }>(
        '/users/' + user.id + '/reset-password', { method: 'POST', body: { reason: reason.trim() } }
      );
      saved(result.activationPath);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to reset credentials.'); }
    finally { setPending(false); }
  }
  return <Modal title="Reset employee password" description={user.name + ' · ' + user.email} close={close}
    footer={<><Button onClick={close}>Cancel</Button><span className="am-spacer"/>
      <Button variant="primary" disabled={pending} onClick={() => void reset()}>{pending ? 'Processing...' : 'Issue reset link'}</Button></>}>
    <div className="am-form-grid">
      <Field label="Employee"><Input readOnly value={user.name}/></Field>
      <Field label="Session policy"><Input readOnly value="Revoke all active sessions"/></Field>
      <div className="am-span-full"><Field label="Administrative reason *">
        <Textarea rows={3} value={reason} onChange={e => { setReason(e.target.value); setError(''); }}
          placeholder="Explain why the password reset is required."/>
      </Field></div>
    </div>
    <p className="am-info">The account's existing password will stop working until the single-use link is redeemed. This action is audited.</p>
    {error && <p className="am-error" role="alert">{error}</p>}
  </Modal>;
}
function AccountDetails({ user, close, onEdit, onReset }: {
  user: Account; close: () => void; onEdit: () => void; onReset: () => void;
}) {
  const { user: me } = useAuth();
  return <Modal drawer title={user.name} description={'Employee account · ' + user.id} close={close}
    footer={<><Button onClick={close}>Close</Button><span className="am-spacer"/>
      <Button onClick={onReset} disabled={!user.active || user.id === me.id}>Reset password</Button>
      <Button variant="primary" onClick={onEdit}>Edit account</Button></>}>
    <div className="am-detail-pills"><Status user={user}/>
      {user.role.protected && <span className="am-status protected">Protected</span>}</div>
    <div className="am-summary">
      {[
        ['Email', user.email], ['Role', user.role.name], ['Branch', user.branch.name],
        ['Department', user.department?.name || '—'], ['Phone', user.phone || '—'],
        ['Last active', user.lastActive ? new Date(user.lastActive).toLocaleString() : 'Never']
      ].map(([label, value]) => <div className="am-display-field" key={label}><small>{label}</small><strong>{value}</strong></div>)}
    </div>
    <section className="am-detail-section"><h3>Access policy</h3>
      <p className="am-muted-copy">One role and primary branch per user. Permissions and branch scope are enforced by the backend.</p>
    </section>
    <section className="am-detail-section"><h3>Security</h3>
      <p className="am-muted-copy">Inactive accounts cannot sign in. Resetting credentials invalidates existing sessions.</p>
    </section>
  </Modal>;
}
function InvitationDialog({ path, close }: { path: string; close: () => void }) {
  const fullUrl = location.origin + location.pathname + path.slice(1);
  const [copied, setCopied] = useState(false);
  return <Modal title="One-time activation link" description="Local development only — the link is shown once."
    close={close}
    footer={<><span className="am-spacer"/><Button variant="primary" onClick={close}>Done</Button></>}>
    <p className="am-info">Copy this link and open it in a private/incognito window. It expires in 60 minutes.
      No email has been sent. Do not share it with anyone except the intended employee.</p>
    <div className="am-display-field"><small>Activation / Password reset link</small><strong>{fullUrl}</strong></div>
    <Button onClick={() => { void navigator.clipboard.writeText(fullUrl).then(() => setCopied(true)); }}
      icon={copied ? <Check size={16}/> : <Copy size={16}/>}>{copied ? 'Copied' : 'Copy link'}</Button>
  </Modal>;
}
export default function AdministrationUsers({ openCreate, closeCreate, onSummary }: {
  openCreate: boolean; closeCreate: () => void; onSummary: (value: AdminSummary) => void;
}) {
  const [users, setUsers] = useState<Account[]>([]);
  const [lookups, setLookups] = useState<Lookups>({ roles: [], branches: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('All roles');
  const [branch, setBranch] = useState('All branches');
  const [status, setStatus] = useState('All statuses');
  const [selected, setSelected] = useState<Account | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [resetting, setResetting] = useState<Account | null>(null);
  const [invite, setInvite] = useState<string | null>(null);
  const [createInternal, setCreateInternal] = useState(false);
  const [notice, setNotice] = useState('');
  const { user: me } = useAuth();

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [accounts, refs, summary] = await Promise.all([
        api<{ users: Account[] }>('/users'),
        api<Lookups>('/lookups'),
        api<AdminSummary>('/summary')
      ]);
      setUsers(accounts.users); setLookups(refs); onSummary(summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cannot load Administration users.');
    } finally { setLoading(false); }
  }, [onSummary]);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => users.filter(u => {
    const query = search.trim().toLowerCase();
    const state = !u.active ? 'Inactive' : u.pendingActivation ? 'Pending' : 'Active';
    return (!query || [u.name, u.email, u.role.name, u.branch.name, u.department?.name || ''].some(x => x.toLowerCase().includes(query)))
      && (role === 'All roles' || u.role.name === role)
      && (branch === 'All branches' || u.branch.name === branch)
      && (status === 'All statuses' || state === status);
  }), [users, search, role, branch, status]);
  function saved(activationPath: string | null) {
    setEditing(null); setCreateInternal(false); closeCreate(); setSelected(null); setResetting(null);
    if (activationPath) setInvite(activationPath);
    else setNotice('Account updated successfully.');
    void load();
  }
  const isCreating = openCreate || createInternal;
  const openNew = () => { setEditing(null); setCreateInternal(true); };
  const closeNew = () => { setCreateInternal(false); closeCreate(); };
  function onRowKey(e: KeyboardEvent<HTMLTableRowElement>, user: Account) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(user); }
  }
  return <>
    <div className="am-toolbar">
      <SearchInput className="am-search" aria-label="Search users" placeholder="Search users, emails or branches..."
        value={search} onChange={e => setSearch(e.target.value)}/>
      <Select className="am-filter" label="Filter role" options={['All roles', ...lookups.roles.map(r => r.name)]} value={role} onChange={setRole}/>
      <Select className="am-filter" label="Filter user status" options={['All statuses','Active','Inactive','Pending']} value={status} onChange={setStatus}/>
      <Select className="am-filter" label="Filter branch" options={['All branches', ...lookups.branches.map(b => b.name)]} value={branch} onChange={setBranch}/>
      <span className="am-spacer"/>
      <Button variant="primary" icon={<Plus size={16}/>} onClick={openNew}>Add user</Button>
    </div>
    {error && <div className="am-empty" role="alert">{error} <Button onClick={() => void load()}>Retry</Button></div>}
    {notice && <div className="am-info" role="status">{notice} <Button onClick={() => setNotice('')}>Dismiss</Button></div>}
    {loading ? <div className="am-empty">Loading users from PostgreSQL...</div> : <>
      <div className="am-table-scroll"><table className="am-table am-users-table">
        <thead><tr><th>EMPLOYEE</th><th>ROLE</th><th>BRANCH / DEPARTMENT</th><th>STATUS</th><th>LAST ACTIVE</th><th aria-label="Actions"/></tr></thead>
        <tbody>{visible.map(user => <tr key={user.id} role="button" tabIndex={0}
          aria-label={'Open account of ' + user.name} onClick={() => setSelected(user)}
          onKeyDown={e => onRowKey(e, user)}>
          <td><div className="am-person"><Initials name={user.name}/><div><strong>{user.name}</strong><small>{user.email}</small></div></div></td>
          <td><strong>{user.role.name}</strong></td>
          <td><strong>{user.branch.name}</strong><small>{user.department?.name || '—'}</small></td>
          <td><Status user={user}/></td>
          <td className="am-muted">{user.lastActive ? new Date(user.lastActive).toLocaleString() : 'Never'}</td>
          <td className="am-action"><ArrowLeftRight size={17}/></td>
        </tr>)}</tbody>
      </table></div>
      {!visible.length && <div className="am-empty">No users found for the selected filters.</div>}
      <div className="am-table-footer">{visible.length} of {users.length} actual PostgreSQL accounts shown · changes are audited.</div>
    </>}
    {selected && <AccountDetails user={selected} close={() => setSelected(null)}
      onEdit={() => { setEditing(selected); setSelected(null); }}
      onReset={() => { setResetting(selected); setSelected(null); }}/>}
    {(isCreating || editing) && !!lookups.roles.length && !!lookups.branches.length &&
      <Form user={editing} lookups={lookups} close={() => { setEditing(null); closeNew(); }} saved={saved}/>}
    {resetting && <ResetDialog user={resetting} close={() => setResetting(null)} saved={saved}/>}
    {invite && <InvitationDialog path={invite} close={() => setInvite(null)}/>}
  </>;
}
