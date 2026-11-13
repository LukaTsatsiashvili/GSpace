import { Prisma, ResourceStatus } from '@prisma/client';
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { canAccessBranch } from '../security/access-policy.js';
import { principal, requireAuth, requirePermission, type AuthPrincipal } from '../security/auth.js';

const router = Router();
const run = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };
const fail = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });
const uuid = z.string().uuid();
const name = z.string().trim().min(2).max(180);
const condition = z.enum(['Excellent', 'Good', 'Fair', 'Damaged', 'Poor']);
const resourceType = z.enum(['Physical Asset', 'Digital Asset', 'Bundle']);
const customValues = z.record(z.string().max(300)).refine(obj => Object.keys(obj).length <= 20);
const fieldDefinition = z.object({
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/),
  label: z.string().trim().min(2).max(80), required: z.boolean()
}).strict();
const documentInput = z.object({
  filename: z.string().trim().min(1).max(180),
  mimeType: z.string().trim().max(100),
  base64: z.string().min(1).max(2_900_000)
}).strict();
const input = z.object({
  name, category: name, branchId: uuid, resourceType,
  condition, status: z.enum(['AVAILABLE', 'RETIRED']).default('AVAILABLE'),
  location: z.string().trim().max(240).default(''),
  serialNumber: z.string().trim().max(120).nullable().default(null),
  description: z.string().trim().max(3000).default(''),
  warrantyEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  purchasePrice: z.number().finite().min(0).max(999999999).nullable().default(null),
  currency: z.enum(['GEL', 'USD', 'EUR']).default('GEL'),
  supplier: z.string().trim().max(200).default(''),
  usefulLifeMonths: z.number().int().min(1).max(1200).nullable().default(null),
  residualValue: z.number().finite().min(0).max(999999999).nullable().default(null),
  customFields: customValues.default({}),
  documents: z.array(documentInput).max(4).default([])
}).strict();
type ResourceInput = z.infer<typeof input>;
const categorySchema = z.object({ name, definitions: z.array(fieldDefinition).max(20) }).strict();
const updateCategorySchema = categorySchema.extend({ active: z.boolean() });

function validDate(raw: string | null) {
  if (!raw) return null;
  const day = new Date(raw + 'T00:00:00.000Z');
  return !Number.isNaN(day.valueOf()) && day.toISOString().slice(0, 10) === raw ? day : undefined;
}
function asMoney(value: number | null) {
  return value === null ? null : new Prisma.Decimal(value.toFixed(2));
}
function validFinancial(data: ResourceInput) {
  if (data.residualValue !== null && data.purchasePrice === null) return false;
  return data.residualValue === null || data.purchasePrice === null || data.residualValue <= data.purchasePrice;
}
function usesFinance(data: ResourceInput) {
  return data.purchasePrice !== null || data.purchaseDate !== null || data.supplier !== '' ||
    data.usefulLifeMonths !== null || data.residualValue !== null;
}
function auditResource(row: { id: string; assetCode: string; name: string; category: string; branchId: string; condition: string; status: string; location: string }) {
  return { id: row.id, assetCode: row.assetCode, name: row.name, category: row.category,
    branchId: row.branchId, condition: row.condition, status: row.status, location: row.location };
}
const include = {
  branch: { select: { id: true, name: true } },
  documents: { select: { id: true, filename: true, mimeType: true, byteSize: true, createdAt: true }, orderBy: { createdAt: 'asc' } }
} satisfies Prisma.ResourceInclude;
type ResourceRow = Prisma.ResourceGetPayload<{ include: typeof include }>;
function serialize(row: ResourceRow, actor: AuthPrincipal) {
  const finance = actor.permissions.includes('finance.view');
  return {
    id: row.id, assetCode: row.assetCode, name: row.name, category: row.category,
    resourceType: row.resourceType, condition: row.condition, status: row.status,
    branchId: row.branchId, branch: row.branch.name, location: row.location,
    serialNumber: row.serialNumber, description: row.description, warrantyEnd: row.warrantyEnd,
    customFields: row.customFields, documents: row.documents,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    ...(finance ? {
      purchasePrice: row.purchasePrice?.toString() ?? null, currency: row.currency,
      purchaseDate: row.purchaseDate, supplier: row.supplier,
      usefulLifeMonths: row.usefulLifeMonths, residualValue: row.residualValue?.toString() ?? null
    } : {})
  };
}
const isCentral = (actor: AuthPrincipal) => ['SYSTEM_ADMIN', 'COMPANY_ADMIN'].includes(actor.roleKey);
const writeAllowed = (actor: AuthPrincipal, perm: 'assets.create' | 'assets.edit') =>
  actor.permissions.includes(perm) && (perm !== 'assets.create' || isCentral(actor));
