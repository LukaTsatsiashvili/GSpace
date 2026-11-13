import { Prisma, ApprovalRequestStatus, ApprovalReviewStatus } from '@prisma/client';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { canAccessBranch } from '../security/access-policy.js';
import { principal, requireAuth, type AuthPrincipal } from '../security/auth.js';

const router = Router();
const run = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };
const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });
const uuid = z.string().uuid();
const field = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().trim().min(2).max(100),
  type: z.enum(['text', 'number', 'date', 'select', 'multi_select']),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(100)).min(1).max(40).optional()
}).strict().superRefine((value, ctx) => {
  if ((value.type === 'select' || value.type === 'multi_select') !== !!value.options) {
    ctx.addIssue({ code: 'custom', message: 'Only selection fields require options' });
  }
  if (value.options && new Set(value.options.map(x => x.toLowerCase())).size !== value.options.length) {
    ctx.addIssue({ code: 'custom', message: 'Selection options must be unique' });
  }
});
const target = z.object({ kind: z.enum(['USER', 'ROLE']), id: uuid }).strict();
const step = z.object({
  mode: z.enum(['ANY', 'ALL']),
  targets: z.array(target).min(1).max(12)
}).strict();
const configuration = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,31}$/),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).default(''),
  active: z.boolean().default(true),
  deadlineDays: z.number().int().min(1).max(90).default(3),
  fields: z.array(field).max(20),
  steps: z.array(step).min(1).max(10)
}).strict().superRefine((data, ctx) => {
  if (new Set(data.fields.map(x => x.key)).size !== data.fields.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate field key' });
  for (const s of data.steps) if (new Set(s.targets.map(t => t.kind + ':' + t.id)).size !== s.targets.length)
    ctx.addIssue({ code: 'custom', message: 'Duplicate approver target' });
});
const dynamicValues = z.record(z.union([z.string().max(2000), z.array(z.string().max(100)).max(40)]))
  .refine(value => Object.keys(value).length <= 20);
const submit = z.object({
  typeId: uuid,
  branchId: uuid,
  title: z.string().trim().min(3).max(180),
  reason: z.string().trim().min(3).max(3000),
  amount: z.number().finite().min(0).max(999999999).nullable().default(null),
  values: dynamicValues.default({})
}).strict();
const resubmit = z.object({ reason: z.string().trim().min(3).max(3000), values: dynamicValues }).strict();
const decide = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'CHANGES_REQUESTED']),
  comment: z.string().trim().max(2000).default('')
}).strict().refine(x => x.decision === 'APPROVED' || x.comment.length > 0,
  'A reason is required for rejection or changes requested');
const exportInput = z.object({ requestIds: z.array(uuid).min(1).max(200) }).strict();
type Field = z.infer<typeof field>;
type Step = z.infer<typeof step>;
type Actor = AuthPrincipal;
const central = (actor: Actor) => ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(actor.roleKey);
const canConfigure = (actor: Actor) => central(actor) && actor.permissions.includes('approvals.configure');
const canUse = (actor: Actor) =>
  ['approvals.request', 'approvals.review', 'approvals.configure', 'audit.view'].some(p => actor.permissions.includes(p));
