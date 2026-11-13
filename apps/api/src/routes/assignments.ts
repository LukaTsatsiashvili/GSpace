import { AssignmentItemStatus, AssignmentKind, Prisma, ResourceStatus } from '@prisma/client';
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
const id = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null);
const condition = z.enum(['Excellent', 'Good', 'Fair', 'Damaged', 'Poor']);
const notes = z.string().trim().max(2000).default('');
const assignmentInput = z.object({
  recipientId: id, resourceIds: z.array(id).min(1).max(25),
  dueAt: date, notes
}).strict();
const evidenceInput = z.object({
  filename: z.string().min(1).max(180),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  base64: z.string().min(1).max(2_900_000)
}).strict();
const receiptInput = z.object({ decisions: z.array(z.object({
  itemId: id, decision: z.enum(['ACCEPT', 'REPORT_ISSUE']),
  notes: z.string().trim().max(1000).default(''), damageReported: z.boolean().default(false), evidence: evidenceInput.optional()
}).strict()).min(1).max(25) }).strict();
const itemIdsInput = z.object({ itemIds: z.array(id).min(1).max(25) }).strict();
const verifyInput = z.object({ items: z.array(z.object({
  itemId: id, condition
}).strict()).min(1).max(25) }).strict();
const transferInput = itemIdsInput.extend({ recipientId: id, notes, dueAt: date });

type Actor = AuthPrincipal;
const isCentral = (actor: Actor) => actor.roleKey === 'SYSTEM_ADMIN' || actor.roleKey === 'COMPANY_ADMIN';
const manages = (actor: Actor, branchId: string) =>
  actor.permissions.includes('assignments.manage') && canAccessBranch(actor.roleKey, actor.branchId, branchId);
const canSee = (actor: Actor, assignment: { branchId: string; recipientId: string }) =>
  manages(actor, assignment.branchId) || actor.userId === assignment.recipientId;