function allowCreate(_req: Request, res: Response, next: NextFunction) {
  if (!writeAllowed(principal(res), 'assets.create')) { fail(res, 403, 'FORBIDDEN', 'Only authorized central administrators can register resources'); return; }
  next();
}
function allowEdit(_req: Request, res: Response, next: NextFunction) {
  if (!writeAllowed(principal(res), 'assets.edit')) { fail(res, 403, 'FORBIDDEN', 'Resource editing permission is required'); return; }
  next();
}
type Upload = { filename: string; mimeType: string; content: Buffer };
function decodeDocuments(files: ResourceInput['documents']): Upload[] {
  let total = 0;
  return files.map(file => {
    if (/[\\/\x00-\x1f]/.test(file.filename) || !/^[\p{L}\p{N}._ ()-]+$/u.test(file.filename)) throw Error('INVALID_DOCUMENT');
    const allowed: Record<string, string[]> = {
      'application/pdf': ['.pdf'], 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'],
      'image/webp': ['.webp'], 'text/plain': ['.txt'], 'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    };
    if (!allowed[file.mimeType]?.some(ext => file.filename.toLowerCase().endsWith(ext))) throw Error('INVALID_DOCUMENT');
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.base64)) throw Error('INVALID_DOCUMENT');
    const content = Buffer.from(file.base64, 'base64');
    if (!content.length || content.length > 2 * 1024 * 1024) throw Error('DOCUMENT_TOO_LARGE');
    total += content.length;
    if (total > 6 * 1024 * 1024) throw Error('DOCUMENT_TOO_LARGE');
    const signature = file.mimeType === 'application/pdf' ? content.subarray(0, 5).toString('ascii') === '%PDF-' :
      file.mimeType === 'image/png' ? content.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) :
      file.mimeType === 'image/jpeg' ? content.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) :
      file.mimeType === 'image/webp' ? content.subarray(0, 4).toString('ascii') === 'RIFF' && content.subarray(8, 12).toString('ascii') === 'WEBP' :
      file.mimeType.includes('openxmlformats') ? content.subarray(0, 2).toString('ascii') === 'PK' : true;
    if (!signature) throw Error('INVALID_DOCUMENT');
    return { filename: file.filename, mimeType: file.mimeType, content };
  });
}
async function validate(
  tx: Prisma.TransactionClient, values: ResourceInput, actor: AuthPrincipal,
  options: { allowMissingRequiredCustomFields?: boolean } = {}
) {
  const branch = await tx.branch.findUnique({ where: { id: values.branchId } });
  if (!branch?.active) throw Error('INVALID_BRANCH');
  if (!canAccessBranch(actor.roleKey, actor.branchId, branch.id)) throw Error('INVALID_BRANCH');
  const category = await tx.resourceCategory.findFirst({ where: { name: values.category, active: true } });
  if (!category) throw Error('INVALID_CATEGORY');
  const defs = z.array(fieldDefinition).max(20).safeParse(category.definitions);
  if (!defs.success) throw Error('INVALID_CATEGORY');
  const keys = new Set(defs.data.map(f => f.key));
  for (const key of Object.keys(values.customFields)) if (!keys.has(key)) throw Error('INVALID_CUSTOM_FIELDS');
  // Only the identical-item bulk workflow may register assets before required custom
  // specifications are populated. Single creates and Edit still enforce them.
  if (!options.allowMissingRequiredCustomFields) {
    for (const field of defs.data) {
      if (field.required && !values.customFields[field.key]?.trim()) throw Error('REQUIRED_CUSTOM_FIELD');
    }
  }
  if (!validFinancial(values) || validDate(values.warrantyEnd) === undefined ||
      validDate(values.purchaseDate) === undefined) throw Error('INVALID_VALUES');
  if (!actor.permissions.includes('finance.edit') && usesFinance(values)) throw Error('FINANCE_FORBIDDEN');
}
function createData(values: ResourceInput) {
  return {
    name: values.name, category: values.category, resourceType: values.resourceType,
    condition: values.condition, status: values.status as ResourceStatus,
    branchId: values.branchId, location: values.location, serialNumber: values.serialNumber || null,
    description: values.description, warrantyEnd: validDate(values.warrantyEnd),
    purchaseDate: validDate(values.purchaseDate), purchasePrice: asMoney(values.purchasePrice),
    currency: values.currency, supplier: values.supplier, usefulLifeMonths: values.usefulLifeMonths,
    residualValue: asMoney(values.residualValue), customFields: values.customFields
  };
}
function handleError(err: unknown, res: Response) {
  const errors: Record<string, [number, string]> = {
    INVALID_BRANCH: [400, 'Choose an accessible, active branch'],
    INVALID_CATEGORY: [400, 'Choose an active category with valid field definitions'],
    INVALID_CUSTOM_FIELDS: [400, 'One or more custom fields do not belong to the category'],
    REQUIRED_CUSTOM_FIELD: [400, 'Complete the required category fields'],
    INVALID_VALUES: [400, 'Check the dates and purchase / residual amounts'],
    FINANCE_FORBIDDEN: [403, 'Finance editing permission is required for purchase details'],
    INVALID_DOCUMENT: [400, 'File type, filename or contents are invalid'],
    DOCUMENT_TOO_LARGE: [413, 'Attachments exceed the permitted size'],
    DOCUMENT_LIMIT: [409, 'A resource may hold at most 20 documents (20 MB combined)'],
    DOCUMENT_NOT_FOUND: [404, 'Document not found'],
    NOT_FOUND: [404, 'Resource not found'],
    LIFECYCLE_LOCKED: [409, 'Assignment, transfer or maintenance status cannot be edited directly'],
    INVALID_STATE: [409, 'Only available or retired resources can be changed in this module'],
    IN_USE: [409, 'Only unused available or retired resources can be deleted'],
    INACTIVE_CATEGORY: [409, 'Category has existing assets and cannot be deactivated'],
    CATEGORY_EXISTS: [409, 'A category with this name already exists']
  };
  const msg = err instanceof Error ? err.message : '';
  const known = errors[msg];
  if (known) { fail(res, known[0], msg, known[1]); return true; }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    fail(res, 409, 'DUPLICATE', 'A resource serial, code or category already exists'); return true;
  }
  return false;
}
async function withRetry<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await db.$transaction(callback, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
  throw Error('Transaction retries exhausted');
}
async function reserveIds(tx: Prisma.TransactionClient, count: number) {
  const seq = await tx.resourceCounter.update({
    where: { name: 'ASSET' }, data: { nextNumber: { increment: count } }
  });
  const start = seq.nextNumber - count;
  return Array.from({ length: count }, (_, index) => 'AST-' + String(start + index).padStart(5, '0'));
}
async function event(tx: Prisma.TransactionClient, actor: AuthPrincipal,
  resource: { id: string; assetCode: string; name: string; category: string; branchId: string; condition: string; status: string; location: string },
  action: string, before?: Prisma.InputJsonValue) {
  const after = action === 'DELETED' ? Prisma.JsonNull : auditResource(resource);
  await tx.resourceAuditEvent.create({
    data: { resourceId: resource.id, assetCode: resource.assetCode,
      action, actorId: actor.userId, actorName: actor.fullName,
      ...(before === undefined ? {} : { before }), after }
  });
}

