import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Input, SearchInput, Select } from '../components/ui';
import { useAuth } from '../auth/AuthGate';
import { useToast } from '../components/toast';

type Person = { id: string; name: string };
type Employee = Person & { email: string; branchId: string };
type Branch = {
  id: string; code: string; name: string; city: string; active: boolean;
  manager: Person | null; employees: number; assets: number; departments: number
};
type Department = {
  id: string; name: string; branchId: string; branch: string; active: boolean;
  lead: Person | null; members: number
};
type Organization = { branches: Branch[]; departments: Department[]; users: Employee[] };
type Kind = 'branches' | 'departments';

async function api<T>(path: string, options?: { method: 'POST' | 'PATCH'; body: object }): Promise<T> {
  let init: RequestInit = { credentials: 'same-origin', cache: 'no-store' };
  if (options) {
    const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
    if (!csrf.ok) throw Error('Unable to initialize secure request.');
    const token = await csrf.json() as { csrfToken: string };
    init = { ...init, method: options.method,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token.csrfToken },
      body: JSON.stringify(options.body) };
  }
  const response = await fetch('/api/v1/admin/organization' + path, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw Error(body.error?.message ?? 'Unable to complete organization request.');
  }
  return response.json() as Promise<T>;
}

function Dialog({ title, subtitle, close, children, footer }: {
  title: string; subtitle: string; close: () => void; children: ReactNode; footer: ReactNode;
}) {
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.ui-select-options')) close();
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = old; };
  }, [close]);
  return <div className="am-overlay am-center" onMouseDown={close}>
    <section className="am-modal am-form-modal" role="dialog" aria-modal="true" aria-label={title}
      onMouseDown={event => event.stopPropagation()}>
      <header className="am-modal-header"><div><h2>{title}</h2><p>{subtitle}</p></div>
        <button type="button" className="am-close" aria-label="Close" onClick={close}><X size={16}/></button>
      </header>
      <div className="am-modal-body">{children}</div>
      <footer className="am-modal-footer">{footer}</footer>
    </section>
  </div>;
}
function State({ active }: { active: boolean }) {
  return <span className={'am-status ' + (active ? 'active' : 'inactive')}>
    <i/>{active ? 'Active' : 'Inactive'}
  </span>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="am-field"><span>{label}</span>{children}</label>;
}
function Summary({ values }: { values: [string, string][] }) {
  return <div className="am-summary">{values.map(([label, value]) =>
    <div className="am-display-field" key={label}><small>{label}</small><strong>{value}</strong></div>
  )}</div>;
}
function Editor({ kind, organization, selected, canManage, close, saved }: {
  kind: Kind; organization: Organization; selected: Branch | Department | null;
  canManage: boolean; close: () => void; saved: () => void;
}) {
  const branch = kind === 'branches' ? selected as Branch | null : null;
  const department = kind === 'departments' ? selected as Department | null : null;
  const readOnly = !canManage;
  const [name, setName] = useState(selected?.name ?? '');
  const [code, setCode] = useState(branch?.code ?? '');
  const [city, setCity] = useState(branch?.city ?? '');
  const [branchId, setBranchId] = useState(department?.branchId ?? organization.branches.find(b => b.active)?.id ?? '');
  const [leaderId, setLeaderId] = useState(branch?.manager?.id ?? department?.lead?.id ?? '');
  const [active, setActive] = useState(selected?.active ?? true);
  const [review, setReview] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const branchOptions = organization.branches.filter(b => b.active || b.id === department?.branchId);
  const chosenBranch = organization.branches.find(b => b.id === branchId);
  const employees = organization.users.filter(u =>
    u.branchId === (kind === 'branches' ? branch?.id : branchId));
  const leaderOption = (person: Employee) => person.name + ' (' + person.email + ')';
  const choices = ['Unassigned', ...employees.map(leaderOption)];
  const chosenLeader = employees.find(u => u.id === leaderId);
  const changeBranch = (label: string) => {
    setBranchId(organization.branches.find(b => b.name === label)?.id ?? branchId);
    setLeaderId('');
    setError('');
  };
  const dismiss = () => review && !pending ? setReview(false) : !pending ? close() : undefined;
  function validate() {
    if (name.trim().length < 2) { setError('Name must contain at least two characters.'); return; }
    if (kind === 'branches' && !branch && !/^[A-Z][A-Z0-9_]{2,63}$/.test(code)) {
      setError('Code must contain 3–64 uppercase letters, digits or underscores.'); return;
    }
    if (kind === 'departments' && (!chosenBranch || active && !chosenBranch.active)) {
      setError('Please select an active branch.'); return;
    }
    setError(''); setReview(true);
  }
  async function save() {
    if (pending || readOnly) return;
    setPending(true); setError('');
    try {
      if (kind === 'branches') {
        const data = { name: name.trim(), city: city.trim(),
          managerId: branch ? leaderId || null : null, active };
        if (branch) await api('/branches/' + branch.id, { method: 'PATCH', body: data });
        else await api('/branches', { method: 'POST', body: { ...data, code } });
      } else {
        const data = { name: name.trim(), branchId, leadUserId: leaderId || null, active };
        if (department) await api('/departments/' + department.id, { method: 'PATCH', body: data });
        else await api('/departments', { method: 'POST', body: data });
      }
      saved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save changes.'); }
    finally { setPending(false); }
  }
  const title = (selected ? 'Edit ' : 'Add ') + (kind === 'branches' ? 'branch' : 'department');
  const label = kind === 'branches' ? 'Branch' : 'Department';
  const display = kind === 'branches' ? [
    ['Branch name', name], ['Branch code', branch?.code ?? code],
    ['City / location', city || 'Not specified'],
    ['Branch manager', chosenLeader?.name ?? 'Unassigned'],
    ['Status', active ? 'Active' : 'Inactive']
  ] as [string, string][] : [
    ['Department name', name], ['Primary branch', chosenBranch?.name ?? '—'],
    ['Department lead', chosenLeader?.name ?? 'Unassigned'],
    ['Status', active ? 'Active' : 'Inactive']
  ] as [string, string][];
  return <Dialog title={review ? 'Review ' + label.toLowerCase() + ' changes' : title}
    subtitle={review ? 'Confirm the details before saving to PostgreSQL.' :
      'Changes to organization structure are permission-controlled and audited.'}
    close={dismiss}
    footer={<>
      <Button disabled={pending} onClick={dismiss}>{review ? 'Back to edit' : 'Close'}</Button>
      <span className="am-spacer"/>
      {!readOnly && <Button variant="primary" disabled={pending}
        onClick={review ? () => void save() : validate}>
        {pending ? 'Saving...' : review ? selected ? 'Save changes' : 'Create ' + label.toLowerCase() : 'Review'}
      </Button>}
    </>}>
    {review ? <Summary values={display}/> : <div className="am-form-grid">
      <Field label={label + ' name *'}><Input value={name} readOnly={readOnly} maxLength={120}
        placeholder={kind === 'branches' ? 'Branch name' : 'Department name'}
        onChange={event => {
          const value = event.target.value;
          setName(value);
          if (kind === 'branches' && !branch) setCode(value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, ''));
          setError('');
        }}/></Field>
      {kind === 'branches' ? <>
        <Field label="Branch code *"><Input value={code} readOnly={!!branch || readOnly} maxLength={64}
          onChange={event => { setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '')); setError(''); }}/></Field>
        <Field label="City / location"><Input value={city} readOnly={readOnly} maxLength={120}
          onChange={event => setCity(event.target.value)} placeholder="e.g. Tbilisi"/></Field>
        <Field label="Branch manager">{branch ? <Select label="Branch manager" value={chosenLeader ? leaderOption(chosenLeader) : 'Unassigned'}
          options={choices} onChange={value => setLeaderId(employees.find(u => leaderOption(u) === value)?.id ?? '')}/> :
          <Input readOnly value="Assign after creating the branch"/>}</Field>
      </> : <>
        <Field label="Primary branch *"><Select label="Primary branch" value={chosenBranch?.name ?? ''}
          options={branchOptions.map(b => b.name)} onChange={changeBranch}/></Field>
        <Field label="Department lead"><Select label="Department lead"
          value={chosenLeader ? leaderOption(chosenLeader) : 'Unassigned'} options={choices}
          onChange={value => setLeaderId(employees.find(u => leaderOption(u) === value)?.id ?? '')}/></Field>
      </>}
      <Field label="Status"><Select label="Status" value={active ? 'Active' : 'Inactive'}
        options={['Active', 'Inactive']} onChange={value => setActive(value === 'Active')}/></Field>
    </div>}
    {kind === 'branches' && <p className="am-info">
      Branch deactivation is blocked while it has active employees, active departments or any assets.
      Branch codes remain immutable after creation.
    </p>}
    {kind === 'departments' && <p className="am-info">
      Departments retain their history when deactivated. A department with members cannot move to another branch.
    </p>}
    {error && <p className="am-error" role="alert">{error}</p>}
  </Dialog>;
}

