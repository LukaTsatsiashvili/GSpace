import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Boxes, Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import { Button, Input } from '../components/ui';
import './auth.css';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: { key: string; name: string; permissions: string[] };
  branch: { id: string; name: string };
  department: { id: string; name: string } | null;
  mustChangePassword: boolean;
};

type AuthContextValue = { user: AuthUser; signOut: () => Promise<void> };
const Context = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error('Auth context missing');
  return context;
}

/** Client-side navigation convenience only. Server-side authorization is authoritative. */
export function canOpenModule(id: string, permissions: string[]): boolean {
  const has = (...keys: string[]) => keys.some(key => permissions.includes(key));
  switch (id) {
    case 'overview': return true;
    case 'resources': return has('assets.view');
    case 'assignments': return has('assets.view', 'assignments.manage');
    case 'approvals': return true; // personal requests need per-operation API checks later
    case 'transfers': return has('transfers.manage');
    case 'inventory': return has('inventory.manage');
    case 'licenses': return has('licenses.manage');
    case 'maintenance': return has('maintenance.manage', 'assets.view');
    case 'finance': return has('finance.view');
    case 'reports': return has('reports.export');
    case 'audit': return has('audit.view', 'security.view');
    case 'administration': return has('users.manage', 'roles.manage', 'settings.manage');
    default: return false;
  }
}

type ApiError = { error?: { message?: string } };
async function parseError(response: Response) {
  const payload = await response.json().catch(() => ({})) as ApiError;
  return payload.error?.message || 'The request failed. Please try again.';
}

/** CSRF token is returned by our same-origin API; no tokens are stored in localStorage. */
async function postJson(path: string, input: object): Promise<Response> {
  const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
  if (!csrf.ok) throw new Error('Cannot reach the authentication service.');
  const payload = await csrf.json() as { csrfToken: string };
  return fetch(path, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': payload.csrfToken },
    body: JSON.stringify(input)
  });
}

function Login({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true); setError('');
    try {
      const response = await postJson('/api/v1/auth/login', { email, password });
      if (!response.ok) throw new Error(await parseError(response));
      const data = await response.json() as { user: AuthUser };
      setPassword('');
      onLogin(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in unavailable.');
    } finally {
      setPending(false);
    }
  }

  return <div className="app dark auth-shell">
    <main className="auth-card">
      <div className="auth-brand"><span className="brand-mark"><Boxes size={22}/></span><div><strong>GSpace</strong><small>ENTERPRISE HUB</small></div></div>
      <div className="auth-symbol"><ShieldCheck size={26}/></div>
      <h1>Welcome back</h1>
      <p className="auth-lead">Sign in to manage your company's resources securely.</p>
      <form onSubmit={submit} className="auth-form">
        <label htmlFor="login-email">Work email</label>
        <Input id="login-email" type="email" autoComplete="username" autoFocus required maxLength={254}
          placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)}/>
        <label htmlFor="login-password">Password</label>
        <div className="auth-password">
          <Input id="login-password" type={show ? 'text' : 'password'} autoComplete="current-password"
            required placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)}/>
          <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff size={17}/> : <Eye size={17}/>}
          </button>
        </div>
        {error && <p className="auth-message" role="alert">{error}</p>}
        <Button variant="primary" type="submit" disabled={pending} icon={<LogIn size={17}/>}>
          {pending ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
      <p className="auth-footnote">Accounts are provisioned by your system administrator.</p>
    </main>
  </div>;
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [loadingError, setLoadingError] = useState('');
  useEffect(() => {
    let live = true;
    async function refresh() {
      try {
        const response = await fetch('/api/v1/auth/me', { credentials: 'same-origin', cache: 'no-store' });
        if (!live) return;
        if (response.status === 401) { setUser(null); setLoadingError(''); return; }
        if (!response.ok) throw new Error('Authentication service unavailable.');
        const data = await response.json() as { user: AuthUser };
        if (live) { setUser(data.user); setLoadingError(''); }
      } catch {
        if (live) { setUser(null); setLoadingError('Could not connect to the GSpace API.'); }
      }
    }
    void refresh();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60_000);
    return () => { live = false; clearInterval(interval); };
  }, []);

  async function signOut() {
    const response = await postJson('/api/v1/auth/logout', {});
    if (!response.ok && response.status !== 401) throw new Error(await parseError(response));
    setUser(null);
  }

  if (user === undefined) return <div className="app dark auth-loading"><ShieldCheck size={25}/><p>Checking your session...</p></div>;
  if (user === null) return <>
    {loadingError && <div className="auth-service-warning" role="alert">{loadingError}</div>}
    <Login onLogin={setUser}/>
  </>;
  return <Context.Provider value={{ user, signOut }}>{children}</Context.Provider>;
}
