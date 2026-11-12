import { Router, type NextFunction, type Request, type Response } from 'express';
import { Prisma, type Role } from '@prisma/client';
import { z } from 'zod';
import { db } from '../db.js';
import { normalizeEmail } from '../security/password.js';
import { principal, requireAuth, requirePermission, type AuthPrincipal } from '../security/auth.js';
import { invitationsEnabled, issueInvitation } from '../security/invitations.js';

const router = Router();
const asyncRoute = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { void fn(req, res).catch(next); };

const id = z.string().uuid();
const createSchema = z.object({
  name: z.string().trim().min(3).max(200),
  email: z.string().trim().email().max(254),
  roleId: id, branchId: id, departmentId: id.nullable(),
  phone: z.string().trim().max(60).nullable().optional(),
  active: z.boolean().default(true)
}).strict();
const updateSchema = createSchema.partial().strict();
const resetSchema = z.object({ reason: z.string().trim().min(10).max(1000) }).strict();
const userInclude = {
  role: true, branch: true, department: true,
  credential: { select: { userId: true } },
  sessions: { select: { lastSeenAt: true }, orderBy: { lastSeenAt: 'desc' as const }, take: 1 }
} as const;

function apiUser(user: any) {
  return {
    id: user.id, name: user.fullName, email: user.email,
    role: { id: user.role.id, key: user.role.key, name: user.role.name, protected: user.role.protected },
    branch: { id: user.branch.id, name: user.branch.name },
    department: user.department ? { id: user.department.id, name: user.department.name } : null,
    active: user.active, pendingActivation: !user.credential,
    phone: user.phone || '',
    lastActive: user.sessions?.[0]?.lastSeenAt ?? null
  };
}
function failure(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}
function globalScope(actor: AuthPrincipal) {
  return ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(actor.roleKey);
}
async function assignableRole(roleId: string, actor: AuthPrincipal): Promise<Role | null> {
  const target = await db.role.findUnique({
    where: { id: roleId },
    include: { grants: { include: { permission: true } } }
  });
  if (!target?.active) return null;
  if (actor.roleKey === 'SYSTEM_ADMIN') return target;
  if (target.protected) return null;
  return target.grants.every(item => actor.permissions.includes(item.permission.key)) ? target : null;
}
async function validOrganization(branchId: string, departmentId: string | null) {
  const branch = await db.branch.findUnique({ where: { id: branchId } });
  if (!branch?.active) return false;
  if (!departmentId) return true;
  const department = await db.department.findUnique({ where: { id: departmentId } });
  return !!department?.active && department.branchId === branchId;
}
function allowedToManageTarget(actor: AuthPrincipal, target: { id: string; role: { protected: boolean }; branchId: string }) {
  if (target.role.protected && actor.roleKey !== 'SYSTEM_ADMIN') return false;
  return globalScope(actor) || target.branchId === actor.branchId;
}
function databaseError(err: unknown, res: Response) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    failure(res, 409, 'CONFLICT', 'A user with this email already exists');
    return true;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
    failure(res, 409, 'CONCURRENT_UPDATE', 'Please reload and retry the change');
    return true;
  }
  return false;
}

router.use(requireAuth, requirePermission('users.manage'));

router.get('/users', asyncRoute(async (_req, res) => {
  const actor = principal(res);
  const rows = await db.user.findMany({
    where: globalScope(actor) ? {} : { branchId: actor.branchId },
    include: userInclude,
    orderBy: { fullName: 'asc' }
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ users: rows.map(apiUser) });
}));

router.get('/lookups', asyncRoute(async (_req, res) => {
  const actor = principal(res);
  const [roles, branches, departments] = await Promise.all([
    db.role.findMany({ where: { active: true }, include: { grants: { include: { permission: true } } }, orderBy: { name: 'asc' } }),
    db.branch.findMany({ where: globalScope(actor) ? { active: true } : { active: true, id: actor.branchId }, orderBy: { name: 'asc' } }),
    db.department.findMany({ where: { active: true, branchId: globalScope(actor) ? undefined : actor.branchId }, orderBy: { name: 'asc' } })
  ]);
  res.json({
    roles: roles.filter(role => actor.roleKey === 'SYSTEM_ADMIN' || (!role.protected && role.grants.every(g => actor.permissions.includes(g.permission.key)))).map(r => ({ id: r.id, key: r.key, name: r.name, protected: r.protected })),
    branches: branches.map(b => ({ id: b.id, name: b.name })),
    departments: departments.map(d => ({ id: d.id, name: d.name, branchId: d.branchId }))
  });
}));

