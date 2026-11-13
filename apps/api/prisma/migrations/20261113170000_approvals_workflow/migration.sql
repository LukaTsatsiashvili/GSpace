-- Requests & Approvals: versioned definitions, workflow decisions and immutable timeline.
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING','CHANGES_REQUESTED','APPROVED','REJECTED','CANCELLED');
CREATE TYPE "ApprovalReviewStatus" AS ENUM ('PENDING','APPROVED','REJECTED','CHANGES_REQUESTED','SKIPPED');

CREATE TABLE "ApprovalType" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalType_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ApprovalTypeVersion" (
  "id" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "fields" JSONB NOT NULL DEFAULT '[]',
  "steps" JSONB NOT NULL DEFAULT '[]',
  "deadlineDays" INTEGER NOT NULL DEFAULT 3,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalTypeVersion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ApprovalCounter" (
  "name" TEXT NOT NULL,
  "nextNumber" INTEGER NOT NULL,
  CONSTRAINT "ApprovalCounter_pkey" PRIMARY KEY ("name")
);
CREATE TABLE "ApprovalRequest" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "amount" DECIMAL(18,2),
  "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
  "currentStep" INTEGER NOT NULL DEFAULT 0,
  "values" JSONB NOT NULL DEFAULT '{}',
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ApprovalReview" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "step" INTEGER NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "status" "ApprovalReviewStatus" NOT NULL DEFAULT 'PENDING',
  "comment" TEXT NOT NULL DEFAULT '',
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "ApprovalReview_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ApprovalEvent" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "comment" TEXT NOT NULL DEFAULT '',
  "details" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApprovalType_code_key" ON "ApprovalType"("code");
CREATE UNIQUE INDEX "ApprovalTypeVersion_typeId_version_key" ON "ApprovalTypeVersion"("typeId","version");
CREATE UNIQUE INDEX "ApprovalRequest_code_key" ON "ApprovalRequest"("code");
CREATE INDEX "ApprovalRequest_branchId_status_createdAt_idx" ON "ApprovalRequest"("branchId","status","createdAt");
CREATE INDEX "ApprovalRequest_requesterId_createdAt_idx" ON "ApprovalRequest"("requesterId","createdAt");
CREATE INDEX "ApprovalRequest_typeId_createdAt_idx" ON "ApprovalRequest"("typeId","createdAt");
CREATE UNIQUE INDEX "ApprovalReview_requestId_step_reviewerId_key" ON "ApprovalReview"("requestId","step","reviewerId");
CREATE INDEX "ApprovalReview_reviewerId_status_idx" ON "ApprovalReview"("reviewerId","status");
CREATE INDEX "ApprovalEvent_requestId_createdAt_idx" ON "ApprovalEvent"("requestId","createdAt");

ALTER TABLE "ApprovalTypeVersion" ADD CONSTRAINT "ApprovalTypeVersion_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ApprovalType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "ApprovalType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ApprovalTypeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalReview" ADD CONSTRAINT "ApprovalReview_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalReview" ADD CONSTRAINT "ApprovalReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalEvent" ADD CONSTRAINT "ApprovalEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
