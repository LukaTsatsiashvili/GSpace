-- Add optional department ownership without deleting or moving existing records.
ALTER TABLE "Resource" ADD COLUMN "departmentId" TEXT REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Resource_departmentId_status_idx" ON "Resource"("departmentId","status");
ALTER TABLE "BranchTransfer" ADD COLUMN "sourceDepartmentId" TEXT REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE, ADD COLUMN "destinationDepartmentId" TEXT REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Only backfill assets with exactly one identifiable current custodian in an active office department.
WITH candidates AS (
 SELECT ai."resourceId", min(u."departmentId") AS department_id
 FROM "AssignmentItem" ai JOIN "Assignment" a ON a.id=ai."assignmentId"
 JOIN "User" u ON u.id=a."recipientId" JOIN "Department" d ON d.id=u."departmentId"
 JOIN "Resource" r ON r.id=ai."resourceId" JOIN "Branch" b ON b.id=r."branchId"
 WHERE r.status='ASSIGNED' AND d.active AND d."branchId"=r."branchId" AND u."branchId"=r."branchId"
 AND (b.kind='OFFICE' OR (b.kind='LEGACY' AND b.code='HEAD_OFFICE'))
 AND ai.status IN ('PENDING','ACCEPTED','ISSUE_REPORTED','RETURN_REQUESTED','TRANSFER_PENDING')
 AND NOT (ai."sourceItemId" IS NOT NULL AND ai.status IN ('PENDING','ISSUE_REPORTED'))
 GROUP BY ai."resourceId" HAVING count(*)=1
)
UPDATE "Resource" r SET "departmentId"=c.department_id FROM candidates c WHERE r.id=c."resourceId";
