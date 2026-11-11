import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { burnPasswordCheck, hashPassword, normalizeEmail, verifyPassword } from '../security/password.js';
import {
  clearSessionCookie, currentSessionToken, hashSessionToken, issueCsrfToken, principal,
  publicPrincipal, randomSessionToken, requireAuth, setSessionCookie, privateSubjectKey
} from '../security/auth.js';
import { loginBlocked, loginKey, recordFailedLogin, resetLoginThrottle } from '../security/login-throttle.js';

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024)
}).strict();
const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(15).max(1024)
}).strict();

const router = Router();
const asyncRoute = (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => { void fn(req, res).catch(next); };

router.get('/csrf', issueCsrfToken);

router.post('/login', asyncRoute(async (req, res) => {
  const input = loginSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Valid email and password required' } });
    return;
  }
  const email = normalizeEmail(input.data.email);
  const throttleKey = loginKey(email);
  if (await loginBlocked(throttleKey)) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts. Try later.' } });
    return;
  }
  const user = await db.user.findUnique({
    where: { email }, include: {
      credential: true, role: { include: { grants: { include: { permission: true } } } },
      branch: true, department: true
    }
  });
  const valid = user?.credential
    ? await verifyPassword(input.data.password, user.credential.passwordHash)
    : (await burnPasswordCheck(input.data.password), false);
  const eligible = !!user && !!valid && user.active && user.branch.active && user.role.active;
  if (!eligible) {
    await recordFailedLogin(throttleKey);
    await db.securityAuditEvent.create({ data: {
      action: 'AUTH_LOGIN_FAILED', success: false, subjectHash: privateSubjectKey('email:' + email)
    } });
    res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect, or the account is inactive' } });
    return;
  }
  if (!user) throw new Error('Unexpected missing account');

  await resetLoginThrottle(throttleKey);
  // Re-authentication rotates the session token; no session fixation.
  const token = randomSessionToken();
  const session = await db.session.create({ data: {
    userId: user.id, tokenHash: hashSessionToken(token),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
    userAgent: (req.header('user-agent') || '').slice(0, 300)
  } });
  await db.securityAuditEvent.create({ data: {
    action: 'AUTH_LOGIN_SUCCESS', success: true, actorUserId: user.id, targetUserId: user.id
  } });
  setSessionCookie(res, token);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ user: {
    id: user.id, email: user.email, fullName: user.fullName,
    role: { key: user.role.key, name: user.role.name, permissions: user.role.grants.map(g => g.permission.key) },
    branch: { id: user.branch.id, name: user.branch.name },
    department: user.department ? { id: user.department.id, name: user.department.name } : null,
    mustChangePassword: !!user.credential?.mustChangePassword
  }, sessionId: session.id });
}));

router.get('/me', requireAuth, (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ user: publicPrincipal(principal(res)) });
});

router.post('/logout', requireAuth, asyncRoute(async (_req, res) => {
  const auth = principal(res);
  await db.session.updateMany({ where: { id: auth.sessionId, userId: auth.userId, revokedAt: null }, data: { revokedAt: new Date() } });
  await db.securityAuditEvent.create({ data: {
    action: 'AUTH_LOGOUT', success: true, actorUserId: auth.userId, targetUserId: auth.userId
  } });
  clearSessionCookie(res);
  res.status(204).send();
}));

router.get('/sessions', requireAuth, asyncRoute(async (_req, res) => {
  const auth = principal(res);
  const now = new Date();
  const rows = await db.session.findMany({
    where: {
      userId: auth.userId, revokedAt: null, expiresAt: { gt: now },
      lastSeenAt: { gt: new Date(now.getTime() - 30 * 60 * 1000) }
    },
    select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true, userAgent: true },
    orderBy: { lastSeenAt: 'desc' }
  });
  res.json({ sessions: rows.map(row => ({ ...row, current: row.id === auth.sessionId })) });
}));

router.post('/sessions/revoke', requireAuth, asyncRoute(async (req, res) => {
  const input = z.object({ sessionId: z.string().uuid() }).strict().safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Valid session ID required' } });
    return;
  }
  const auth = principal(res);
  const changed = await db.session.updateMany({
    where: { id: input.data.sessionId, userId: auth.userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  if (!changed.count) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Active session not found' } });
    return;
  }
  await db.securityAuditEvent.create({ data: {
    action: 'AUTH_SESSION_REVOKED', success: true, actorUserId: auth.userId, targetUserId: auth.userId
  } });
  if (input.data.sessionId === auth.sessionId) clearSessionCookie(res);
  res.status(204).send();
}));

router.post('/change-password', requireAuth, asyncRoute(async (req, res) => {
  const input = passwordSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: { code: 'PASSWORD_POLICY', message: 'New password must have 15–1024 characters' } });
    return;
  }
  const auth = principal(res);
  const stored = await db.userCredential.findUnique({ where: { userId: auth.userId } });
  if (!stored || !await verifyPassword(input.data.currentPassword, stored.passwordHash)) {
    res.status(403).json({ error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });
    return;
  }
  if (input.data.currentPassword === input.data.newPassword) {
    res.status(400).json({ error: { code: 'PASSWORD_UNCHANGED', message: 'Choose a different password' } });
    return;
  }
  const hash = await hashPassword(input.data.newPassword);
  await db.$transaction(async tx => {
    await tx.userCredential.update({
      where: { userId: auth.userId },
      data: { passwordHash: hash, passwordChangedAt: new Date(), mustChangePassword: false }
    });
    await tx.session.updateMany({ where: { userId: auth.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.securityAuditEvent.create({ data: {
      action: 'AUTH_PASSWORD_CHANGED', success: true, actorUserId: auth.userId, targetUserId: auth.userId
    } });
  });
  clearSessionCookie(res);
  res.status(204).send();
}));

export default router;
