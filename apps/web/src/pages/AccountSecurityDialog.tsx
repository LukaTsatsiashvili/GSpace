import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, ShieldCheck, X } from 'lucide-react';
import { Button, Input, SectionTabs } from '../components/ui';
import { useAuth } from '../auth/AuthGate';
import './account-security.css';

async function changePassword(currentPassword: string, newPassword: string) {
  const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
  if (!csrf.ok) throw new Error('Unable to initialize a secure request.');
  const token = await csrf.json() as { csrfToken: string };
  const response = await fetch('/api/v1/auth/change-password', {
    method: 'POST', credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token.csrfToken },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(data.error?.message || 'Could not change your password.');
  }
}

export default function AccountSecurityDialog({ close }: { close: () => void }) {
  const { user } = useAuth();
  const [tab, setTab] = useState('Profile');
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [changed, setChanged] = useState(false);
  const dismiss = () => {
    if (busy) return;
    if (changed) { window.location.reload(); return; }
    close();
  };
  useEffect(() => {
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('.ui-select-options')) {
        event.preventDefault();
        dismiss();
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = old; };
  }, [busy, changed, close]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!current) { setError('Enter your current password.'); return; }
    if (password.length < 6 || password.length > 1024) {
      setError('New password must contain 6–1024 characters.'); return;
    }
    if (password === current) { setError('Choose a different password.'); return; }
    if (password !== confirm) { setError('New passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      await changePassword(current, password);
      setCurrent(''); setPassword(''); setConfirm('');
      setChanged(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password.');
    } finally { setBusy(false); }
  }

  const initials = user.fullName.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return <div className="account-security-overlay" onMouseDown={dismiss}>
    <section className="account-security-modal" role="dialog" aria-modal="true" aria-labelledby="account-security-title"
      onMouseDown={event => event.stopPropagation()}>
      <header className="account-security-header">
        <div><h2 id="account-security-title">My profile</h2>
          <p>Personal information and account security</p></div>
        <button className="account-security-close" type="button" onClick={dismiss}
          aria-label="Close profile"><X size={18}/></button>
      </header>
      <div className="account-security-tabs">
        <SectionTabs tabs={['Profile', 'Security']} selected={tab} onChange={setTab}/>
      </div>
      <div className="account-security-body">
        {tab === 'Profile' && <div className="account-profile-content">
          <div className="account-profile-person">
            <span className="account-profile-avatar">{initials}</span>
            <div><strong>{user.fullName}</strong><span>{user.email}</span></div>
          </div>
          <div className="account-profile-details">
            {([['Role', user.role.name], ['Primary branch', user.branch.name],
              ['Department', user.department?.name ?? 'Not assigned']] as const).map(([label, value]) =>
              <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
          </div>
          <p className="account-security-note">Profile and organizational assignments are managed by your administrator.</p>
        </div>}
        {tab === 'Security' && (changed ? <div className="account-security-success" role="status">
          <span><ShieldCheck size={26}/></span>
          <h3>Password updated</h3>
          <p>Your password has been changed. All active sessions, including this one, have been revoked.
            Sign in again using the new password.</p>
          <Button variant="primary" onClick={() => window.location.reload()}>Go to sign in</Button>
        </div> : <form className="account-security-form" onSubmit={event => { void submit(event); }}>
          <div className="account-security-form-heading">
            <span><KeyRound size={19}/></span>
            <div><h3>Change password</h3><p>Enter your current password to choose a new one.</p></div>
          </div>
          <label htmlFor="account-current-password">Current password</label>
          <Input id="account-current-password" type={showPasswords ? 'text' : 'password'}
            autoComplete="current-password" value={current} maxLength={1024} required
            onChange={event => { setCurrent(event.target.value); setError(''); }}/>
          <label htmlFor="account-new-password">New password</label>
          <Input id="account-new-password" type={showPasswords ? 'text' : 'password'}
            autoComplete="new-password" value={password} minLength={6} maxLength={1024} required
            onChange={event => { setPassword(event.target.value); setError(''); }}/>
          <p className="account-security-hint">Use at least 6 characters. A longer, unique password is recommended.</p>
          <label htmlFor="account-confirm-password">Confirm new password</label>
          <Input id="account-confirm-password" type={showPasswords ? 'text' : 'password'}
            autoComplete="new-password" value={confirm} minLength={6} maxLength={1024} required
            onChange={event => { setConfirm(event.target.value); setError(''); }}/>
          <button type="button" className="account-security-visibility"
            onClick={() => setShowPasswords(value => !value)}>
            {showPasswords ? <EyeOff size={15}/> : <Eye size={15}/>}
            {showPasswords ? 'Hide passwords' : 'Show passwords'}
          </button>
          {error && <p className="account-security-error" role="alert">{error}</p>}
          <div className="account-security-form-footer">
            <span>All sessions will be signed out after the change.</span>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Updating...' : 'Update password'}
            </Button>
          </div>
        </form>)}
      </div>
      <footer className="account-security-footer">
        <Button onClick={dismiss}>{changed ? 'Go to sign in' : 'Close'}</Button>
      </footer>
    </section>
  </div>;
}
