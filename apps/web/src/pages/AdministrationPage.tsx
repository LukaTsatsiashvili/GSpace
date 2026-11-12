import { useCallback, useState } from 'react';
import { Clock3, Plus } from 'lucide-react';
import { Badge, Button, Card, PageHeader, SectionTabs } from '../components/ui';
import { useAuth } from '../auth/AuthGate';
import { tabs, type AdminTab } from './administration-data';
import AdministrationSettings from './AdministrationSettings';
import AdministrationUsers, { type AdminSummary } from './AdministrationUsers';
import AdministrationRoles from './AdministrationRoles';
import AdministrationOrganization from './AdministrationOrganization';
import './administration.css';

export default function AdministrationPage() {
  const { user } = useAuth();
  const permissions = user.role.permissions;
  const canUsers = permissions.includes('users.manage');
  const canRoles = permissions.includes('roles.manage');
  const canSettings = permissions.includes('settings.manage');
  const canAudit = permissions.includes('audit.view');
  const availableTabs = tabs.filter(tab =>
    tab === 'Roles & Permissions' ? canRoles :
    tab === 'Settings' ? canSettings : canUsers);
  const [tab, setTab] = useState<AdminTab>(() => availableTabs[0] ?? 'Users');
  const [liveSummary, setLiveSummary] = useState<AdminSummary | null>(null);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const refreshSummary = useCallback(async () => {
    if (!canUsers) return;
    try {
      const response = await fetch('/api/v1/admin/summary', { credentials: 'same-origin', cache: 'no-store' });
      if (response.ok) setLiveSummary(await response.json() as AdminSummary);
    } catch { /* Next Users load retries the summary. */ }
  }, [canUsers]);

  return <div className="am-page">
    <PageHeader eyebrow="SYSTEM / ORGANIZATION CONTROL" title="Administration"
      badgeLabel="Users, Roles & Organization connected · Settings preview"
      description="Manage organization users, access roles, branches, departments and resource policies."
      actions={<>
        {canAudit && <Button icon={<Clock3 size={16}/>} onClick={() => { window.location.hash = 'audit'; }}>
          Admin activity</Button>}
        {canUsers && <Button variant="primary" icon={<Plus size={16}/>}
          onClick={() => { setTab('Users'); setUserFormOpen(true); }}>Add user</Button>}
      </>}/>
    {canUsers && <div className="am-kpis">
      <Card className="am-kpi"><span>Total users</span><strong>{liveSummary?.total ?? '—'}</strong>
        <small>Authorized accounts</small></Card>
      <Card className="am-kpi"><span>Active accounts</span><strong>{liveSummary?.active ?? '—'}</strong>
        <small>{liveSummary?.inactive ?? '—'} inactive accounts</small></Card>
      <Card className="am-kpi"><span>Active roles</span><strong>{liveSummary?.roles ?? '—'}</strong>
        <small>One role per employee</small></Card>
      <Card className="am-kpi"><span>Organization branches</span><strong>{liveSummary?.branches ?? '—'}</strong>
        <small>One branch per employee</small></Card>
    </div>}
    <Card className="am-catalog">
      <SectionTabs tabs={availableTabs} selected={tab} onChange={value => setTab(value as AdminTab)}/>
      {tab === 'Users' && canUsers && <AdministrationUsers openCreate={userFormOpen}
        closeCreate={() => setUserFormOpen(false)} onSummary={setLiveSummary}/>}
      {tab === 'Roles & Permissions' && canRoles && <AdministrationRoles/>}
      {tab === 'Branches' && canUsers && <AdministrationOrganization kind="branches" onChanged={() => { void refreshSummary(); }}/>}
      {tab === 'Departments' && canUsers && <AdministrationOrganization kind="departments" onChanged={() => { void refreshSummary(); }}/>}
      {tab === 'Settings' && canSettings && <AdministrationSettings/>}
    </Card>
    <div className="am-preview-caption"><Badge tone="blue">Development build</Badge>
      <span>Users, Roles, Branches and Departments use PostgreSQL. Settings are still a design preview.</span>
    </div>
  </div>;
}
