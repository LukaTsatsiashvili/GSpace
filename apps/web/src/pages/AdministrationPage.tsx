import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowLeftRight, Clock3, Plus, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, PageHeader, SearchInput, SectionTabs, Select } from '../components/ui';
import {
  accountStatuses, branchNames, branches, departments,
  initials, permissionDefinitions, roleName, roles, tabs, userRecords, type AdminTab, type BranchRecord,
  type DepartmentRecord, type RoleRecord, type UserRecord
} from './administration-data';
import {
  BranchEditorDialog, DepartmentEditorDialog, ResetPasswordDialog,
  RoleEditorDialog, UserDetailsDrawer, UserEditorDialog
} from './AdministrationDialogs';
import './administration.css';
import AdministrationSettings from './AdministrationSettings';
import AdministrationUsers, { type AdminSummary } from './AdministrationUsers';
import AdministrationRoles from './AdministrationRoles';

function clickOnKey(event:KeyboardEvent<HTMLTableRowElement>,open:()=>void) {
  if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}
}
function StateBadge({value}:{value:string}) {
  return <span className={'am-status '+value.toLowerCase()}><i/>{value}</span>;
}
function Person({user}:{user:UserRecord}) {
  return <div className="am-person">
    <span className="am-avatar">{initials(user.name)}</span>
    <div><strong>{user.name}</strong><small>{user.email}</small></div>
  </div>;
}
function TableFooter({children}:{children:ReactNode}) {
  return <div className="am-table-footer">{children}</div>;
}
function SectionHeading({title,action}:{title:string;action?:ReactNode}) {
  return <div className="am-section-heading"><h2>{title}</h2>{action}</div>;
}
function BranchTable({rows}:{rows:BranchRecord[]}) {
  return <div className="am-table-scroll"><table className="am-table am-branch-table">
    <thead><tr><th>BRANCH</th><th>CITY</th><th>MANAGER</th><th>EMPLOYEES</th><th>ASSETS</th><th>STATUS</th></tr></thead>
    <tbody>{rows.map(item=><tr key={item.id}>
      <td><strong>{item.name}</strong><small>{item.id}</small></td>
      <td className="am-muted">{item.city}</td>
      <td className="am-muted">{item.manager}</td><td className="am-muted">{item.employees}</td>
      <td className="am-muted">{item.assets}</td><td><StateBadge value={item.status}/></td>
    </tr>)}</tbody>
  </table></div>;
}
function DepartmentTable({rows}:{rows:DepartmentRecord[]}) {
  return <div className="am-table-scroll"><table className="am-table am-department-table">
    <thead><tr><th>DEPARTMENT</th><th>DEPARTMENT LEAD</th><th>PRIMARY BRANCH</th><th>MEMBERS</th><th>STATUS</th></tr></thead>
    <tbody>{rows.map(item=><tr key={item.id}>
      <td><strong>{item.name}</strong><small>{item.id}</small></td>
      <td className="am-muted">{item.lead}</td><td className="am-muted">{item.branch}</td>
      <td className="am-muted">{item.members}</td><td><StateBadge value={item.status}/></td>
    </tr>)}</tbody>
  </table></div>;
}
function RoleCard({role,onOpen}:{role:RoleRecord;onOpen:()=>void}) {
  return <div className="am-role-card">
    <div className="am-role-top">
      <span className="am-role-icon"><ShieldCheck size={20}/></span>
      <div><div className="am-role-name">{role.name}
        {role.protected&&<span className="am-status protected"><i/>Protected</span>}</div>
        <small>{role.code}</small>
      </div>
    </div>
    <p>{role.description}</p>
    <div className="am-role-bottom"><span>{role.userCount} user{role.userCount===1?'':'s'} · {role.permissions.length} permissions</span>
      <Button onClick={onOpen}>{role.protected?'View role':'Edit role'}</Button>
    </div>
  </div>;
}