router.get('/summary', asyncRoute(async (_req, res) => {
  const actor = principal(res);
  const where = globalScope(actor) ? {} : { branchId: actor.branchId };
  const [total, active, roles, branches] = await Promise.all([
    db.user.count({ where }), db.user.count({ where: { ...where, active: true } }),
    db.role.count({ where: { active: true } }),
    db.branch.count({ where: globalScope(actor) ? { active: true } : { active: true, id: actor.branchId } })
  ]);
  res.json({ total, active, inactive: total - active, roles, branches });
}));

router.post('/users', asyncRoute(async (req, res) => {
  const actor = principal(res);
  if (!invitationsEnabled) {
    failure(res, 503, 'INVITATION_DELIVERY_REQUIRED', 'Configure secure invitation delivery before creating accounts in production');
    return;
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { failure(res, 400, 'INVALID_INPUT', 'Check name, email, role, branch and department'); return; }
  const input = parsed.data;
  if (!globalScope(actor) && input.branchId !== actor.branchId) {
    failure(res, 403, 'FORBIDDEN', 'Cannot create users in another branch'); return;
  }
  if (!await assignableRole(input.roleId, actor) || !await validOrganization(input.branchId, input.departmentId)) {
    failure(res, 403, 'INVALID_MEMBERSHIP', 'Role, branch or department is unavailable'); return;
  }
  try {
    const { user, activationPath } = await db.$transaction(async tx => {
      const created = await tx.user.create({
        data: {
          fullName: input.name, email: normalizeEmail(input.email), active: input.active,
          roleId: input.roleId, branchId: input.branchId, departmentId: input.departmentId,
          phone: input.phone || null
        }
      });
      const link = input.active ? await issueInvitation(tx, created.id, 'ACTIVATE') : null;
      await tx.securityAuditEvent.create({ data: {
        action: 'ADMIN_USER_CREATED', success: true, actorUserId: actor.userId, targetUserId: created.id,
        details: JSON.stringify({ roleId: input.roleId, branchId: input.branchId, active: input.active })
      } });
      return { user: created, activationPath: link };
    });
    res.status(201).json({ userId: user.id, activationPath });
  } catch (error) { if (!databaseError(error, res)) throw error; }
}));

router.patch('/users/:userId', asyncRoute(async (req, res) => {
  const actor = principal(res);
  const userId = id.safeParse(req.params.userId);
  const parsed = updateSchema.safeParse(req.body);
  if (!userId.success || !parsed.success || Object.keys(parsed.data).length === 0) {
    failure(res, 400, 'INVALID_INPUT', 'Supply valid fields to update'); return;
  }
  const input = parsed.data;
  const target = await db.user.findUnique({ where: { id: userId.data }, include: { role: true } });
  if (!target) { failure(res, 404, 'NOT_FOUND', 'User not found'); return; }
  if (!allowedToManageTarget(actor, target)) { failure(res, 403, 'FORBIDDEN', 'Cannot manage this user'); return; }
  const roleId = input.roleId ?? target.roleId;
  const branchId = input.branchId ?? target.branchId;
  const departmentId = input.departmentId !== undefined ? input.departmentId : target.departmentId;
  if (!globalScope(actor) && branchId !== actor.branchId) {
    failure(res, 403, 'FORBIDDEN', 'Cannot move users to another branch'); return;
  }
  if (!await assignableRole(roleId, actor) || !await validOrganization(branchId, departmentId)) {
    failure(res, 403, 'INVALID_MEMBERSHIP', 'Role, branch or department is unavailable'); return;
  }
  // A user cannot disable, demote, or move their own security identity.
  if (actor.userId === target.id &&
      ((input.active === false) || roleId !== target.roleId || branchId !== target.branchId)) {
    failure(res, 403, 'SELF_CHANGE_DENIED', 'You cannot change your own role, branch or active status'); return;
  }
  try {
    await db.$transaction(async tx => {
      // Read again inside the transaction. Concurrent protected-admin changes fail serializably.
      const current = await tx.user.findUniqueOrThrow({ where: { id: userId.data }, include: { role: true } });
      if (current.role.protected && (!input.active && input.active !== undefined || roleId !== current.roleId)) {
        const remaining = await tx.user.count({
          where: { active: true, role: { key: 'SYSTEM_ADMIN' }, id: { not: current.id } }
        });
        if (remaining === 0) throw new Error('LAST_SYSTEM_ADMIN');
      }
      await tx.user.update({
        where: { id: current.id },
        data: {
          fullName: input.name ?? current.fullName,
          email: input.email ? normalizeEmail(input.email) : current.email,
          roleId, branchId, departmentId,
          phone: input.phone === undefined ? current.phone : input.phone || null,
          active: input.active ?? current.active
        }
      });
      // A deactivated or transferred employee must not retain organizational leadership.
      if (branchId !== current.branchId || (current.active && input.active === false)) {
        const [managedBranches, ledDepartments] = await Promise.all([
          tx.branch.updateMany({ where: { managerId: current.id }, data: { managerId: null } }),
          tx.department.updateMany({ where: { leadUserId: current.id }, data: { leadUserId: null } })
        ]);
        if (managedBranches.count || ledDepartments.count) {
          await tx.securityAuditEvent.create({ data: {
            action: 'ADMIN_ORGANIZATION_LEADERSHIP_CLEARED', success: true,
            actorUserId: actor.userId, targetUserId: current.id,
            details: JSON.stringify({
              reason: branchId !== current.branchId ? 'BRANCH_CHANGED' : 'ACCOUNT_DEACTIVATED',
              branches: managedBranches.count, departments: ledDepartments.count
            })
          } });
        }
      }
      if (roleId !== current.roleId || branchId !== current.branchId ||
          input.active === false || (input.email && normalizeEmail(input.email) !== current.email)) {
        await tx.session.updateMany({ where: { userId: current.id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await tx.securityAuditEvent.create({ data: {
        action: 'ADMIN_USER_UPDATED', success: true, actorUserId: actor.userId, targetUserId: current.id,
        details: JSON.stringify({
          before: { roleId: current.roleId, branchId: current.branchId, active: current.active },
          after: { roleId, branchId, active: input.active ?? current.active }
        })
      } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'LAST_SYSTEM_ADMIN') {
      failure(res, 409, 'LAST_SYSTEM_ADMIN', 'The last active System Administrator cannot be disabled or demoted');
      return;
    }
    if (!databaseError(error, res)) throw error;
  }
}));

router.post('/users/:userId/reset-password', asyncRoute(async (req, res) => {
  const actor = principal(res);
  if (!invitationsEnabled) {
    failure(res, 503, 'INVITATION_DELIVERY_REQUIRED', 'Configure secure password reset delivery before using this action in production');
    return;
  }
  const userId = id.safeParse(req.params.userId);
  const parsed = resetSchema.safeParse(req.body);
  if (!userId.success || !parsed.success) {
    failure(res, 400, 'INVALID_INPUT', 'Provide an administrative reason of at least 10 characters'); return;
  }
  const target = await db.user.findUnique({ where: { id: userId.data }, include: { role: true } });
  if (!target) { failure(res, 404, 'NOT_FOUND', 'User not found'); return; }
  if (!allowedToManageTarget(actor, target) || !target.active ||
      target.id === actor.userId) {
    failure(res, 403, 'FORBIDDEN', 'Cannot reset this account'); return;
  }
  const activationPath = await db.$transaction(async tx => {
    const link = await issueInvitation(tx, target.id, 'RESET');
    await tx.userCredential.updateMany({ where: { userId: target.id }, data: { loginDisabled: true } });
    await tx.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.securityAuditEvent.create({ data: {
      action: 'ADMIN_PASSWORD_RESET_REQUESTED', success: true,
      actorUserId: actor.userId, targetUserId: target.id,
      details: JSON.stringify({ reason: parsed.data.reason })
    } });
    return link;
  });
  res.json({ activationPath });
}));

export default router;
