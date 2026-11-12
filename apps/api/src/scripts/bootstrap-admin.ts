import 'dotenv/config';
import { z } from 'zod';
import { db } from '../db.js';
import { seedAccessPolicy } from '../security/access-policy.js';
import { hashPassword, normalizeEmail } from '../security/password.js';

const input = z.object({
  BOOTSTRAP_ADMIN_EMAIL: z.string().trim().email().max(254),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(3).max(200),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(15).max(1024)
}).parse(process.env);

async function main() {
  // Only for a fresh system. Never mutate an existing user through bootstrap.
  if (await db.user.count() > 0) {
    throw new Error('Bootstrap refused: one or more users already exist.');
  }
  await seedAccessPolicy(db);
  const role = await db.role.findUniqueOrThrow({ where: { key: 'SYSTEM_ADMIN' } });
  const branch = await db.branch.upsert({
    where: { code: 'HEAD_OFFICE' }, update: {},
    create: { code: 'HEAD_OFFICE', name: 'Head Office' }
  });
  const passwordHash = await hashPassword(input.BOOTSTRAP_ADMIN_PASSWORD);
  const result = await db.user.create({
    data: {
      email: normalizeEmail(input.BOOTSTRAP_ADMIN_EMAIL),
      fullName: input.BOOTSTRAP_ADMIN_NAME,
      roleId: role.id, branchId: branch.id,
      credential: { create: { passwordHash } }
    }
  });
  await db.securityAuditEvent.create({ data: {
    action: 'BOOTSTRAP_ADMIN_CREATED', success: true, actorUserId: result.id, targetUserId: result.id
  } });
  console.info('Initial System Administrator created:', result.email);
  console.info('Remove BOOTSTRAP_ADMIN_PASSWORD from the environment after initialization.');
}

main().catch(err => {
  console.error('Bootstrap aborted:', err instanceof Error ? err.message : 'Unexpected error');
  process.exitCode = 1;
}).finally(() => db.$disconnect());
