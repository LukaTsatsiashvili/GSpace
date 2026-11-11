import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';

export const INVITATION_TTL_MS = 60 * 60 * 1000;

/** Email provider is not configured yet. In production never reveal activation secrets in an API response. */
export const invitationsEnabled = process.env.NODE_ENV !== 'production';

export function inviteTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueInvitation(tx: Prisma.TransactionClient, userId: string, kind: 'ACTIVATE' | 'RESET') {
  await tx.accountInvitation.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  const token = randomBytes(32).toString('base64url');
  await tx.accountInvitation.create({
    data: { userId, tokenHash: inviteTokenHash(token), kind, expiresAt: new Date(Date.now() + INVITATION_TTL_MS) }
  });
  // Fragment secrets are not included in HTTP requests to the origin. Local development only.
  return '/#activate=' + encodeURIComponent(token);
}
