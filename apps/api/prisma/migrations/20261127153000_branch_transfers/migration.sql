CREATE TABLE "BranchTransferCounter" ("name" TEXT PRIMARY KEY, "nextNumber" INTEGER NOT NULL);
CREATE TABLE "BranchTransfer" (
"id" TEXT PRIMARY KEY, "code" TEXT NOT NULL UNIQUE,
"sourceId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
"destinationId" TEXT NOT NULL REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
"senderId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
"recipientId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
"route" TEXT NOT NULL CHECK ("route" IN ('Manager approval','Direct dispatch')),
"status" TEXT NOT NULL CHECK ("status" IN ('Pending approval','Ready to dispatch','In transit','Awaiting receipt','Partially received','Issue reported','Completed','Cancelled','Rejected')),
"reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
CHECK ("sourceId" <> "destinationId"));
CREATE TABLE "BranchTransferItem" (
"id" TEXT PRIMARY KEY, "transferId" TEXT NOT NULL REFERENCES "BranchTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
"resourceId" TEXT NOT NULL REFERENCES "Resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
"status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','RECEIVED','ISSUE','CANCELLED')),
"notes" TEXT NOT NULL DEFAULT '', "evidenceName" TEXT, "evidenceMime" TEXT, "evidence" BYTEA,
UNIQUE ("transferId","resourceId"));
CREATE TABLE "BranchTransferEvent" (
"id" TEXT PRIMARY KEY, "transferId" TEXT NOT NULL REFERENCES "BranchTransfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
"actorId" TEXT NOT NULL, "actorName" TEXT NOT NULL, "action" TEXT NOT NULL, "notes" TEXT NOT NULL DEFAULT '',
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "BranchTransfer_sourceId_status_idx" ON "BranchTransfer"("sourceId","status");
CREATE INDEX "BranchTransfer_destinationId_status_idx" ON "BranchTransfer"("destinationId","status");
CREATE INDEX "BranchTransferItem_resourceId_status_idx" ON "BranchTransferItem"("resourceId","status");
CREATE INDEX "BranchTransferEvent_transferId_createdAt_idx" ON "BranchTransferEvent"("transferId","createdAt");
CREATE UNIQUE INDEX "BranchTransferItem_open_resource" ON "BranchTransferItem"("resourceId") WHERE "status" IN ('PENDING','ISSUE');
