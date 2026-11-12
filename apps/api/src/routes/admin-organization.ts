import { Prisma } from '@prisma/client';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { principal, requireAuth, requirePermission } from '../security/auth.js';

const router = Router();
const run = (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { handler(req, res).catch(next); };
function fail(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}
const id = z.string().uuid();
const name = z.string().trim().min(2).max(120);
const branchFields = z.object({
  name, city: z.string().trim().max(120), managerId: id.nullable(), active: z.boolean()
}).strict();
const createBranchFields = branchFields.extend({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/, 'Use 3–64 uppercase letters, digits or underscores.')
});
const departmentFields = z.object({
  name, branchId: id, leadUserId: id.nullable(), active: z.boolean()
}).strict();

const branchInclude = {
  manager: { select: { id: true, fullName: true } },
  _count: { select: { users: true, resources: true, departments: true } }
} satisfies Prisma.BranchInclude;
const departmentInclude = {
  branch: { select: { id: true, name: true } },
  lead: { select: { id: true, fullName: true } },
  _count: { select: { users: true } }
} satisfies Prisma.DepartmentInclude;
const serializeBranch = (row: Prisma.BranchGetPayload<{ include: typeof branchInclude }>) => ({
  id: row.id, code: row.code, name: row.name, city: row.city, active: row.active,
  manager: row.manager ? { id: row.manager.id, name: row.manager.fullName } : null,
  employees: row._count.users, assets: row._count.resources, departments: row._count.departments
});
const serializeDepartment = (row: Prisma.DepartmentGetPayload<{ include: typeof departmentInclude }>) => ({
  id: row.id, name: row.name, branchId: row.branchId, branch: row.branch.name, active: row.active,
  lead: row.lead ? { id: row.lead.id, name: row.lead.fullName } : null,
  members: row._count.users
});
const central = (role: string) => role === 'SYSTEM_ADMIN' || role === 'COMPANY_ADMIN';
function writePermission(_req: Request, res: Response, next: NextFunction) {
  if (!central(principal(res).roleKey)) {
    fail(res, 403, 'FORBIDDEN', 'Only central administrators may change organization records');
    return;
  }
  next();
}
async function validLeader(tx: Prisma.TransactionClient, userId: string | null, branchId: string) {
  if (!userId) return true;
  const user = await tx.user.findUnique({ where: { id: userId }, select: { branchId: true, active: true } });
  return !!user?.active && user.branchId === branchId;
}
async function nameUsed(tx: Prisma.TransactionClient, kind: 'branch' | 'department',
  value: string, branchId?: string, except?: string) {
  if (kind === 'branch') return !!await tx.branch.findFirst({
    where: { name: { equals: value, mode: 'insensitive' }, ...(except ? { id: { not: except } } : {}) },
    select: { id: true }
  });
  return !!await tx.department.findFirst({
    where: { branchId: branchId!, name: { equals: value, mode: 'insensitive' },
      ...(except ? { id: { not: except } } : {}) }, select: { id: true }
  });
}
function knownError(res: Response, err: unknown, mapping: Record<string, [number, string]>, conflict: string) {
  const message = err instanceof Error ? err.message : '';
  const found = mapping[message];
  if (found) { fail(res, found[0], message, found[1]); return true; }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    fail(res, 409, 'ALREADY_EXISTS', conflict); return true;
  }
  return false;
}

router.use(requireAuth, requirePermission('users.manage'));

router.get('/organization', run(async (_req, res) => {
  const actor = principal(res);
  const global = central(actor.roleKey);
  const [branches, departments, users] = await Promise.all([
    db.branch.findMany({
      where: global ? {} : { id: actor.branchId },
      include: branchInclude, orderBy: { name: 'asc' }
    }),
    db.department.findMany({
      where: global ? {} : { branchId: actor.branchId },
      include: departmentInclude, orderBy: [{ branchId: 'asc' }, { name: 'asc' }]
    }),
    db.user.findMany({
      where: global ? { active: true } : { active: true, branchId: actor.branchId },
      select: { id: true, fullName: true, email: true, branchId: true },
      orderBy: { fullName: 'asc' }
    })
  ]);
  res.json({
    branches: branches.map(serializeBranch),
    departments: departments.map(serializeDepartment),
    users: users.map(user => ({
      id: user.id, name: user.fullName, email: user.email, branchId: user.branchId
    }))
  });
}));

router.post('/organization/branches', writePermission, run(async (req, res) => {
  const input = createBranchFields.safeParse(req.body);
  if (!input.success) { fail(res, 400, 'INVALID_INPUT', 'Check branch name, code, city, manager and status'); return; }
  try {
    const branch = await db.$transaction(async tx => {
      if (await nameUsed(tx, 'branch', input.data.name)) throw Error('BRANCH_EXISTS');
      if (input.data.managerId) throw Error('MANAGER_BRANCH_MISMATCH');
      const created = await tx.branch.create({ data: input.data });
      await tx.securityAuditEvent.create({ data: {
        action: 'ADMIN_BRANCH_CREATED', success: true, actorUserId: principal(res).userId,
        details: JSON.stringify({ id: created.id, code: created.code, after: input.data })
      } });
      return created;
    });
    res.status(201).json({ id: branch.id });
  } catch (err) {
    if (knownError(res, err, {
      BRANCH_EXISTS: [409, 'A branch with this name already exists'],
      MANAGER_BRANCH_MISMATCH: [400, 'Create a branch first, then assign a manager from that branch']
    }, 'Branch code already exists')) return;
    throw err;
  }
}));

