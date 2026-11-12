import { Router, type Request, type Response, type NextFunction } from 'express';
import { db } from '../db.js';
import { principal, requireAuth, requirePermission } from '../security/auth.js';

const router = Router();
const asyncRoute = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { void fn(req, res).catch(next); };

// First foundation increment: read-only, permission-scoped directory.
// Mutating Administration workflows follow in the next reviewed feature branch.
router.get('/users', requireAuth, requirePermission('users.manage'), asyncRoute(async (_req, res) => {
  const auth = principal(res);
  const global = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(auth.roleKey);
  const rows = await db.user.findMany({
    where: global ? {} : { branchId: auth.branchId },
    include: { role: true, branch: true, department: true },
    orderBy: { fullName: 'asc' }
  });
  res.json({ users: rows.map(user => ({
    id: user.id, email: user.email, fullName: user.fullName, active: user.active,
    role: { id: user.role.id, key: user.role.key, name: user.role.name },
    branch: { id: user.branch.id, name: user.branch.name },
    department: user.department ? { id: user.department.id, name: user.department.name } : null
  })) });
}));

router.get('/roles', requireAuth, requirePermission('roles.manage'), asyncRoute(async (_req, res) => {
  const roles = await db.role.findMany({
    include: { grants: { include: { permission: true } }, _count: { select: { users: true } } },
    orderBy: { name: 'asc' }
  });
  res.json({ roles: roles.map(r => ({
    id: r.id, key: r.key, name: r.name, description: r.description,
    protected: r.protected, active: r.active, userCount: r._count.users,
    permissions: r.grants.map(g => g.permission.key)
  })) });
}));

router.get('/branches', requireAuth, requirePermission('users.manage'), asyncRoute(async (_req, res) => {
  const auth = principal(res);
  const global = ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(auth.roleKey);
  const branches = await db.branch.findMany({
    where: global ? {} : { id: auth.branchId },
    include: { _count: { select: { users: true, resources: true } } },
    orderBy: { name: 'asc' }
  });
  res.json({ branches: branches.map(b => ({
    id: b.id, name: b.name, code: b.code, active: b.active,
    users: b._count.users, resources: b._count.resources
  })) });
}));

export default router;
