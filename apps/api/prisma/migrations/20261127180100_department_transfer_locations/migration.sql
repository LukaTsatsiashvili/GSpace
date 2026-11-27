-- Preserve rejection of identical locations; distinct office departments are separate custody locations.
ALTER TABLE "BranchTransfer" DROP CONSTRAINT "BranchTransfer_check";
ALTER TABLE "BranchTransfer" ADD CONSTRAINT "BranchTransfer_distinct_location_check" CHECK ("sourceId" <> "destinationId" OR ("sourceDepartmentId" IS NOT NULL AND "destinationDepartmentId" IS NOT NULL AND "sourceDepartmentId" <> "destinationDepartmentId"));