router.patch('/organization/branches/:branchId', writePermission, run(async (req, res) => {
  const key = id.safeParse(req.params.branchId), input = branchFields.safeParse(req.body);
  if (!key.success || !input.success) { fail(res, 400, 'INVALID_INPUT', 'Check branch details'); return; }
  try {
    await db.$transaction(async tx => {
      const before = await tx.branch.findUnique({ where: { id: key.data } });
      if (!before) throw Error('BRANCH_NOT_FOUND');
      if (await nameUsed(tx, 'branch', input.data.name, undefined, before.id)) throw Error('BRANCH_EXISTS');
      if (!await validLeader(tx, input.data.managerId, before.id)) throw Error('INVALID_MANAGER');
      if (!input.data.active) {
        const [users, assets, departments] = await Promise.all([
          tx.user.count({ where: { branchId: before.id, active: true } }),
          tx.resource.count({ where: { branchId: before.id } }),
          tx.department.count({ where: { branchId: before.id, active: true } })
        ]);
        if (users || assets || departments) throw Error('BRANCH_IN_USE');
      }
      await tx.branch.update({ where: { id: before.id }, data: input.data });
      await tx.securityAuditEvent.create({ data: {
        action: 'ADMIN_BRANCH_UPDATED', success: true, actorUserId: principal(res).userId,
        details: JSON.stringify({
          id: before.id, code: before.code,
          before: { name: before.name, city: before.city, managerId: before.managerId, active: before.active },
          after: input.data
        })
      } });
    });
    res.json({ ok: true });
  } catch (err) {
    if (knownError(res, err, {
      BRANCH_NOT_FOUND: [404, 'Branch not found'],
      BRANCH_EXISTS: [409, 'A branch with this name already exists'],
      INVALID_MANAGER: [400, 'Manager must be an active employee of the same branch'],
      BRANCH_IN_USE: [409, 'Move or deactivate active users, departments and resources before disabling this branch']
    }, 'Duplicate branch name')) return;
    throw err;
  }
}));

router.post('/organization/departments', writePermission, run(async (req, res) => {
  const input = departmentFields.safeParse(req.body);
  if (!input.success) { fail(res, 400, 'INVALID_INPUT', 'Check department name, branch, lead and status'); return; }
  try {
    const record = await db.$transaction(async tx => {
      const branch = await tx.branch.findUnique({ where: { id: input.data.branchId } });
      if (!branch?.active) throw Error('BRANCH_UNAVAILABLE');
      if (!await validLeader(tx, input.data.leadUserId, branch.id)) throw Error('INVALID_LEAD');
      if (await nameUsed(tx, 'department', input.data.name, branch.id)) throw Error('DEPARTMENT_EXISTS');
      const created = await tx.department.create({ data: input.data });
      await tx.securityAuditEvent.create({ data: {
        action: 'ADMIN_DEPARTMENT_CREATED', success: true, actorUserId: principal(res).userId,
        details: JSON.stringify({ id: created.id, after: input.data })
      } });
      return created;
    });
    res.status(201).json({ id: record.id });
  } catch (err) {
    if (knownError(res, err, {
      BRANCH_UNAVAILABLE: [400, 'Choose an active branch'],
      INVALID_LEAD: [400, 'The lead must be an active employee of the selected branch'],
      DEPARTMENT_EXISTS: [409, 'A department with this name already exists in this branch']
    }, 'Duplicate department name')) return;
    throw err;
  }
}));

router.patch('/organization/departments/:departmentId', writePermission, run(async (req, res) => {
  const key = id.safeParse(req.params.departmentId), input = departmentFields.safeParse(req.body);
  if (!key.success || !input.success) { fail(res, 400, 'INVALID_INPUT', 'Check department details'); return; }
  try {
    await db.$transaction(async tx => {
      const before = await tx.department.findUnique({
        where: { id: key.data }, include: { _count: { select: { users: true } } }
      });
      if (!before) throw Error('DEPARTMENT_NOT_FOUND');
      const branch = await tx.branch.findUnique({ where: { id: input.data.branchId } });
      if (!branch || input.data.active && !branch.active) throw Error('BRANCH_UNAVAILABLE');
      if (before.branchId !== branch.id && before._count.users) throw Error('DEPARTMENT_IN_USE');
      if (!await validLeader(tx, input.data.leadUserId, branch.id)) throw Error('INVALID_LEAD');
      if (await nameUsed(tx, 'department', input.data.name, branch.id, before.id)) throw Error('DEPARTMENT_EXISTS');
      await tx.department.update({ where: { id: before.id }, data: input.data });
      await tx.securityAuditEvent.create({ data: {
        action: 'ADMIN_DEPARTMENT_UPDATED', success: true, actorUserId: principal(res).userId,
        details: JSON.stringify({
          id: before.id,
          before: { name: before.name, branchId: before.branchId, leadUserId: before.leadUserId, active: before.active },
          after: input.data
        })
      } });
    });
    res.json({ ok: true });
  } catch (err) {
    if (knownError(res, err, {
      DEPARTMENT_NOT_FOUND: [404, 'Department not found'],
      BRANCH_UNAVAILABLE: [400, 'Active departments require an active branch'],
      DEPARTMENT_IN_USE: [409, 'Move department members before changing its branch'],
      INVALID_LEAD: [400, 'The lead must be an active employee of the selected branch'],
      DEPARTMENT_EXISTS: [409, 'A department with this name already exists in this branch']
    }, 'Duplicate department name')) return;
    throw err;
  }
}));

export default router;