export default function AdministrationPage() {
  const [tab,setTab]=useState<AdminTab>('Users');
  const [liveSummary,setLiveSummary]=useState<AdminSummary|null>(null);
  const [userSearch,setUserSearch]=useState('');
  const [userRole,setUserRole]=useState('All roles');
  const [userStatus,setUserStatus]=useState('All statuses');
  const [userBranch,setUserBranch]=useState('All branches');
  const [roleSearch,setRoleSearch]=useState('');
  const [selectedUser,setSelectedUser]=useState<UserRecord|null>(null);
  const [editingUser,setEditingUser]=useState<UserRecord|null>(null);
  const [userFormOpen,setUserFormOpen]=useState(false);
  const [resetUser,setResetUser]=useState<UserRecord|null>(null);
  const [selectedRole,setSelectedRole]=useState<RoleRecord|null>(null);
  const [roleFormOpen,setRoleFormOpen]=useState(false);
  const [addBranchOpen,setAddBranchOpen]=useState(false);
  const [addDepartmentOpen,setAddDepartmentOpen]=useState(false);

  const visibleUsers=useMemo(()=>userRecords.filter(u=>{
    const query=userSearch.trim().toLowerCase();
    return (!query||[u.name,u.email,u.branch,u.department,u.id,roleName(u.role)].some(text=>text.toLowerCase().includes(query)))
      && (userRole==='All roles'||roleName(u.role)===userRole)
      && (userStatus==='All statuses'||u.status===userStatus)
      && (userBranch==='All branches'||u.branch===userBranch);
  }),[userSearch,userRole,userStatus,userBranch]);
  const visibleRoles=useMemo(()=>roles.filter(role=>{
    const q=roleSearch.trim().toLowerCase();
    return !q||[role.name,role.code,role.description,...role.permissions.flatMap(id=>{const permission=permissionDefinitions.find(p=>p.id===id);return [id,permission?.name??'',permission?.description??''];})].some(text=>text.toLowerCase().includes(q));
  }),[roleSearch]);
  const openCreateUser=()=>{setTab('Users');setEditingUser(null);setUserFormOpen(true);};
  const openEditUser=()=>{
    if(!selectedUser)return;
    setEditingUser(selectedUser);setSelectedUser(null);setUserFormOpen(true);
  };
  const openResetUser=()=>{
    if(!selectedUser)return;
    setResetUser(selectedUser);setSelectedUser(null);
  };
  const changeTab=(next:AdminTab)=>setTab(next);
  const activity=()=>{window.location.hash='audit';};
  return <div className="am-page">
    <PageHeader eyebrow="SYSTEM / ORGANIZATION CONTROL" title="Administration" badgeLabel="Users & Roles connected · other tabs preview"
      description="Manage company users, access roles, branches and resource policies."
      actions={<><Button icon={<Clock3 size={16}/>} onClick={activity}>Admin activity</Button>
        <Button variant="primary" icon={<Plus size={16}/>} onClick={openCreateUser}>Add user</Button></>}/>
    <div className="am-kpis">
      <Card className="am-kpi"><span>Total users</span><strong>{liveSummary?.total ?? '—'}</strong><small>Authorized accounts</small></Card>
      <Card className="am-kpi"><span>Active accounts</span><strong>{liveSummary?.active ?? '—'}</strong><small>{liveSummary?.inactive ?? '—'} inactive accounts</small></Card>
      <Card className="am-kpi"><span>Active roles</span><strong>{liveSummary?.roles ?? '—'}</strong><small>One role per employee</small></Card>
      <Card className="am-kpi"><span>Organization branches</span><strong>{liveSummary?.branches ?? '—'}</strong><small>One branch per employee</small></Card>
    </div>
    <Card className="am-catalog">
      <SectionTabs tabs={tabs} selected={tab} onChange={value=>changeTab(value as AdminTab)}/>
      {tab==='Users'&&<AdministrationUsers openCreate={userFormOpen}
        closeCreate={()=>setUserFormOpen(false)} onSummary={setLiveSummary}/>}
      
      {tab==='Roles & Permissions'&&<AdministrationRoles/>}

      {tab==='Branches'&&<>
        <SectionHeading title="Branch directory" action={<Button variant="primary" icon={<Plus size={16}/>} onClick={()=>setAddBranchOpen(true)}>Add branch</Button>}/>
        <BranchTable rows={branches}/>
        <TableFooter>Each employee belongs to exactly one branch. Branch scope applies to all resource permissions.</TableFooter>
      </>}

      {tab==='Departments'&&<>
        <SectionHeading title="Department structure" action={<Button variant="primary" icon={<Plus size={16}/>} onClick={()=>setAddDepartmentOpen(true)}>Add department</Button>}/>
        <DepartmentTable rows={departments}/>
        <TableFooter>Deactivated departments remain in historical assignment and audit records.</TableFooter>
      </>}

      {tab==='Settings'&&<AdministrationSettings/>}
    </Card>
    <div className="am-preview-caption"><Badge tone="blue">UI preview</Badge>
      <span>Users and Roles are backed by PostgreSQL. Branches, Departments and Settings remain UI previews.</span>
    </div>
    {roleFormOpen&&<RoleEditorDialog key={selectedRole?.code??'new-role'} role={selectedRole}
      close={()=>{setRoleFormOpen(false);setSelectedRole(null);}}/>}
    {addBranchOpen&&<BranchEditorDialog close={()=>setAddBranchOpen(false)}/>}
    {addDepartmentOpen&&<DepartmentEditorDialog close={()=>setAddDepartmentOpen(false)}/>}
  </div>;
}
