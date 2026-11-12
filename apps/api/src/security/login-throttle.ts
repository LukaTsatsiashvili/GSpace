import { db } from '../db.js';
import { privateSubjectKey } from './auth.js';

export function loginKey(email: string) {
  return privateSubjectKey('login-account:' + email);
}
export async function loginBlocked(key: string) {
  const record = await db.authThrottle.findUnique({ where: { key } });
  return !!record?.blockedUntil && record.blockedUntil.getTime() > Date.now();
}
export async function recordFailedLogin(key: string) {
  const attempt = await db.authThrottle.upsert({
    where: { key }, create: { key, failures: 1 },
    update: { failures: { increment: 1 } }
  });
  if (attempt.failures >= 5) {
    const seconds = Math.min(900, 30 * 2 ** Math.min(5, attempt.failures - 5));
    await db.authThrottle.update({
      where: { key }, data: { blockedUntil: new Date(Date.now() + seconds * 1000) }
    });
  }
}
export async function resetLoginThrottle(key: string) {
  await db.authThrottle.deleteMany({ where: { key } });
}
