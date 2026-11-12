-- Organization directory; additive migration preserving existing users and branches.
ALTER TABLE "Branch" ADD COLUMN "city" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Branch" ADD COLUMN "managerId" TEXT;
ALTER TABLE "Department" ADD COLUMN "leadUserId" TEXT;

CREATE INDEX "Branch_managerId_idx" ON "Branch"("managerId");
CREATE INDEX "Department_leadUserId_idx" ON "Department"("leadUserId");

ALTER TABLE "Branch" ADD CONSTRAINT "Branch_managerId_fkey"
  FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_leadUserId_fkey"
  FOREIGN KEY ("leadUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