export default function AdministrationOrganization({ kind, onChanged }: {
  kind: Kind; onChanged: () => void;
}) {
  const { user } = useAuth();
  const canManage = user.role.key === 'SYSTEM_ADMIN' || user.role.key === 'COMPANY_ADMIN';
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [editor, setEditor] = useState<Branch | Department | null | undefined>(undefined);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setOrganization(await api<Organization>('')); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load organization records.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const branches = useMemo(() => (organization?.branches ?? []).filter(b => {
    const q = search.trim().toLowerCase();
    return (!q || [b.name, b.code, b.city, b.manager?.name ?? ''].some(value => value.toLowerCase().includes(q))) &&
      (status === 'All statuses' || b.active === (status === 'Active'));
  }), [organization, search, status]);
  const departments = useMemo(() => (organization?.departments ?? []).filter(d => {
    const q = search.trim().toLowerCase();
    return (!q || [d.name, d.branch, d.lead?.name ?? ''].some(value => value.toLowerCase().includes(q))) &&
      (status === 'All statuses' || d.active === (status === 'Active'));
  }), [organization, search, status]);
  const isBranch = kind === 'branches';
  function saved() {
    setEditor(undefined);
    toast.success((isBranch ? 'Branch' : 'Department') + ' saved successfully.');
    void load(); onChanged();
  }
  return <>
    <div className="am-toolbar">
      <SearchInput className="am-search" aria-label={isBranch ? 'Search branches' : 'Search departments'}
        placeholder={isBranch ? 'Search branches, codes, managers...' : 'Search departments, branches, leads...'}
        value={search} onChange={event => setSearch(event.target.value)}/>
      <Select label="Filter status" options={['All statuses', 'Active', 'Inactive']}
        value={status} onChange={setStatus}/>
      <span className="am-spacer"/>
      {canManage && <Button variant="primary" icon={<Plus size={16}/>}
        onClick={() => setEditor(null)}>{isBranch ? 'Add branch' : 'Add department'}</Button>}
    </div>
    {error && <div className="am-empty" role="alert">{error} <Button onClick={() => void load()}>Retry</Button></div>}
    {loading ? <div className="am-empty">Loading organization records from PostgreSQL...</div> :
      organization && <div className="am-table-scroll"><table className="am-table">
        <thead>{isBranch ? <tr><th>BRANCH</th><th>CITY</th><th>MANAGER</th><th>EMPLOYEES</th><th>ASSETS</th><th>STATUS</th><th>ACTIONS</th></tr> :
          <tr><th>DEPARTMENT</th><th>DEPARTMENT LEAD</th><th>PRIMARY BRANCH</th><th>MEMBERS</th><th>STATUS</th><th>ACTIONS</th></tr>}</thead>
        <tbody>{isBranch ? branches.map(b => <tr key={b.id}>
          <td><strong>{b.name}</strong><small>{b.code}</small></td>
          <td className="am-muted">{b.city || '—'}</td>
          <td className="am-muted">{b.manager?.name || 'Unassigned'}</td>
          <td>{b.employees}</td><td>{b.assets}</td><td><State active={b.active}/></td>
          <td><Button onClick={() => setEditor(b)}>{canManage ? 'Edit' : 'View'}</Button></td>
        </tr>) : departments.map(d => <tr key={d.id}>
          <td><strong>{d.name}</strong><small>{d.id.slice(0, 8)}</small></td>
          <td className="am-muted">{d.lead?.name || 'Unassigned'}</td>
          <td className="am-muted">{d.branch}</td><td>{d.members}</td>
          <td><State active={d.active}/></td>
          <td><Button onClick={() => setEditor(d)}>{canManage ? 'Edit' : 'View'}</Button></td>
        </tr>)}</tbody>
      </table></div>}
    {!loading && !error && !(isBranch ? branches : departments).length &&
      <div className="am-empty">No matching {isBranch ? 'branches' : 'departments'}.</div>}
    <div className="am-table-footer">{isBranch ?
      'Branch scope is enforced by the API. Employee and asset counts reflect actual records.' :
      'Each department belongs to one branch. Members and leads reflect stored organizational data.'}
    </div>
    {organization && editor !== undefined &&
      <Editor key={editor?.id ?? 'new'} kind={kind} organization={organization} selected={editor}
        canManage={canManage} close={() => setEditor(undefined)} saved={saved}/>}
  </>;
}
