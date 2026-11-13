import { Prisma, type AssignmentItemStatus } from '@prisma/client';
import { db } from '../db.js';

// A newly issued asset is reserved immediately, but its recipient is still
// awaiting confirmation. During a direct transfer, the previous recipient
// remains accountable until the next employee accepts their handover.
const openStates: AssignmentItemStatus[] = [
  'PENDING', 'ACCEPTED', 'ISSUE_REPORTED', 'RETURN_REQUESTED', 'TRANSFER_PENDING'
];

const currentInclude = {
  assignment: { select: {
    id: true, code: true, createdAt: true, dueAt: true,
    recipient: { select: { id: true, fullName: true } }
  } }
} satisfies Prisma.AssignmentItemInclude;
type CurrentItem = Prisma.AssignmentItemGetPayload<{ include: typeof currentInclude }>;

export type ResourceCustody = {
  assignmentId: string;
  assignmentCode: string;
  userId: string;
  userName: string;
  itemStatus: AssignmentItemStatus;
  issuedAt: Date;
  returnDue: Date | null;
  pendingRecipientName: string | null;
};

// Shared by both the resource register and its detail endpoint; avoid N+1
// requests and never infer the current custodian from historical closed rows.
export async function currentCustodyByResource(resourceIds: string[]) {
  const result = new Map<string, ResourceCustody>();
  if (!resourceIds.length) return result;
  const items: CurrentItem[] = await db.assignmentItem.findMany({
    where: { resourceId: { in: resourceIds }, status: { in: openStates } },
    include: currentInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
  });

  // Transfers that await confirmation do not change the existing custodian.
  // The new recipient is displayed separately as the pending recipient.
  const incoming = new Map<string, CurrentItem>();
  for (const item of items) {
    if (item.sourceItemId && (item.status === 'PENDING' || item.status === 'ISSUE_REPORTED')) {
      if (!incoming.has(item.sourceItemId)) incoming.set(item.sourceItemId, item);
    }
  }
  for (const item of items) {
    if (item.sourceItemId && (item.status === 'PENDING' || item.status === 'ISSUE_REPORTED')) continue;
    if (result.has(item.resourceId)) continue;
    const pendingRecipient = incoming.get(item.id);
    result.set(item.resourceId, {
      assignmentId: item.assignment.id,
      assignmentCode: item.assignment.code,
      userId: item.assignment.recipient.id,
      userName: item.assignment.recipient.fullName,
      itemStatus: item.status,
      issuedAt: item.assignment.createdAt,
      returnDue: item.assignment.dueAt,
      pendingRecipientName: pendingRecipient?.assignment.recipient.fullName ?? null
    });
  }
  return result;
}

const historyInclude = {
  assignment: { select: {
    id: true, code: true, kind: true, notes: true,
    createdAt: true, dueAt: true,
    recipient: { select: { id: true, fullName: true } },
    issuedBy: { select: { id: true, fullName: true } }
  } },
  evidence: { select: { filename: true, mimeType: true, byteSize: true } }
} satisfies Prisma.AssignmentItemInclude;

export async function resourceAssignmentHistory(resourceId: string) {
  const [total, records] = await Promise.all([
    db.assignmentItem.count({ where: { resourceId } }),
    db.assignmentItem.findMany({
      where: { resourceId }, include: historyInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100
    })
  ]);
  const events = records.length ? await db.assignmentEvent.findMany({
    where: { itemId: { in: records.map(record => record.id) } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, itemId: true, action: true, actorName: true, createdAt: true },
    take: 1000
  }) : [];
  const eventsByItem = new Map<string, typeof events>();
  for (const event of events) {
    if (!event.itemId) continue;
    const values = eventsByItem.get(event.itemId) ?? [];
    values.push(event);
    eventsByItem.set(event.itemId, values);
  }
  return {
    assignments: records.map(record => ({
      itemId: record.id,
      assignmentId: record.assignment.id,
      assignmentCode: record.assignment.code,
      kind: record.assignment.kind,
      recipientId: record.assignment.recipient.id,
      recipientName: record.assignment.recipient.fullName,
      issuedByName: record.assignment.issuedBy.fullName,
      issuedAt: record.assignment.createdAt,
      returnDue: record.assignment.dueAt,
      notes: record.assignment.notes,
      status: record.status,
      conditionOnIssue: record.conditionOnIssue,
      receiptNotes: record.receiptNotes,
      acceptedAt: record.acceptedAt,
      returnRequestedAt: record.returnRequestedAt,
      returnedAt: record.returnedAt,
      returnCondition: record.returnCondition,
      evidence: record.evidence,
      events: eventsByItem.get(record.id) ?? []
    })),
    truncated: total > records.length,
    total
  };
}
