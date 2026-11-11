-- Non-destructive extension of the identity foundation.
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
ALTER TABLE "UserCredential" ADD COLUMN "loginDisabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AccountInvitation" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AccountInvitation_tokenHash_key" ON "AccountInvitation"("tokenHash");
CREATE INDEX "AccountInvitation_userId_usedAt_idx" ON "AccountInvitation"("userId", "usedAt");
CREATE INDEX "AccountInvitation_expiresAt_idx" ON "AccountInvitation"("expiresAt");
ALTER TABLE "AccountInvitation" ADD CONSTRAINT "AccountInvitation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