router.use(requireAuth, requirePermission('assets.view'));

router.get('/catalog', run(async (_req, res) => {
  const actor = principal(res);
  const [categories, branches] = await Promise.all([
    db.resourceCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    db.branch.findMany({ where: isCentral(actor) ? { active: true } : { active: true, id: actor.branchId },
      select: { id: true, name: true }, orderBy: { name: 'asc' } })
  ]);
  res.json({ categories: categories.map(x => ({
    id: x.id, name: x.name, definitions: x.definitions
  })), branches });
}));

router.get('/', run(async (req, res) => {
  const actor = principal(res);
  const scope = isCentral(actor) ? {} : { branchId: actor.branchId };
  const rows = await db.resource.findMany({
    where: scope, include, orderBy: { createdAt: 'desc' }, take: 500
  });
  const grouped = await db.resource.groupBy({ by: ['status'], where: scope, _count: { _all: true } });
  const counts = Object.fromEntries(grouped.map(group => [group.status, group._count._all]));
  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
  const branches = await db.branch.count({ where: isCentral(actor) ? { active: true } : { id: actor.branchId, active: true } });
  res.json({
    resources: rows.map(row => serialize(row, actor)),
    summary: {
      total, assigned: counts.ASSIGNED ?? 0, available: counts.AVAILABLE ?? 0,
      maintenance: counts.IN_MAINTENANCE ?? 0, branches
    },
    truncated: total > rows.length
  });
}));

