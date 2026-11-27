-- The beneficiary is a record-keeping Employee, not the signed-in requester.
ALTER TABLE "ApprovalTypeVersion" ADD COLUMN "beneficiaryRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ApprovalRequest" ADD COLUMN "beneficiaryId" TEXT;
CREATE INDEX "ApprovalRequest_beneficiaryId_createdAt_idx" ON "ApprovalRequest"("beneficiaryId", "createdAt");
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_beneficiaryId_fkey"
  FOREIGN KEY ("beneficiaryId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Employees cannot sign in or act as approvers/requesters. Branch managers can
-- create requests but must never decide them, even with old seeded role grants.
DELETE FROM "RolePermission" rp
USING "Role" r, "Permission" p
WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  AND (
    r."key" = 'EMPLOYEE'
    OR (r."key" = 'BRANCH_MANAGER' AND p."key" = 'approvals.review')
  );