const scoped = (actor: Actor, branchId: string) => canAccessBranch(actor.roleKey, actor.branchId, branchId);
function error(res: Response, e: unknown) {
  if (e instanceof Error && [
    'WORKFLOW_INVALID', 'INVALID_FIELDS', 'INVALID_APPROVERS', 'BRANCH_INACTIVE',
    'TYPE_INACTIVE', 'INVALID_ROLE', 'INVALID_STATE', 'REVIEW_NOT_ASSIGNED'
  ].includes(e.message)) {
    const status = ['INVALID_STATE'].includes(e.message) ? 409 :
      e.message === 'REVIEW_NOT_ASSIGNED' ? 403 : 400;
    fail(res, status, e.message, e.message.replace(/_/g, ' ').toLowerCase());
    return true;
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2034', 'P2002', 'P2003'].includes(e.code)) {
    fail(res, 409, 'CONFLICT', 'The request or configuration changed. Refresh and retry.');
    return true;
  }
  return false;
}
async function serializable<T>(job: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await db.$transaction(job, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2034' && attempt < 2) continue;
      throw e;
    }
  }
  throw Error('INVALID_STATE');
}
function configFields(json: Prisma.JsonValue): Field[] { return z.array(field).parse(json); }
function configSteps(json: Prisma.JsonValue): Step[] { return z.array(step).parse(json); }
function validateValues(fields: Field[], values: Record<string, string | string[]>) {
  const keys = new Set(fields.map(f => f.key));
  if (Object.keys(values).some(key => !keys.has(key))) throw Error('INVALID_FIELDS');
  for (const f of fields) {
    const value = values[f.key];
    const empty = value === undefined || value === '' || (Array.isArray(value) && !value.length);
    if (f.required && empty) throw Error('INVALID_FIELDS');
    if (empty) continue;
    if (f.type === 'multi_select') {
      if (!Array.isArray(value) || new Set(value).size !== value.length || value.some(v => !f.options?.includes(v))) throw Error('INVALID_FIELDS');
    } else {
      if (typeof value !== 'string') throw Error('INVALID_FIELDS');
      if (f.type === 'select' && !f.options?.includes(value)) throw Error('INVALID_FIELDS');
      if (f.type === 'number' && (!value.trim() || !Number.isFinite(Number(value)))) throw Error('INVALID_FIELDS');
      if (f.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw Error('INVALID_FIELDS');
    }
  }
}
async function validateTargets(tx: Prisma.TransactionClient, steps: Step[]) {
  const userIds = [...new Set(steps.flatMap(s => s.targets.filter(t => t.kind === 'USER').map(t => t.id)))];
  const roleIds = [...new Set(steps.flatMap(s => s.targets.filter(t => t.kind === 'ROLE').map(t => t.id)))];
  if (userIds.length && await tx.user.count({ where: { id: { in: userIds }, active: true } }) !== userIds.length)
    throw Error('INVALID_APPROVERS');
  if (roleIds.length && await tx.role.count({ where: { id: { in: roleIds }, active: true } }) !== roleIds.length)
    throw Error('INVALID_ROLE');
}
async function reviewerIds(tx: Prisma.TransactionClient, steps: Step[], branchId: string, requesterId: string) {
  const reviewers = await tx.user.findMany({
    where: { branchId, active: true, branch: { active: true }, role: { active: true, grants: { some: { permission: { key: 'approvals.review' } } } } },
    select: { id: true, roleId: true }
  });
  return steps.map(s => {
    const ids = [...new Set(reviewers.filter(u => u.id !== requesterId && s.targets.some(t =>
      t.kind === 'USER' ? t.id === u.id : t.id === u.roleId)).map(u => u.id))];
    if (ids.length === 0 || ids.length > 50) throw Error('INVALID_APPROVERS');
    return ids;
  });
}
const include = {
  type: { select: { id: true, name: true, code: true } },
  version: { select: { version: true, fields: true, steps: true, deadlineDays: true } },
  branch: { select: { id: true, name: true } },
  requester: { select: { id: true, fullName: true } },
  reviews: { include: { reviewer: { select: { id: true, fullName: true } } }, orderBy: [{ step: 'asc' }, { reviewer: { fullName: 'asc' } }] },
  events: { orderBy: { createdAt: 'desc' }, take: 200 }
} satisfies Prisma.ApprovalRequestInclude;
type ApprovalRow = Prisma.ApprovalRequestGetPayload<{ include: typeof include }>;
function visible(actor: Actor, row: ApprovalRow) {
  return row.requesterId === actor.userId || row.reviews.some(r => r.reviewerId === actor.userId) ||
    (scoped(actor, row.branchId) && (canConfigure(actor) || actor.permissions.includes('audit.view')));
}
function toJson(row: ApprovalRow, actor: Actor) {
  const steps = configSteps(row.version.steps);
  return {
    id: row.id, code: row.code, title: row.title, reason: row.reason,
    amount: row.amount?.toString() ?? null, status: row.status, currentStep: row.currentStep,
    totalSteps: steps.length, steps, values: row.values, fields: row.version.fields,
    typeId: row.typeId, type: row.type.name, typeCode: row.type.code,
    version: row.version.version, requesterId: row.requesterId, requester: row.requester.fullName,
    branchId: row.branchId, branch: row.branch.name, dueAt: row.dueAt, createdAt: row.createdAt,
    completedAt: row.completedAt, canCancel: row.requesterId === actor.userId && ['PENDING','CHANGES_REQUESTED'].includes(row.status),
    canResubmit: row.requesterId === actor.userId && row.status === 'CHANGES_REQUESTED',
    canReview: actor.permissions.includes('approvals.review') && row.status === 'PENDING' &&
      row.requesterId !== actor.userId && row.reviews.some(r => r.reviewerId === actor.userId &&
        r.step === row.currentStep && r.status === 'PENDING'),
    reviews: row.reviews.map(r => ({ id: r.id, step: r.step, reviewerId: r.reviewerId,
      reviewer: r.reviewer.fullName, status: r.status, comment: r.comment, decidedAt: r.decidedAt })),
    events: row.events.map(e => ({ id: e.id, action: e.action, actor: e.actorName,
      comment: e.comment, at: e.createdAt, details: e.details }))
  };
}
async function audit(tx: Prisma.TransactionClient, actor: Actor, action: string,
  requestId: string | null, comment = '', details: Prisma.InputJsonValue = {}) {
  if (requestId) await tx.approvalEvent.create({ data: {
    requestId, actorId: actor.userId, actorName: actor.fullName, action, comment, details
  } });
  await tx.securityAuditEvent.create({ data: {
    action: 'APPROVAL_' + action, success: true, actorUserId: actor.userId,
    details: JSON.stringify({ requestId, comment, details })
  } });
}
const requestScope = (actor: Actor): Prisma.ApprovalRequestWhereInput => ({
  OR: [
    { requesterId: actor.userId },
    { reviews: { some: { reviewerId: actor.userId } } },
    ...((canConfigure(actor) || actor.permissions.includes('audit.view'))
      ? [{ ...(central(actor) ? {} : { branchId: actor.branchId }) }] : [])
  ]
});
function csv(value: unknown) {
  const raw = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  const safe = /^[\s]*[=+\-@\t]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

router.use(requireAuth);
router.get('/lookups', run(async (_req, res) => {
  const actor = principal(res);
  if (!canUse(actor)) { fail(res, 403, 'FORBIDDEN', 'Approvals access required'); return; }
  const [branches, users, roles] = await Promise.all([
    db.branch.findMany({ where: { active: true, ...(central(actor) ? {} : { id: actor.branchId }) }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.user.findMany({ where: { active: true, branchId: actor.branchId, role: { active: true, grants: { some: { permission: { key: 'approvals.review' } } } } },
      select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
    db.role.findMany({ where: { active: true, grants: { some: { permission: { key: 'approvals.review' } } } }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
  ]);
  res.json({ branches, users, roles, canConfigure: canConfigure(actor), canExport: actor.permissions.includes('reports.export') });
}));
router.get('/types', run(async (_req, res) => {
  const actor = principal(res);
  if (!canUse(actor)) { fail(res, 403, 'FORBIDDEN', 'Approvals access required'); return; }
  const types = await db.approvalType.findMany({
    where: canConfigure(actor) ? {} : { active: true },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    orderBy: { name: 'asc' }
  });
  res.json({ types: types.map(t => ({ id: t.id, code: t.code, name: t.name,
    description: t.description, active: t.active, version: t.currentVersion,
    fields: t.versions[0]?.fields ?? [], steps: t.versions[0]?.steps ?? [],
    deadlineDays: t.versions[0]?.deadlineDays ?? 3 })) });
}));
router.post('/types', run(async (req, res) => {
  const actor = principal(res);
  if (!canConfigure(actor)) { fail(res, 403, 'FORBIDDEN', 'Only central administrators can configure request types'); return; }
  const data = configuration.parse(req.body);
  try {
    const result = await serializable(async tx => {
      await validateTargets(tx, data.steps);
      const item = await tx.approvalType.create({ data: {
        code: data.code, name: data.name, description: data.description, active: data.active,
        versions: { create: { version: 1, fields: data.fields as Prisma.InputJsonValue,
          steps: data.steps as Prisma.InputJsonValue, deadlineDays: data.deadlineDays } }
      } });
      await audit(tx, actor, 'TYPE_CREATED', null, '', { typeId: item.id, code: item.code, version: 1 });
      return item;
    });
    res.status(201).json({ id: result.id });
  } catch (e) { if (!error(res, e)) throw e; }
}));
router.put('/types/:id', run(async (req, res) => {
  const actor = principal(res);
  if (!canConfigure(actor)) { fail(res, 403, 'FORBIDDEN', 'Only central administrators can configure request types'); return; }
  const typeId = uuid.parse(req.params.id);
  const data = configuration.parse(req.body);
  try {
    await serializable(async tx => {
      const old = await tx.approvalType.findUnique({ where: { id: typeId } });
      if (!old) throw Error('INVALID_STATE');
      if (old.code !== data.code) throw Error('INVALID_STATE'); // immutable code
      await validateTargets(tx, data.steps);
      const version = old.currentVersion + 1;
      const changed = await tx.approvalType.updateMany({ where: { id: typeId, currentVersion: old.currentVersion },
        data: { name: data.name, description: data.description, active: data.active, currentVersion: version } });
      if (!changed.count) throw Error('INVALID_STATE');
      await tx.approvalTypeVersion.create({ data: {
        typeId, version, fields: data.fields as Prisma.InputJsonValue, steps: data.steps as Prisma.InputJsonValue,
        deadlineDays: data.deadlineDays
      } });
      await audit(tx, actor, 'TYPE_VERSION_CREATED', null, '', { typeId, version });
    });
    res.json({ ok: true });
  } catch (e) { if (!error(res, e)) throw e; }
}));
router.get('/', run(async (_req, res) => {
  const actor = principal(res);
  if (!canUse(actor)) { fail(res, 403, 'FORBIDDEN', 'Approvals access required'); return; }
  const where = requestScope(actor);
  const [rows, total] = await Promise.all([
    db.approvalRequest.findMany({ where, include, orderBy: { createdAt: 'desc' }, take: 200 }),
    db.approvalRequest.count({ where })
  ]);
  res.json({ requests: rows.map(row => toJson(row, actor)), total, limited: total > rows.length });
}));
router.post('/', run(async (req, res) => {
  const actor = principal(res);
  if (!actor.permissions.includes('approvals.request')) { fail(res, 403, 'FORBIDDEN', 'Request permission required'); return; }
  const data = submit.parse(req.body);
  if (!scoped(actor, data.branchId)) { fail(res, 403, 'FORBIDDEN', 'Branch not accessible'); return; }
  try {
    const code = await serializable(async tx => {
      const [branch, type] = await Promise.all([
        tx.branch.findUnique({ where: { id: data.branchId } }),
        tx.approvalType.findUnique({ where: { id: data.typeId },
          include: { versions: { orderBy: { version: 'desc' }, take: 1 } } })
      ]);
      if (!branch?.active) throw Error('BRANCH_INACTIVE');
      if (!type?.active || !type.versions.length) throw Error('TYPE_INACTIVE');
      const version = type.versions[0];
      const steps = configSteps(version.steps);
      validateValues(configFields(version.fields), data.values);
      const ids = await reviewerIds(tx, steps, data.branchId, actor.userId);
      const counter = await tx.approvalCounter.upsert({
        where: { name: 'request' }, create: { name: 'request', nextNumber: 2 },
        update: { nextNumber: { increment: 1 } }
      });
      const code = 'REQ-' + String(counter.nextNumber - 1).padStart(5, '0');
      const created = await tx.approvalRequest.create({ data: {
        code, typeId: type.id, versionId: version.id, requesterId: actor.userId,
        branchId: data.branchId, title: data.title, reason: data.reason,
        amount: data.amount === null ? null : new Prisma.Decimal(data.amount.toFixed(2)),
        values: data.values as Prisma.InputJsonValue,
        dueAt: new Date(Date.now() + version.deadlineDays * 86_400_000),
        reviews: { create: ids.flatMap((userIds, index) => userIds.map(reviewerId => ({ step: index, reviewerId }))) }
      } });
      await audit(tx, actor, 'SUBMITTED', created.id, '', { typeId: type.id, version: version.version });
      return code;
    });
    res.status(201).json({ code });
  } catch (e) { if (!error(res, e)) throw e; }
}));
router.get('/:id', run(async (req, res) => {
  const actor = principal(res);
  const id = uuid.parse(req.params.id);
  const row = await db.approvalRequest.findUnique({ where: { id }, include });
  if (!row || !visible(actor, row)) { fail(res, 404, 'NOT_FOUND', 'Request not found'); return; }
  res.json({ request: toJson(row, actor) });
}));
router.post('/:id/decision', run(async (req, res) => {
  const actor = principal(res);
  if (!actor.permissions.includes('approvals.review')) { fail(res, 403, 'FORBIDDEN', 'Approver permission required'); return; }
  const id = uuid.parse(req.params.id);
  const data = decide.parse(req.body);
  try {
    await serializable(async tx => {
      const row = await tx.approvalRequest.findUnique({ where: { id },
        include: { reviews: true, version: true } });
      if (!row || row.requesterId === actor.userId) throw Error('REVIEW_NOT_ASSIGNED');
      if (row.status !== 'PENDING') throw Error('INVALID_STATE');
      const reviewer = row.reviews.find(r => r.step === row.currentStep && r.reviewerId === actor.userId && r.status === 'PENDING');
      if (!reviewer) throw Error('REVIEW_NOT_ASSIGNED');
      const updated = await tx.approvalReview.updateMany({ where: { id: reviewer.id, status: 'PENDING' },
        data: { status: data.decision, comment: data.comment, decidedAt: new Date() } });
      if (!updated.count) throw Error('INVALID_STATE');
      const active = row.reviews.filter(r => r.step === row.currentStep);
      const step = configSteps(row.version.steps)[row.currentStep];
      if (!step) throw Error('WORKFLOW_INVALID');
      const advance = data.decision === 'APPROVED' &&
        (step.mode === 'ANY' || active.every(r => r.id === reviewer.id || r.status === 'APPROVED'));
      const finish = advance && row.currentStep + 1 >= configSteps(row.version.steps).length;
      const newStatus: ApprovalRequestStatus = data.decision === 'REJECTED' ? 'REJECTED' :
        data.decision === 'CHANGES_REQUESTED' ? 'CHANGES_REQUESTED' :
        finish ? 'APPROVED' : 'PENDING';
      if (data.decision !== 'APPROVED' || (advance && step.mode === 'ANY')) {
        await tx.approvalReview.updateMany({ where: {
          requestId: id, step: row.currentStep, status: 'PENDING', id: { not: reviewer.id }
        }, data: { status: 'SKIPPED' } });
      }
      const changed = await tx.approvalRequest.updateMany({ where: { id, status: 'PENDING', currentStep: row.currentStep },
        data: {
          status: newStatus, currentStep: advance ? row.currentStep + 1 : row.currentStep,
          completedAt: ['APPROVED', 'REJECTED'].includes(newStatus) ? new Date() : null
        } });
      if (!changed.count) throw Error('INVALID_STATE');
      await audit(tx, actor, 'REVIEW_' + data.decision, id, data.comment,
        { step: row.currentStep, advanced: advance, completed: finish });
    });
    res.json({ ok: true });
  } catch (e) { if (!error(res, e)) throw e; }
}));
router.post('/:id/resubmit', run(async (req, res) => {
  const actor = principal(res);
  const id = uuid.parse(req.params.id);
  const data = resubmit.parse(req.body);
  try {
    await serializable(async tx => {
      const row = await tx.approvalRequest.findUnique({ where: { id }, include: { version: true } });
      if (!row || row.requesterId !== actor.userId) throw Error('REVIEW_NOT_ASSIGNED');
      if (row.status !== 'CHANGES_REQUESTED') throw Error('INVALID_STATE');
      validateValues(configFields(row.version.fields), data.values);
      const updated = await tx.approvalRequest.updateMany({
        where: { id, status: 'CHANGES_REQUESTED' },
        data: { status: 'PENDING', currentStep: 0, values: data.values as Prisma.InputJsonValue,
          reason: data.reason, completedAt: null, dueAt: new Date(Date.now() + row.version.deadlineDays * 86_400_000) }
      });
      if (!updated.count) throw Error('INVALID_STATE');
      await tx.approvalReview.updateMany({ where: { requestId: id }, data: {
        status: 'PENDING', decidedAt: null, comment: ''
      } });
      await audit(tx, actor, 'RESUBMITTED', id, '', { retainedVersion: row.version.version });
    });
    res.json({ ok: true });
  } catch (e) { if (!error(res, e)) throw e; }
}));
router.post('/:id/cancel', run(async (req, res) => {
  const actor = principal(res);
  const id = uuid.parse(req.params.id);
  try {
    await serializable(async tx => {
      const row = await tx.approvalRequest.findUnique({ where: { id }, select: { status: true, requesterId: true } });
      if (!row || row.requesterId !== actor.userId) throw Error('REVIEW_NOT_ASSIGNED');
      if (!['PENDING', 'CHANGES_REQUESTED'].includes(row.status)) throw Error('INVALID_STATE');
      const updated = await tx.approvalRequest.updateMany({ where: { id, status: row.status },
        data: { status: 'CANCELLED', completedAt: new Date() } });
      if (!updated.count) throw Error('INVALID_STATE');
      await tx.approvalReview.updateMany({ where: { requestId: id, status: 'PENDING' }, data: { status: 'SKIPPED' } });
      await audit(tx, actor, 'CANCELLED', id);
    });
    res.json({ ok: true });
  } catch (e) { if (!error(res, e)) throw e; }
}));
router.post('/export/csv', run(async (req, res) => {
  const actor = principal(res);
  if (!actor.permissions.includes('reports.export')) { fail(res, 403, 'FORBIDDEN', 'Export permission required'); return; }
  const ids = exportInput.parse(req.body).requestIds;
  if (new Set(ids).size !== ids.length) { fail(res, 400, 'INVALID_SELECTION', 'Duplicate request'); return; }
  const rows = await db.approvalRequest.findMany({ where: { id: { in: ids }, AND: [requestScope(actor)] },
    include, orderBy: { createdAt: 'desc' } });
  if (rows.length !== ids.length) { fail(res, 403, 'FORBIDDEN', 'One or more requests are not accessible'); return; }
  const header = ['Request ID','Title','Type','Version','Requester','Branch','Status','Step','Created UTC','Due UTC'];
  const output = [header.map(csv).join(','),
    ...rows.map(r => [r.code,r.title,r.type.name,r.version.version,r.requester.fullName,r.branch.name,
      r.status,r.currentStep+1,r.createdAt.toISOString(),r.dueAt?.toISOString() ?? ''].map(csv).join(','))].join('\r\n');
  await db.securityAuditEvent.create({ data: { action: 'APPROVAL_REQUESTS_EXPORTED', success: true,
    actorUserId: actor.userId, details: JSON.stringify({ count: ids.length }) } });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="approval-requests.csv"');
  res.send('\uFEFF' + output);
}));

export default router;