const writableError: Record<string, [number, string]> = {
  FORBIDDEN: [403, 'You are not authorized for this assignment'],
  NOT_FOUND: [404, 'Assignment was not found'],
  INVALID_RECIPIENT: [400, 'Choose an active recipient in the resource branch'],
  INVALID_ASSETS: [400, 'Choose resources from one accessible branch'],
  NOT_AVAILABLE: [409, 'One or more selected resources are no longer available'],
  INVALID_ITEM: [409, 'An assignment item has changed; reload and retry'],
  EVIDENCE_REQUIRED: [400, 'Photo evidence is required for damaged items'],
  INVALID_EVIDENCE: [400, 'Photo must be a valid JPEG, PNG or WebP up to 2 MB'],
  INVALID_DATE: [400, 'Return due date is not valid'],
  INACTIVE_BRANCH: [400, 'The resource branch is inactive'],
  ALREADY_ISSUED: [409, 'This resource already has an open handover'],
  SAME_RECIPIENT: [400, 'Select a different recipient for transfer']
};
function handleError(error: unknown, res: Response) {
  if (error instanceof Error && writableError[error.message]) {
    const [status, message] = writableError[error.message];
    fail(res, status, error.message, message);
    return true;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2034' || error.code === 'P2002' || error.code === 'P2003')) {
    fail(res, 409, 'CONCURRENT_UPDATE', 'The resource or handover changed; reload and retry');
    return true;
  }
  return false;
}
function asDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw Error('INVALID_DATE');
  return parsed;
}
function unique(values: string[]) { return new Set(values).size === values.length; }
async function serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
  throw Error('INVALID_ITEM');
}
async function nextCode(tx: Prisma.TransactionClient) {
  const counter = await tx.assignmentCounter.upsert({
    where: { name: 'assignment' },
    create: { name: 'assignment', nextNumber: 2 },
    update: { nextNumber: { increment: 1 } }
  });
  return 'ASG-' + String(counter.nextNumber - 1).padStart(5, '0');
}
const include = {
  branch: { select: { id: true, name: true } },
  recipient: { select: { id: true, fullName: true } },
  issuedBy: { select: { id: true, fullName: true } },
  items: { include: {
    resource: { select: { id: true, assetCode: true, name: true, branchId: true, condition: true } },
    evidence: { select: { id: true, filename: true, mimeType: true, byteSize: true } }
  }, orderBy: { createdAt: 'asc' } },
  events: { orderBy: { createdAt: 'desc' }, take: 100 }
} satisfies Prisma.AssignmentInclude;
type Row = Prisma.AssignmentGetPayload<{ include: typeof include }>;
function state(items: Row['items']): string {
  const statuses = items.map(x => x.status);
  if (statuses.every(s => s === 'CANCELLED')) return 'Cancelled';
  if (statuses.every(s => ['RETURNED', 'TRANSFERRED', 'CANCELLED'].includes(s))) return 'Completed';
  if (statuses.some(s => s === 'RETURN_REQUESTED')) return 'Return requested';
  if (statuses.some(s => s === 'ISSUE_REPORTED')) return 'Issue reported';
  if (statuses.some(s => s === 'TRANSFER_PENDING')) return 'Transfer pending';
  if (statuses.some(s => s === 'PENDING')) return statuses.some(s => s === 'ACCEPTED') ? 'Partially accepted' : 'Pending confirmation';
  return 'Active';
}
function serialize(row: Row) {
  return {
    id: row.id, code: row.code, kind: row.kind,
    branchId: row.branchId, branch: row.branch.name,
    recipientId: row.recipientId, employee: row.recipient.fullName,
    issuedBy: row.issuedBy.fullName, issued: row.createdAt, returnDue: row.dueAt,
    status: state(row.items), notes: row.notes,
    assets: row.items.map(item => ({
      itemId: item.id, resourceId: item.resourceId,
      id: item.resource.assetCode, name: item.resource.name, condition: item.conditionOnIssue,
      receipt: item.status, sourceItemId: item.sourceItemId,
      evidence: item.evidence && { filename: item.evidence.filename, mimeType: item.evidence.mimeType, byteSize: item.evidence.byteSize },
      receiptNotes: item.receiptNotes, acceptedAt: item.acceptedAt, returnedAt: item.returnedAt,
      returnCondition: item.returnCondition
    })),
    activity: row.events.map(event => ({
      id: event.id, title: event.action.replace(/_/g, ' '),
      detail: event.actorName + ' · ' + event.createdAt.toISOString(),
      details: event.details
    }))
  };
}
async function event(tx: Prisma.TransactionClient, assignmentId: string, actor: Actor,
  action: string, itemId: string | null = null, details: Prisma.InputJsonValue = {}) {
  await tx.assignmentEvent.create({ data: {
    assignmentId, action, actorId: actor.userId, actorName: actor.fullName,
    itemId, details
  } });
  await tx.securityAuditEvent.create({ data: {
    action: 'ASSIGNMENT_' + action, success: true, actorUserId: actor.userId,
    details: JSON.stringify({ assignmentId, itemId, details })
  } });
}
async function resourceEvent(tx: Prisma.TransactionClient, resource: {
  id: string; assetCode: string; name: string; category: string; branchId: string;
  condition: string; status: ResourceStatus; location: string
}, actor: Actor, action: string, nextStatus: ResourceStatus, nextCondition = resource.condition) {
  await tx.resourceAuditEvent.create({ data: {
    resourceId: resource.id, assetCode: resource.assetCode, action,
    actorId: actor.userId, actorName: actor.fullName,
    before: { status: resource.status, condition: resource.condition },
    after: { status: nextStatus, condition: nextCondition }
  } });
}
function evidenceFile(file?: z.infer<typeof evidenceInput>) {
  if (!file) return null;
  if (!/^[^\\/\x00-\x1f]+\.(?:jpe?g|png|webp)$/i.test(file.filename) ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64))
    throw Error('INVALID_EVIDENCE');
  const data = Buffer.from(file.base64, 'base64');
  if (!data.length || data.length > 2 * 1024 * 1024) throw Error('INVALID_EVIDENCE');
  const valid = file.mimeType === 'image/png' ?
    data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) :
    file.mimeType === 'image/jpeg' ? data.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) :
    data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!valid) throw Error('INVALID_EVIDENCE');
  return { filename: file.filename, mimeType: file.mimeType, byteSize: data.length, content: Uint8Array.from(data) };
}
function invalidPayload<T>(res: Response, result: z.SafeParseReturnType<unknown, T>): result is z.SafeParseError<unknown> {
  if (!result.success) {
    fail(res, 400, 'INVALID_INPUT', 'Check the selected resources, recipient and input values');
    return true;
  }
  return false;
}
async function load(tx: Prisma.TransactionClient, assignmentId: string) {
  const row = await tx.assignment.findUnique({ where: { id: assignmentId }, include: { items: {
    include: { resource: true, sourceItem: true }
  } } });
  if (!row) throw Error('NOT_FOUND');
  return row;
}

router.use(requireAuth);