router.post('/export', requirePermission('reports.export'), run(async (req, res) => {
  const parsed = z.object({ ids: z.array(uuid).max(500) }).strict().safeParse(req.body);
  if (!parsed.success) { fail(res, 400, 'INVALID_INPUT', 'Select at most 500 resources to export'); return; }
  const actor = principal(res);
  const rows = await db.resource.findMany({
    where: { id: { in: parsed.data.ids },
      ...(isCentral(actor) ? {} : { branchId: actor.branchId }) },
    include: { branch: { select: { name: true } } }, orderBy: { assetCode: 'asc' }
  });
  const escapeCsv = (value: string) => {
    // Neutralize spreadsheet formula injection in attacker-controlled text fields.
    const safe = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
    return '"' + safe.replace(/"/g, '""').replace(/[\r\n]/g, ' ') + '"';
  };
  const lines = [['Asset ID', 'Name', 'Category', 'Branch', 'Location', 'Condition', 'Status', 'Serial'],
    ...rows.map(row => [row.assetCode, row.name, row.category, row.branch.name,
      row.location, row.condition, row.status, row.serialNumber ?? ''])];
  const csv = lines.map(values => values.map(escapeCsv).join(',')).join('\r\n');
  await db.securityAuditEvent.create({ data: {
    action: 'RESOURCE_REGISTER_EXPORTED', success: true, actorUserId: actor.userId,
    details: JSON.stringify({ count: rows.length })
  } });
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="gspace-resources.csv"');
  res.send(csv);
}));

router.get('/:resourceId/audit', run(async (req, res) => {
  const actor = principal(res);
  const found = await db.resource.findUnique({ where: { id: req.params.resourceId }, select: { branchId: true } });
  if (!found || !canAccessBranch(actor.roleKey, actor.branchId, found.branchId)) {
    fail(res, 404, 'NOT_FOUND', 'Resource not found'); return;
  }
  const events = await db.resourceAuditEvent.findMany({
    where: { resourceId: req.params.resourceId }, orderBy: { createdAt: 'desc' }, take: 100
  });
  res.json({ events });
}));

router.get('/:resourceId/documents/:documentId', run(async (req, res) => {
  const actor = principal(res);
  const resource = await db.resource.findUnique({
    where: { id: req.params.resourceId }, select: { branchId: true }
  });
  if (!resource || !canAccessBranch(actor.roleKey, actor.branchId, resource.branchId)) {
    fail(res, 404, 'NOT_FOUND', 'Document not found'); return;
  }
  const file = await db.resourceDocument.findFirst({
    where: { id: req.params.documentId, resourceId: req.params.resourceId }
  });
  if (!file) { fail(res, 404, 'NOT_FOUND', 'Document not found'); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', 'attachment; filename="document"; filename*=UTF-8\'\'' + encodeURIComponent(file.filename));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(Buffer.from(file.content));
}));

/**
 * Documents have their own lifecycle. Do not force a full Resource PATCH:
 * attaching a late invoice must not require filling unrelated custom fields
 * or changing assignment / maintenance state.
 */
const documentBatch = z.object({
  documents: z.array(documentInput).min(1).max(4)
}).strict();
const maxDocumentsPerResource = 20;
const maxDocumentBytesPerResource = 20 * 1024 * 1024;

function documentAuditMeta(file: {
  id: string; filename: string; mimeType: string; byteSize: number
}) {
  return { id: file.id, filename: file.filename, mimeType: file.mimeType, byteSize: file.byteSize };
}

router.post('/:resourceId/documents', allowEdit, run(async (req, res) => {
  const parsed = documentBatch.safeParse(req.body);
  if (!parsed.success) {
    fail(res, 400, 'INVALID_INPUT', 'Select 1–4 valid attachments'); return;
  }
  const actor = principal(res);
  try {
    const incoming = decodeDocuments(parsed.data.documents);
    const updated = await withRetry(async tx => {
      const resource = await tx.resource.findUnique({ where: { id: req.params.resourceId } });
      if (!resource || !canAccessBranch(actor.roleKey, actor.branchId, resource.branchId)) {
        throw Error('NOT_FOUND');
      }
      const size = await tx.resourceDocument.aggregate({
        where: { resourceId: resource.id },
        _count: { _all: true }, _sum: { byteSize: true }
      });
      if (size._count._all + incoming.length > maxDocumentsPerResource ||
        (size._sum.byteSize ?? 0) + incoming.reduce((sum, file) => sum + file.content.length, 0) >
          maxDocumentBytesPerResource) throw Error('DOCUMENT_LIMIT');

      const added = [];
      for (const file of incoming) {
        added.push(await tx.resourceDocument.create({
          data: {
            resourceId: resource.id, filename: file.filename, mimeType: file.mimeType,
            byteSize: file.content.length, content: Uint8Array.from(file.content)
          },
          select: { id: true, filename: true, mimeType: true, byteSize: true, createdAt: true }
        }));
      }
      await tx.resource.update({
        where: { id: resource.id }, data: { updatedAt: new Date() }
      });
      await tx.resourceAuditEvent.createMany({
        data: added.map(file => ({
          resourceId: resource.id, assetCode: resource.assetCode,
          action: 'DOCUMENT_ADDED', actorId: actor.userId, actorName: actor.fullName,
          after: { document: documentAuditMeta(file) }
        }))
      });
      await tx.securityAuditEvent.create({
        data: {
          action: 'RESOURCE_DOCUMENTS_ADDED', success: true, actorUserId: actor.userId,
          details: JSON.stringify({
            resourceId: resource.id, assetCode: resource.assetCode,
            documents: added.map(documentAuditMeta)
          })
        }
      });
      return tx.resource.findUniqueOrThrow({ where: { id: resource.id }, include });
    });
    res.status(201).json({ resource: serialize(updated, actor) });
  } catch (error) { if (!handleError(error, res)) throw error; }
}));

router.delete('/:resourceId/documents/:documentId', allowEdit, run(async (req, res) => {
  const actor = principal(res);
  try {
    const updated = await withRetry(async tx => {
      const resource = await tx.resource.findUnique({ where: { id: req.params.resourceId } });
      if (!resource || !canAccessBranch(actor.roleKey, actor.branchId, resource.branchId)) {
        throw Error('NOT_FOUND');
      }
      const file = await tx.resourceDocument.findFirst({
        where: { resourceId: resource.id, id: req.params.documentId },
        select: { id: true, filename: true, mimeType: true, byteSize: true }
      });
      if (!file) throw Error('DOCUMENT_NOT_FOUND');
      await tx.resourceDocument.delete({ where: { id: file.id } });
      await tx.resource.update({
        where: { id: resource.id }, data: { updatedAt: new Date() }
      });
      await tx.resourceAuditEvent.create({
        data: {
          resourceId: resource.id, assetCode: resource.assetCode,
          action: 'DOCUMENT_DELETED', actorId: actor.userId, actorName: actor.fullName,
          before: { document: documentAuditMeta(file) }
        }
      });
      await tx.securityAuditEvent.create({
        data: {
          action: 'RESOURCE_DOCUMENT_DELETED', success: true, actorUserId: actor.userId,
          details: JSON.stringify({ resourceId: resource.id, assetCode: resource.assetCode,
            document: documentAuditMeta(file) })
        }
      });
      return tx.resource.findUniqueOrThrow({ where: { id: resource.id }, include });
    });
    res.json({ resource: serialize(updated, actor) });
  } catch (error) { if (!handleError(error, res)) throw error; }
}));

router.get('/:resourceId', run(async (req, res) => {
  const actor = principal(res);
  const row = await db.resource.findUnique({ where: { id: req.params.resourceId }, include });
  if (!row || !canAccessBranch(actor.roleKey, actor.branchId, row.branchId)) {
    fail(res, 404, 'NOT_FOUND', 'Resource not found'); return;
  }
  res.json({ resource: serialize(row, actor) });
}));

router.post('/', allowCreate, run(async (req, res) => {
  const parsed = input.safeParse(req.body);
  if (!parsed.success) { fail(res, 400, 'INVALID_INPUT', 'Check the resource details and file information'); return; }
  const actor = principal(res);
  try {
    const documents = decodeDocuments(parsed.data.documents);
    const created = await withRetry(async tx => {
      await validate(tx, parsed.data, actor);
      const [code] = await reserveIds(tx, 1);
      const record = await tx.resource.create({
        data: { ...createData(parsed.data), assetCode: code,
          documents: { create: documents.map(file => ({
            filename: file.filename, mimeType: file.mimeType, byteSize: file.content.length, content: Uint8Array.from(file.content)
          })) } }
      });
      await event(tx, actor, record, 'CREATED');
      await tx.securityAuditEvent.create({ data: {
        action: 'RESOURCE_CREATED', success: true, actorUserId: actor.userId,
        details: JSON.stringify({ id: record.id, assetCode: record.assetCode })
      } });
      return record;
    });
    res.status(201).json({ id: created.id, assetCode: created.assetCode });
  } catch (err) { if (!handleError(err, res)) throw err; }
}));

router.patch('/:resourceId', allowEdit, run(async (req, res) => {
  const parsed = input.omit({ documents: true }).safeParse(req.body);
  if (!parsed.success) { fail(res, 400, 'INVALID_INPUT', 'Check the resource details'); return; }
  const actor = principal(res);
  try {
    await withRetry(async tx => {
      const prior = await tx.resource.findUnique({ where: { id: req.params.resourceId } });
      if (!prior || !canAccessBranch(actor.roleKey, actor.branchId, prior.branchId)) throw Error('NOT_FOUND');
      if (!([ResourceStatus.AVAILABLE, ResourceStatus.RETIRED] as ResourceStatus[]).includes(prior.status)) throw Error('LIFECYCLE_LOCKED');
      if (!isCentral(actor) && parsed.data.branchId !== prior.branchId) throw Error('INVALID_BRANCH');
      await validate(tx, { ...parsed.data, documents: [] }, actor);
      // Editors without finance.edit must never erase or overwrite financial metadata.
      const edits = createData({ ...parsed.data, documents: [] });
      const data = actor.permissions.includes('finance.edit') ? edits : {
        name: edits.name, category: edits.category, resourceType: edits.resourceType,
        condition: edits.condition, status: edits.status, branchId: edits.branchId,
        location: edits.location, serialNumber: edits.serialNumber,
        description: edits.description, warrantyEnd: edits.warrantyEnd,
        customFields: edits.customFields
      };
      const after = await tx.resource.update({ where: { id: prior.id }, data });
      await event(tx, actor, after, 'UPDATED', auditResource(prior));
      await tx.securityAuditEvent.create({ data: {
        action: 'RESOURCE_UPDATED', success: true, actorUserId: actor.userId,
        details: JSON.stringify({ id: prior.id, assetCode: prior.assetCode })
      } });
    });
    res.json({ ok: true });
  } catch (err) { if (!handleError(err, res)) throw err; }
}));


router.post('/bulk', allowCreate, run(async (req, res) => {
  const parsed = z.object({
    template: input.omit({ documents: true, serialNumber: true }),
    quantity: z.number().int().min(1).max(100)
  }).strict().safeParse(req.body);
  if (!parsed.success) { fail(res, 400, 'INVALID_INPUT', 'Quantity must be 1–100 and template must be valid'); return; }
  const actor = principal(res);
  try {
    const result = await withRetry(async tx => {
      const values = { ...parsed.data.template, serialNumber: null, documents: [] };
      await validate(tx, values, actor, { allowMissingRequiredCustomFields: true });
      const codes = await reserveIds(tx, parsed.data.quantity);
      const records = codes.map(assetCode => ({ ...createData(values), assetCode }));
      await tx.resource.createMany({ data: records });
      const created = await tx.resource.findMany({ where: { assetCode: { in: codes } } });
      await tx.resourceAuditEvent.createMany({ data: created.map(row => ({
        resourceId: row.id, assetCode: row.assetCode, action: 'CREATED',
        actorId: actor.userId, actorName: actor.fullName,
        after: auditResource(row)
      })) });
      await tx.securityAuditEvent.create({ data: {
        action: 'RESOURCE_BULK_CREATED', success: true, actorUserId: actor.userId,
        details: JSON.stringify({ quantity: codes.length, first: codes[0], last: codes.at(-1) })
      } });
      return codes;
    });
    res.status(201).json({ count: result.length, firstCode: result[0], lastCode: result.at(-1) });
  } catch (err) { if (!handleError(err, res)) throw err; }
}));

router.delete('/:resourceId', allowEdit, run(async (req, res) => {
  const actor = principal(res);
  if (!isCentral(actor)) { fail(res, 403, 'FORBIDDEN', 'Only central administrators can delete unused resources'); return; }
  try {
    await withRetry(async tx => {
      const prior = await tx.resource.findUnique({
        where: { id: req.params.resourceId }, include: { _count: { select: { documents: true } } }
      });
      if (!prior) throw Error('NOT_FOUND');
      if (!([ResourceStatus.AVAILABLE, ResourceStatus.RETIRED] as ResourceStatus[]).includes(prior.status)) throw Error('IN_USE');
      await tx.resource.delete({ where: { id: prior.id } });
      await event(tx, actor, prior, 'DELETED', auditResource(prior));
      await tx.securityAuditEvent.create({ data: {
        action: 'RESOURCE_DELETED', success: true, actorUserId: actor.userId,
        details: JSON.stringify({ id: prior.id, assetCode: prior.assetCode })
      } });
    });
    res.status(204).send();
  } catch (err) { if (!handleError(err, res)) throw err; }
}));

router.post('/categories', allowCreate, run(async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) { fail(res, 400, 'INVALID_INPUT', 'Check category name and field definitions'); return; }
  if (new Set(parsed.data.definitions.map(x => x.key)).size !== parsed.data.definitions.length) {
    fail(res, 400, 'INVALID_INPUT', 'Custom field keys must be unique'); return;
  }
  const actor = principal(res);
  try {
    const created = await withRetry(async tx => {
      if (await tx.resourceCategory.findFirst({
        where: { name: { equals: parsed.data.name, mode: 'insensitive' } }
      })) throw Error('CATEGORY_EXISTS');
      const category = await tx.resourceCategory.create({ data: {
        name: parsed.data.name, definitions: parsed.data.definitions
      } });
      await tx.securityAuditEvent.create({ data: {
        action: 'RESOURCE_CATEGORY_CREATED', success: true, actorUserId: actor.userId,
        details: JSON.stringify({ id: category.id, name: category.name })
      } });
      return category;
    });
    res.status(201).json({ id: created.id });
  } catch (err) { if (!handleError(err, res)) throw err; }
}));

