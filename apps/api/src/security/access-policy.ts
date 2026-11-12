import type { PrismaClient } from '@prisma/client';

export const PERMISSIONS = {
  'assets.view': 'See assets within authorized branches',
  'assets.create': 'Register new company resources',
  'assets.edit': 'Update asset profiles and state',
  'assignments.manage': 'Assign and return resources',
  'transfers.manage': 'Initiate and approve resource movement',
  'inventory.manage': 'Run physical counts and reconcile',
  'finance.view': 'Access purchase and cost details',
  'finance.edit': 'Record payments and audited cost corrections',
  'maintenance.manage': 'Assign service and close incidents',
  'licenses.manage': 'Change seats and renewals',
  'reports.export': 'Generate audited reports',
  'audit.view': 'Read immutable business event history',
  'security.view': 'Inspect sensitive security events',
  'users.manage': 'Create, update and disable accounts',
  'roles.manage': 'Change role permissions with authorization',
  'settings.manage': 'Manage organization-wide configuration'
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

const all = Object.keys(PERMISSIONS) as PermissionKey[];
const roleDefinitions: { key: string; name: string; description: string; permissions: PermissionKey[]; protected?: boolean }[] = [
  { key: 'SYSTEM_ADMIN', name: 'System Administrator', description: 'Protected system-wide administrator', permissions: all, protected: true },
  { key: 'COMPANY_ADMIN', name: 'Company Administrator', description: 'Company operations and user management', permissions: all.filter(p => !['finance.view', 'finance.edit', 'audit.view', 'security.view', 'roles.manage', 'settings.manage'].includes(p)) },
  { key: 'BRANCH_MANAGER', name: 'Branch Manager', description: 'One assigned branch', permissions: ['assets.view', 'assignments.manage', 'transfers.manage', 'inventory.manage', 'maintenance.manage'] },
  { key: 'ASSET_MANAGER', name: 'Asset Manager', description: 'Manage asset lifecycle operations', permissions: ['assets.view', 'assets.create', 'assets.edit', 'assignments.manage', 'transfers.manage', 'inventory.manage', 'maintenance.manage', 'licenses.manage'] },
  { key: 'EMPLOYEE', name: 'Employee', description: 'Own assets and handovers', permissions: ['assets.view'] },
  { key: 'AUDITOR', name: 'Auditor', description: 'Read permitted business and security records', permissions: ['assets.view', 'finance.view', 'audit.view', 'security.view', 'reports.export'] }
];

/** Idempotent, additive seed. Never remove customized grants or overwrite existing role settings. */
export async function seedAccessPolicy(prisma: PrismaClient) {
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { key }, update: { description }, create: { key, description } });
  }
  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { key: definition.key }, update: {},
      create: { key: definition.key, name: definition.name, description: definition.description, protected: !!definition.protected }
    });
    const grants = await prisma.permission.findMany({ where: { key: { in: definition.permissions } }, select: { id: true } });
    await prisma.rolePermission.createMany({
      data: grants.map(permission => ({ roleId: role.id, permissionId: permission.id })),
      skipDuplicates: true
    });
  }
}

export function canAccessBranch(roleKey: string, ownBranchId: string, requestedBranchId: string) {
  return roleKey === 'SYSTEM_ADMIN' || roleKey === 'COMPANY_ADMIN' || ownBranchId === requestedBranchId;
}