// Live lookup data scoped to the actor, never mock resources or inactive users.
router.get('/lookups', run(async (_req, res) => {
  const actor = principal(res);
  const authorized = actor.permissions.includes('assignments.manage');
  const where = isCentral(actor) ? {} : { branchId: actor.branchId };
  const [people, resources, branches] = authorized ? await Promise.all([
    db.user.findMany({ where: { ...where, active: true }, select: { id: true, fullName: true, branchId: true },
      orderBy: { fullName: 'asc' } }),
    db.resource.findMany({ where: { ...where, status: 'AVAILABLE', branch: { active: true } },
      select: { id: true, assetCode: true, name: true, condition: true, branchId: true },
      orderBy: { assetCode: 'asc' }, take: 500 }),
    db.branch.findMany({ where: { ...where, active: true }, select: { id: true, name: true } })
  ]) : [[], [], []];
  res.json({ recipients: people, availableAssets: resources, branches, canManage: authorized });
}));

router.get('/', run(async (_req, res) => {
  const actor = principal(res);
  const where: Prisma.AssignmentWhereInput = actor.permissions.includes('assignments.manage') ?
    isCentral(actor) ? {} : { OR: [{ branchId: actor.branchId }, { recipientId: actor.userId }] } :
    { recipientId: actor.userId };
  const rows = await db.assignment.findMany({ where, include, orderBy: { createdAt: 'desc' }, take: 200 });
  const total = await db.assignment.count({ where });
  const all = rows.map(serialize);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    assignments: all, truncated: total > rows.length,
    summary: {
      active: all.filter(x => x.status === 'Active' || x.status === 'Partially accepted').length,
      pending: all.filter(x => x.status === 'Pending confirmation').length,
      returns: all.filter(x => x.status === 'Return requested').length,
      completed: all.filter(x => x.status === 'Completed').length
    }
  });
}));

router.get('/:assignmentId', run(async (req, res) => {
  const actor = principal(res);
  const row = await db.assignment.findUnique({ where: { id: req.params.assignmentId }, include });
  if (!row || !canSee(actor, row)) { fail(res, 404, 'NOT_FOUND', 'Assignment not found'); return; }
  res.json({ assignment: serialize(row) });
}));

router.post('/', run(async (req, res) => {
  const parsed = assignmentInput.safeParse(req.body);
  if (invalidPayload(res, parsed)) return;
  const actor = principal(res);
  const input = parsed.data;
  if (!actor.permissions.includes('assignments.manage')) { fail(res, 403, 'FORBIDDEN', 'Assignment management permission is required'); return; }
  if (!unique(input.resourceIds)) { fail(res, 400, 'INVALID_INPUT', 'Do not select the same resource twice'); return; }
  try {
    const dueAt = asDate(input.dueAt);
    const created = await serializable(async tx => {
      const assets = await tx.resource.findMany({ where: { id: { in: input.resourceIds } } });
      if (assets.length !== input.resourceIds.length || !unique(assets.map(x => x.id))) throw Error('INVALID_ASSETS');
      const branchId = assets[0].branchId;
      if (!manages(actor, branchId) || assets.some(x => x.branchId !== branchId)) throw Error('INVALID_ASSETS');
      const branch = await tx.branch.findUniqueOrThrow({ where: { id: branchId } });
      if (!branch.active) throw Error('INACTIVE_BRANCH');
      const recipient = await tx.user.findUnique({ where: { id: input.recipientId } });
      if (!recipient?.active || recipient.branchId !== branchId) throw Error('INVALID_RECIPIENT');
      for (const asset of assets) {
        const updated = await tx.resource.updateMany({
          where: { id: asset.id, status: 'AVAILABLE' }, data: { status: 'ASSIGNED' }
        });
        if (updated.count !== 1) throw Error('NOT_AVAILABLE');
        await resourceEvent(tx, asset, actor, 'ASSIGNMENT_ISSUED', 'ASSIGNED');
      }
      const assignment = await tx.assignment.create({
        data: { code: await nextCode(tx), kind: 'BRANCH_ISSUE', recipientId: recipient.id,
          issuedById: actor.userId, branchId, dueAt, notes: input.notes,
          items: { create: assets.map(asset => ({
            resourceId: asset.id, conditionOnIssue: asset.condition
          })) } }
      });
      await event(tx, assignment.id, actor, 'CREATED', null,
        { recipientId: recipient.id, assetCodes: assets.map(x => x.assetCode) });
      return assignment;
    });
    res.status(201).json({ id: created.id, code: created.code });
  } catch (error) { if (!handleError(error, res)) throw error; }
}));