router.patch('/categories/:categoryId', allowCreate, run(async (req, res) => {
  const parsed = updateCategorySchema.safeParse(req.body);
  if (!parsed.success) { fail(res, 400, 'INVALID_INPUT', 'Check category settings'); return; }
  if (new Set(parsed.data.definitions.map(x => x.key)).size !== parsed.data.definitions.length) {
    fail(res, 400, 'INVALID_INPUT', 'Custom field keys must be unique'); return;
  }
  const actor = principal(res);
  try {
    await withRetry(async tx => {
      const original = await tx.resourceCategory.findUnique({ where: { id: req.params.categoryId } });
      if (!original) throw Error('NOT_FOUND');
      if (await tx.resourceCategory.findFirst({
        where: { id: { not: original.id }, name: { equals: parsed.data.name, mode: 'insensitive' } }
      })) throw Error('CATEGORY_EXISTS');
      if (parsed.data.name !== original.name && await tx.resource.count({ where: { category: original.name } })) {
        throw Error('INACTIVE_CATEGORY');
      }
      if (!parsed.data.active && await tx.resource.count({ where: { category: original.name } })) {
        throw Error('INACTIVE_CATEGORY');
      }
      await tx.resourceCategory.update({ where: { id: original.id }, data: {
        name: parsed.data.name, definitions: parsed.data.definitions, active: parsed.data.active
      } });
      await tx.securityAuditEvent.create({ data: {
        action: 'RESOURCE_CATEGORY_UPDATED', success: true, actorUserId: actor.userId,
        details: JSON.stringify({ id: original.id, name: parsed.data.name })
      } });
    });
    res.json({ ok: true });
  } catch (err) { if (!handleError(err, res)) throw err; }
}));

export default router;
