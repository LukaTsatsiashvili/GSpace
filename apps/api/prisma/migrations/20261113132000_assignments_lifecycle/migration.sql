-- Assignment lifecycle, item-level acknowledgement and durable custody events
CREATE TYPE "AssignmentKind" AS ENUM ('BRANCH_ISSUE', 'EMPLOYEE_TRANSFER');
CREATE TYPE "AssignmentItemStatus" AS ENUM ('PENDING', 'ACCEPTED', 'ISSUE_REPORTED', 'RETURN_REQUESTED', 'RETURNED', 'TRANSFER_PENDING', 'TRANSFERRED', 'CANCELLED');

CREATE TABLE "AssignmentCounter" ("name" TEXT NOT NULL, "nextNumber" INTEGER NOT NULL, CONSTRAINT "AssignmentCounter_pkey" PRIMARY KEY ("name"));
CREATE TABLE "Assignment" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" "AssignmentKind" NOT NULL DEFAULT 'BRANCH_ISSUE',
  "branchId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "issuedById" TEXT NOT NULL,
  "notes" TEXT NOT NULL DEFAULT '',
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AssignmentItem" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "status" "AssignmentItemStatus" NOT NULL DEFAULT 'PENDING',
  "conditionOnIssue" TEXT NOT NULL,
  "receiptNotes" TEXT NOT NULL DEFAULT '',
  "acceptedAt" TIMESTAMP(3),
  "returnRequestedAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "returnCondition" TEXT,
  "sourceItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AssignmentItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AssignmentEvidence" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "content" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentEvidence_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AssignmentEvent" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "itemId" TEXT,
  "action" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "details" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssignmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Assignment_code_key" ON "Assignment"("code");
CREATE INDEX "Assignment_branchId_createdAt_idx" ON "Assignment"("branchId", "createdAt");
CREATE INDEX "Assignment_recipientId_createdAt_idx" ON "Assignment"("recipientId", "createdAt");
CREATE INDEX "AssignmentItem_assignmentId_status_idx" ON "AssignmentItem"("assignmentId", "status");
CREATE INDEX "AssignmentItem_resourceId_status_idx" ON "AssignmentItem"("resourceId", "status");
CREATE INDEX "AssignmentItem_sourceItemId_idx" ON "AssignmentItem"("sourceItemId");
CREATE UNIQUE INDEX "AssignmentEvidence_itemId_key" ON "AssignmentEvidence"("itemId");
CREATE INDEX "AssignmentEvent_assignmentId_createdAt_idx" ON "AssignmentEvent"("assignmentId", "createdAt");

ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentItem" ADD CONSTRAINT "AssignmentItem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentItem" ADD CONSTRAINT "AssignmentItem_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentItem" ADD CONSTRAINT "AssignmentItem_sourceItemId_fkey" FOREIGN KEY ("sourceItemId") REFERENCES "AssignmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentEvidence" ADD CONSTRAINT "AssignmentEvidence_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AssignmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssignmentEvent" ADD CONSTRAINT "AssignmentEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
