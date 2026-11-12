import { Prisma } from '@prisma/client';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { principal, requireAuth, requirePermission } from '../security/auth.js';

const router = Router();
const asyncRoute = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { void fn(req, res).catch(next); };

const codeSchema = z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/, 'Use 3–64 uppercase letters, digits and underscores.');
const roleSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500),
  permissions: z.array(z.string().min(1).max(100)).min(1).max(100)
    .refine(values => new Set(values).size === values.length, 'Duplicate permission selected')
}).strict();
const createSchema = roleSchema.extend({ code: codeSchema });
const updateSchema = roleSchema;

function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}
function serializeRole(role: {
  id: string; key: string; name: string; description: string; protected: boolean; active: boolean;
  grants: { permission: { key: string } }[]; _count: { users: number };
}) {
  return {
    id: role.id, code: role.key, name: role.name, description: role.description,
    protected: role.protected, active: role.active, userCount: role._count.users,
    permissions: role.grants.map(item => item.permission.key).sort()
  };
}
async function validatePermissionKeys(keys: string[], res: Response) {
  const permissions = await db.permission.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });
  if (permissions.length !== keys.length) {
    fail(res, 400, 'UNKNOWN_PERMISSION', 'One or more permissions do not exist');
    return null;
  }
  return permissions;
}

router.use(requireAuth, requirePermission('roles.manage'));

router.get('/roles', asyncRoute(async (_req, res) => {
  const roles = await db.role.findMany({
    include: { grants: { include: { permission: { select: { key: true } } } }, _count: { select: { users: true } } },
    orderBy: { name: 'asc' }
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ roles: roles.map(serializeRole) });
}));

router.get('/permissions', asyncRoute(async (_req, res) => {
  const rows = await db.permission.findMany({ select: { key: true, description: true }, orderBy: { key: 'asc' } });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ permissions: rows.map(row => ({ id: row.key, name: row.key, description: row.description })) });
}));

router.post('/roles', asyncRoute(async (req, res) => {
  const actor = principal(res);
  // Prevent the grant itself from being used for self-escalation on custom roles.
  if (actor.roleKey !== 'SYSTEM_ADMIN') {
    fail(res, 403, 'FORBIDDEN', 'Only the System Administrator may manage role definitions');
    return;
  }
  const input = createSchema.safeParse(req.body);
  if (!input.success) { fail(res, 400, 'INVALID_INPUT', 'Check role name, code and permissions'); return; }
  const permissions = await validatePermissionKeys(input.data.permissions, res);
  if (!permissions) return;
  try {
    const created = await db.$transaction(async tx => {
      const role = await tx.role.create({ data: {
        key: input.data.code, name: input.data.name,
        description: input.data.description, protected: false, active: true,
        grants: { create: permissions.map(p => ({ permissionId: p.id })) }
      } });
      await tx.securityAuditEvent.create({ data: {
        action: 'ADMIN_ROLE_CREATED', success: true, actorUserId: actor.userId,
        details: JSON.stringify({ roleId: role.id, code: role.key, permissions: input.data.permissions })
      } });
      return role;
    });
    res.status(201).json({ id: created.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      fail(res, 409, 'ROLE_EXISTS', 'A role with this code already exists');
      return;
    }
    throw error;
  }
}));

router.patch('/roles/:roleId', asyncRoute(async (req, res) => {
  const actor = principal(res);
  if (actor.roleKey !== 'SYSTEM_ADMIN') {
    fail(res, 403, 'FORBIDDEN', 'Only the System Administrator may manage role definitions');
    return;
  }
  const roleId = z.string().uuid().safeParse(req.params.roleId);
  const input = updateSchema.safeParse(req.body);
  if (!roleId.success || !input.success) {
    fail(res, 400, 'INVALID_INPUT', 'Check role details and selected permissions');
    return;
  }
  const permissions = await validatePermissionKeys(input.data.permissions, res);
  if (!permissions) return;
  try {
    await db.$transaction(async tx => {
      const role = await tx.role.findUnique({ where: { id: roleId.data }, include: {
        grants: { include: { permission: { select: { key: true } } } }
      } });
      if (!role) throw new Error('ROLE_NOT_FOUND');
      if (role.protected || role.key === 'SYSTEM_ADMIN') throw new Error('PROTECTED_ROLE');
      if (!role.active) throw new Error('INACTIVE_ROLE');
      const oldPermissions = role.grants.map(g => g.permission.key).sort();
      await tx.role.update({ where: { id: role.id }, data: {
        name: input.data.name, description: input.data.description
      } });
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: permissions.map(p => ({ roleId: role.id, permissionId: p.id }))
      });
      // Permissions are queried on every request, so future requests see the new grants.
      // Revoke existing sessions when grants change, to force fresh authorization.
      const changes = JSON.stringify(oldPermissions) !== JSON.stringify([...input.data.permissions].sort());
      if (changes) {
        await tx.session.updateMany({
          where: { user: { roleId: role.id }, revokedAt: null },
          data: { revokedAt: new Date() }
        });
      }
      await tx.securityAuditEvent.create({ data: {
        action: 'ADMIN_ROLE_UPDATED', success: true, actorUserId: actor.userId,
        details: JSON.stringify({
          roleId: role.id, code: role.key,
          before: { name: role.name, description: role.description, permissions: oldPermissions },
          after: { name: input.data.name, description: input.data.description, permissions: input.data.permissions }
        })
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'ROLE_NOT_FOUND') { fail(res, 404, 'NOT_FOUND', 'Role not found'); return; }
    if (error instanceof Error && error.message === 'PROTECTED_ROLE') { fail(res, 403, 'PROTECTED_ROLE', 'Protected role cannot be edited'); return; }
    if (error instanceof Error && error.message === 'INACTIVE_ROLE') { fail(res, 409, 'INACTIVE_ROLE', 'Inactive role cannot be edited'); return; }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      fail(res, 409, 'CONCURRENT_UPDATE', 'Concurrent change detected; reload and try again'); return;
    }
    throw error;
  }
}));

export default router;
