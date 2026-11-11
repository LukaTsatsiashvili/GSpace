-- Initial GSpace database baseline; requires a new/empty GSpace database.
CREATE TYPE "ResourceStatus" AS ENUM ('AVAILABLE', 'ASSIGNED', 'IN_TRANSFER', 'IN_MAINTENANCE', 'RETIRED');

CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "protected" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

CREATE TABLE "Permission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

CREATE TABLE "RolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

CREATE TABLE "Branch" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

CREATE TABLE "Department" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "branchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Department_branchId_name_key" ON "Department"("branchId","name");

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "roleId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "departmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "UserCredential" (
  "userId" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "UserCredential_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "userAgent" TEXT,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE TABLE "AuthThrottle" (
  "key" TEXT NOT NULL,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "blockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthThrottle_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "SecurityAuditEvent" (
  "id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "success" BOOLEAN NOT NULL,
  "actorUserId" TEXT,
  "targetUserId" TEXT,
  "subjectHash" TEXT,
  "details" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SecurityAuditEvent_actorUserId_createdAt_idx" ON "SecurityAuditEvent"("actorUserId", "createdAt");
CREATE INDEX "SecurityAuditEvent_action_createdAt_idx" ON "SecurityAuditEvent"("action", "createdAt");

CREATE TABLE "Resource" (
  "id" TEXT NOT NULL,
  "assetCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" "ResourceStatus" NOT NULL DEFAULT 'AVAILABLE',
  "branchId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Resource_assetCode_key" ON "Resource"("assetCode");

ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Department" ADD CONSTRAINT "Department_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserCredential" ADD CONSTRAINT "UserCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SecurityAuditEvent" ADD CONSTRAINT "SecurityAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SecurityAuditEvent" ADD CONSTRAINT "SecurityAuditEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
