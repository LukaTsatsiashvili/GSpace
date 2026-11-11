export type AdminTab = 'Users' | 'Roles & Permissions' | 'Branches' | 'Departments' | 'Settings';
export type AccountStatus = 'Active' | 'Inactive';
export type RoleCode = string;
export type PermissionId =
  'assets.view' | 'assets.create' | 'assets.edit' | 'assignments.manage' |
  'transfers.manage' | 'inventory.manage' | 'finance.view' | 'finance.edit' |
  'maintenance.manage' | 'licenses.manage' | 'reports.export' | 'audit.view' |
  'security.view' | 'users.manage' | 'roles.manage' | 'settings.manage';

export interface UserRecord {
  id: string; name: string; email: string; role: RoleCode; branch: string;
  department: string; status: AccountStatus; lastActive: string; phone: string;
}
export interface RoleRecord {
  code: RoleCode; name: string; description: string; permissions: PermissionId[];
  protected?: boolean; userCount: number;
}
export interface BranchRecord { id: string; name: string; city: string; manager: string; employees: number; assets: number; status: AccountStatus; }
export interface DepartmentRecord { id: string; name: string; lead: string; branch: string; members: number; status: AccountStatus; }

export const tabs: AdminTab[] = ['Users','Roles & Permissions','Branches','Departments','Settings'];
export const branchNames = ['Head Office','Tbilisi Store 01','Batumi Store 01','Kutaisi Store 01'];
export const departmentNames = ['IT','Operations','Finance','Retail'];
export const accountStatuses: AccountStatus[] = ['Active','Inactive'];
export const permissionDefinitions: {id:PermissionId;name:string;description:string}[] = [
  {id:'assets.view',name:'View assets',description:'See assets within authorized branches'},
  {id:'assets.create',name:'Create assets',description:'Register new company resources'},
  {id:'assets.edit',name:'Edit assets',description:'Update asset profiles and state'},
  {id:'assignments.manage',name:'Manage assignments',description:'Assign and return resources'},
  {id:'transfers.manage',name:'Manage transfers',description:'Initiate and approve resource movement'},
  {id:'inventory.manage',name:'Manage inventory',description:'Run physical counts and reconcile'},
  {id:'finance.view',name:'View financial data',description:'Access purchase and cost details'},
  {id:'finance.edit',name:'Edit financial data',description:'Record payments and audited cost corrections'},
  {id:'maintenance.manage',name:'Manage maintenance',description:'Assign service and close incidents'},
  {id:'licenses.manage',name:'Manage licenses',description:'Change seats and renewals'},
  {id:'reports.export',name:'Export reports',description:'Generate audited reports'},
  {id:'audit.view',name:'View business audit',description:'Read immutable business event history'},
  {id:'security.view',name:'View security audit',description:'Inspect sensitive security events'},
  {id:'users.manage',name:'Manage users',description:'Create, update and disable accounts'},
  {id:'roles.manage',name:'Manage roles',description:'Change role permissions with authorization'},
  {id:'settings.manage',name:'System settings',description:'Manage organization-wide configuration'}
];
const allPermissions = permissionDefinitions.map(p=>p.id);
export const roles: RoleRecord[] = [
  {code:'SYSTEM_ADMIN',name:'System Administrator',description:'Protected system-wide role with full management privileges.',permissions:allPermissions,protected:true,userCount:1},
  {code:'COMPANY_ADMIN',name:'Company Administrator',description:'Organization-wide operations and user administration.',permissions:allPermissions.filter(x=>!['finance.view','finance.edit','audit.view','security.view','roles.manage','settings.manage'].includes(x)),userCount:1},
  {code:'BRANCH_MANAGER',name:'Branch Manager',description:'Resource oversight and operations within a single assigned branch.',permissions:['assets.view','assignments.manage','transfers.manage','inventory.manage','maintenance.manage'],userCount:2},
  {code:'ASSET_MANAGER',name:'Asset Manager',description:'Register and coordinate asset lifecycle operations.',permissions:['assets.view','assets.create','assets.edit','assignments.manage','transfers.manage','inventory.manage','maintenance.manage','licenses.manage'],userCount:1},
  {code:'EMPLOYEE',name:'Employee',description:'View own resources, confirm handovers and report incidents.',permissions:['assets.view'],userCount:1},
  {code:'AUDITOR',name:'Auditor',description:'Read-only access to permitted financial, audit and reporting history.',permissions:['assets.view','finance.view','audit.view','security.view','reports.export'],userCount:1}
];
export const userRecords: UserRecord[] = [
  {id:'USR-001',name:'Sandro Papiashvili',email:'sandro.papiashvili@gtex.ge',role:'SYSTEM_ADMIN',branch:'Head Office',department:'IT',status:'Active',lastActive:'Nov 06, 2026 · 10:42',phone:'+995 5XX XX XX XX'},
  {id:'USR-002',name:'Nino Kapanadze',email:'nino.kapanadze@gtex.ge',role:'ASSET_MANAGER',branch:'Head Office',department:'IT',status:'Active',lastActive:'Nov 06, 2026 · 09:31',phone:'+995 5XX XX XX XX'},
  {id:'USR-003',name:'Giorgi Maisuradze',email:'giorgi.maisuradze@gtex.ge',role:'BRANCH_MANAGER',branch:'Batumi Store 01',department:'Retail',status:'Active',lastActive:'Nov 06, 2026 · 08:56',phone:'+995 5XX XX XX XX'},
  {id:'USR-004',name:'Mariam Beridze',email:'mariam.beridze@gtex.ge',role:'EMPLOYEE',branch:'Tbilisi Store 01',department:'Operations',status:'Active',lastActive:'Nov 05, 2026 · 18:20',phone:'+995 5XX XX XX XX'},
  {id:'USR-005',name:'Luka Dolidze',email:'luka.dolidze@gtex.ge',role:'BRANCH_MANAGER',branch:'Kutaisi Store 01',department:'Retail',status:'Active',lastActive:'Nov 05, 2026 · 14:07',phone:'+995 5XX XX XX XX'},
  {id:'USR-006',name:'Tekla Durglishvili',email:'tekla.durglishvili@gtex.ge',role:'AUDITOR',branch:'Head Office',department:'Finance',status:'Inactive',lastActive:'Oct 29, 2026 · 16:50',phone:'+995 5XX XX XX XX'},
  {id:'USR-007',name:'Irma Gogoladze',email:'irma.gogoladze@gtex.ge',role:'COMPANY_ADMIN',branch:'Head Office',department:'Operations',status:'Active',lastActive:'Nov 04, 2026 · 11:15',phone:'+995 5XX XX XX XX'}
];
export const branches: BranchRecord[] = [
  {id:'BR-001',name:'Head Office',city:'Tbilisi',manager:'Sandro Papiashvili',employees:12,assets:684,status:'Active'},
  {id:'BR-002',name:'Tbilisi Store 01',city:'Tbilisi',manager:'Nino Kapanadze',employees:8,assets:418,status:'Active'},
  {id:'BR-003',name:'Batumi Store 01',city:'Batumi',manager:'Giorgi Maisuradze',employees:7,assets:316,status:'Active'},
  {id:'BR-004',name:'Kutaisi Store 01',city:'Kutaisi',manager:'Luka Dolidze',employees:6,assets:287,status:'Active'}
];
export const departments: DepartmentRecord[] = [
  {id:'DEP-001',name:'IT',lead:'Sandro Papiashvili',branch:'Head Office',members:5,status:'Active'},
  {id:'DEP-002',name:'Operations',lead:'Irma Gogoladze',branch:'Head Office',members:11,status:'Active'},
  {id:'DEP-003',name:'Finance',lead:'Tekla Durglishvili',branch:'Head Office',members:4,status:'Active'},
  {id:'DEP-004',name:'Retail',lead:'Giorgi Maisuradze',branch:'Batumi Store 01',members:15,status:'Active'}
];
export const settingsSections = [
  {title:'System preferences',description:'Language, currency, time zone and company identity'},
  {title:'Resource policies',description:'Identifiers, lifecycle defaults and assignment restrictions'},
  {title:'Notifications & reminders',description:'Assignment, approval, maintenance and renewal alerts'},
  {title:'Security & sessions',description:'Account rules, active sessions and audit-related controls'},
  {title:'Storage & attachments',description:'Document handling, database storage and upload policies'},
  {title:'System status',description:'Background jobs, maintenance mode, backup and version'}
];
export function roleName(code: RoleCode) {return roles.find(r=>r.code===code)?.name ?? code;}
export function initials(name:string) {return name.split(/\s+/).map(t=>t.charAt(0)).slice(0,2).join('').toUpperCase();}
export function normalizeRoleCode(name:string) {return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');}