router.post('/:assignmentId/receipt', run(async (req, res) => {
  const parsed = receiptInput.safeParse(req.body);
  if (invalidPayload(res, parsed)) return;
  if (!unique(parsed.data.decisions.map(x => x.itemId))) {
    fail(res, 400, 'INVALID_INPUT', 'An item can only have one decision per request'); return;
  }
  const actor = principal(res);
  try {
    // Validate file signatures before any DB writes.
    const files = parsed.data.decisions.map(d => evidenceFile(d.evidence));
    await serializable(async tx => {
      const assignment = await load(tx, req.params.assignmentId);
      if (assignment.recipientId !== actor.userId) throw Error('FORBIDDEN');
      for (const [i, d] of parsed.data.decisions.entries()) {
        const item = assignment.items.find(item => item.id === d.itemId);
        if (!item || item.status !== 'PENDING') throw Error('INVALID_ITEM');
        if ((item.conditionOnIssue === 'Damaged' || d.damageReported) && !files[i]) throw Error('EVIDENCE_REQUIRED');
        const next: AssignmentItemStatus = d.decision === 'ACCEPT' ? 'ACCEPTED' : 'ISSUE_REPORTED';
        const result = await tx.assignmentItem.updateMany({
          where: { id: item.id, status: 'PENDING' },
          data: { status: next, receiptNotes: d.notes, acceptedAt: d.decision === 'ACCEPT' ? new Date() : null }
        });
        if (result.count !== 1) throw Error('INVALID_ITEM');
        if (files[i]) await tx.assignmentEvidence.create({ data: { itemId: item.id, ...files[i]! } });
        if (item.sourceItemId && next === 'ACCEPTED') {
          const changed = await tx.assignmentItem.updateMany({
            where: { id: item.sourceItemId, status: 'TRANSFER_PENDING' }, data: { status: 'TRANSFERRED' }
          });
          if (changed.count !== 1) throw Error('INVALID_ITEM');
        }
        await event(tx, assignment.id, actor, next, item.id, { resourceId: item.resourceId, damageReported: d.damageReported });
      }
    });
    res.json({ ok: true });
  } catch (error) { if (!handleError(error, res)) throw error; }
}));

router.post('/:assignmentId/returns/request', run(async (req, res) => {
  const parsed = itemIdsInput.safeParse(req.body);
  if (invalidPayload(res, parsed)) return;
  if (!unique(parsed.data.itemIds)) { fail(res, 400, 'INVALID_INPUT', 'Duplicate item'); return; }
  const actor = principal(res);
  try {
    await serializable(async tx => {
      const assignment = await load(tx, req.params.assignmentId);
      if (!manages(actor, assignment.branchId) && assignment.recipientId !== actor.userId) throw Error('FORBIDDEN');
      for (const id of parsed.data.itemIds) {
        const item = assignment.items.find(x => x.id === id);
        if (!item || !(['ACCEPTED', 'ISSUE_REPORTED'] as AssignmentItemStatus[]).includes(item.status)) throw Error('INVALID_ITEM');
        const result = await tx.assignmentItem.updateMany({
          where: { id: item.id, status: item.status }, data: { status: 'RETURN_REQUESTED', returnRequestedAt: new Date() }
        });
        if (result.count !== 1) throw Error('INVALID_ITEM');
        await event(tx, assignment.id, actor, 'RETURN_REQUESTED', id, { resourceId: item.resourceId });
      }
    });
    res.json({ ok: true });
  } catch (error) { if (!handleError(error, res)) throw error; }
}));

router.post('/:assignmentId/returns/verify', run(async (req, res) => {
  const parsed = verifyInput.safeParse(req.body);
  if (invalidPayload(res, parsed)) return;
  if (!unique(parsed.data.items.map(x => x.itemId))) { fail(res, 400, 'INVALID_INPUT', 'Duplicate item'); return; }
  const actor = principal(res);
  try {
    await serializable(async tx => {
      const assignment = await load(tx, req.params.assignmentId);
      if (!manages(actor, assignment.branchId)) throw Error('FORBIDDEN');
      for (const entry of parsed.data.items) {
        const item = assignment.items.find(x => x.id === entry.itemId);
        if (!item || item.status !== 'RETURN_REQUESTED') throw Error('INVALID_ITEM');
        const changed = await tx.assignmentItem.updateMany({ where: { id: item.id, status: 'RETURN_REQUESTED' },
          data: { status: 'RETURNED', returnedAt: new Date(), returnCondition: entry.condition } });
        if (changed.count !== 1) throw Error('INVALID_ITEM');
        const resourceChanged = await tx.resource.updateMany({ where: { id: item.resourceId, status: 'ASSIGNED' },
          data: { status: 'AVAILABLE', condition: entry.condition } });
        if (resourceChanged.count !== 1) throw Error('INVALID_ITEM');
        await resourceEvent(tx, item.resource, actor, 'ASSIGNMENT_RETURNED', 'AVAILABLE', entry.condition);
        await event(tx, assignment.id, actor, 'RETURN_VERIFIED', item.id,
          { resourceId: item.resourceId, condition: entry.condition });
      }
    });
    res.json({ ok: true });
  } catch (error) { if (!handleError(error, res)) throw error; }
}));

// Direct employee-to-employee transfer preserves the original custodian until the
// new recipient accepts. An unconfirmed transfer can be cancelled safely.
router.post('/:assignmentId/transfers', run(async (req, res) => {
  const parsed = transferInput.safeParse(req.body);
  if (invalidPayload(res, parsed)) return;
  if (!unique(parsed.data.itemIds)) { fail(res, 400, 'INVALID_INPUT', 'Duplicate item'); return; }
  const actor = principal(res);
  try {
    const dueAt = asDate(parsed.data.dueAt);
    const result = await serializable(async tx => {
      const source = await load(tx, req.params.assignmentId);
      if (!manages(actor, source.branchId) && source.recipientId !== actor.userId) throw Error('FORBIDDEN');
      if (source.recipientId === parsed.data.recipientId) throw Error('SAME_RECIPIENT');
      const recipient = await tx.user.findUnique({ where: { id: parsed.data.recipientId } });
      if (!recipient?.active || recipient.branchId !== source.branchId) throw Error('INVALID_RECIPIENT');
      const selected = parsed.data.itemIds.map(id => source.items.find(x => x.id === id));
      if (selected.some(x => !x || x.status !== 'ACCEPTED')) throw Error('INVALID_ITEM');
      for (const item of selected) {
        const changed = await tx.assignmentItem.updateMany({
          where: { id: item!.id, status: 'ACCEPTED' }, data: { status: 'TRANSFER_PENDING' }
        });
        if (changed.count !== 1) throw Error('INVALID_ITEM');
      }
      const newAssignment = await tx.assignment.create({ data: {
        code: await nextCode(tx), kind: 'EMPLOYEE_TRANSFER', branchId: source.branchId,
        recipientId: recipient.id, issuedById: actor.userId, dueAt, notes: parsed.data.notes,
        items: { create: selected.map(item => ({
          resourceId: item!.resourceId, conditionOnIssue: item!.resource.condition,
          sourceItemId: item!.id
        })) }
      } });
      await event(tx, source.id, actor, 'TRANSFER_STARTED', null,
        { targetAssignmentId: newAssignment.id, recipientId: recipient.id });
      await event(tx, newAssignment.id, actor, 'CREATED', null,
        { sourceAssignmentId: source.id, assetIds: selected.map(x => x!.resourceId) });
      return newAssignment;
    });
    res.status(201).json({ id: result.id, code: result.code });
  } catch (error) { if (!handleError(error, res)) throw error; }
}));

router.post('/:assignmentId/transfers/cancel', run(async (req, res) => {
  const actor = principal(res);
  try {
    await serializable(async tx => {
      const transfer = await load(tx, req.params.assignmentId);
      if (transfer.kind !== AssignmentKind.EMPLOYEE_TRANSFER) throw Error('INVALID_ITEM');
      const source = await tx.assignmentItem.findFirst({
        where: { id: transfer.items[0]?.sourceItemId ?? '' },
        select: { assignment: { select: { recipientId: true } } }
      });
      if (!manages(actor, transfer.branchId) && actor.userId !== transfer.recipientId &&
          actor.userId !== source?.assignment.recipientId) throw Error('FORBIDDEN');
      if (transfer.items.some(item => !(['PENDING', 'ISSUE_REPORTED'] as AssignmentItemStatus[]).includes(item.status)))
        throw Error('INVALID_ITEM');
      for (const item of transfer.items) {
        const changed = await tx.assignmentItem.updateMany({ where: { id: item.id, status: item.status },
          data: { status: 'CANCELLED' } });
        const restored = item.sourceItemId ? await tx.assignmentItem.updateMany({
          where: { id: item.sourceItemId, status: 'TRANSFER_PENDING' }, data: { status: 'ACCEPTED' }
        }) : null;
        if (changed.count !== 1 || restored?.count !== 1) throw Error('INVALID_ITEM');
      }
      await event(tx, transfer.id, actor, 'TRANSFER_CANCELLED');
    });
    res.json({ ok: true });
  } catch (error) { if (!handleError(error, res)) throw error; }
}));

export default router;
