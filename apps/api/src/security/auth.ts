import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { db } from '../db.js';
import type { PermissionKey } from './access-policy.js';

const isProduction = process.env.NODE_ENV === 'production';
const origin = new URL(process.env.WEB_ORIGIN || 'http://localhost:5173').origin;
const secret = process.env.AUTH_SECRET;
if (!secret || secret.startsWith('REPLACE_WITH_') || Buffer.byteLength(secret, 'utf8') < 32) {
  throw new Error('AUTH_SECRET must be set to at least 32 random bytes (do not commit it).');
}
if (isProduction && !origin.startsWith('https://')) {
  throw new Error('Production WEB_ORIGIN must use HTTPS.');
}
const signingKey: string = secret;
const sessionCookieName = isProduction ? '__Host-gspace_session' : 'gspace_session';
const csrfCookieName = isProduction ? '__Host-gspace_csrf' : 'gspace_csrf';
const lifetimeMs = 8 * 60 * 60 * 1000;
const idleMs = 30 * 60 * 1000;

export const httpCookieSettings = {
  secure: isProduction,
  httpOnly: true,
  sameSite: 'strict' as const,
  path: '/'
};

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export function randomSessionToken() {
  return randomBytes(32).toString('base64url');
}
export function privateSubjectKey(subject: string) {
  return createHmac('sha256', signingKey).update(subject).digest('hex');
}
export function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0 || part.slice(0, i).trim() !== name) continue;
    return part.slice(i + 1).trim();
  }
  return undefined;
}
function sameToken(a: string | undefined, b: string | undefined) {
  if (!a || !b || a.length > 128 || b.length > 128) return false;
  const aa = Buffer.from(a), bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export const csrfGuard: RequestHandler = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const headerOrigin = req.headers.origin;
  if (headerOrigin && headerOrigin !== origin) {
    res.status(403).json({ error: { code: 'INVALID_ORIGIN', message: 'Request origin not allowed' } });
    return;
  }
  if (!req.is('application/json')) {
    res.status(415).json({ error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'JSON is required' } });
    return;
  }
  const header = req.header('x-csrf-token');
  if (!sameToken(header, readCookie(req, csrfCookieName))) {
    res.status(403).json({ error: { code: 'INVALID_CSRF', message: 'Invalid or missing request token' } });
    return;
  }
  next();
};

export function issueCsrfToken(_req: Request, res: Response) {
  const token = randomSessionToken();
  res.cookie(csrfCookieName, token, { ...httpCookieSettings, maxAge: lifetimeMs });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ csrfToken: token });
}
export function setSessionCookie(res: Response, token: string) {
  res.cookie(sessionCookieName, token, { ...httpCookieSettings, maxAge: lifetimeMs });
}
export function clearSessionCookie(res: Response) {
  res.clearCookie(sessionCookieName, httpCookieSettings);
}
export function currentSessionToken(req: Request) {
  return readCookie(req, sessionCookieName);
}

export type AuthPrincipal = {
  userId: string;
  email: string;
  fullName: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  branchId: string;
  branchName: string;
  department: null | { id: string; name: string };
  permissions: string[];
  sessionId: string;
  mustChangePassword: boolean;
};
export function principal(res: Response): AuthPrincipal {
  const value = res.locals.auth as AuthPrincipal | undefined;
  if (!value) throw new Error('Route requires authentication middleware');
  return value;
}
export function publicPrincipal(value: AuthPrincipal) {
  return {
    id: value.userId, email: value.email, fullName: value.fullName,
    role: { key: value.roleKey, name: value.roleName, permissions: value.permissions },
    branch: { id: value.branchId, name: value.branchName },
    department: value.department, mustChangePassword: value.mustChangePassword
  };
}
export const requireAuth: RequestHandler = async (req, res, next: NextFunction) => {
  try {
    const token = currentSessionToken(req);
    if (!token || token.length > 128) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } });
      return;
    }
    const session = await db.session.findUnique({
      where: { tokenHash: hashSessionToken(token) },
      include: { user: { include: {
        branch: true, department: true, credential: true,
        role: { include: { grants: { include: { permission: true } } } }
      } } }
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now ||
        session.lastSeenAt.getTime() + idleMs <= now.getTime() ||
        !session.user.active || !session.user.branch.active || !session.user.role.active) {
      clearSessionCookie(res);
      res.status(401).json({ error: { code: 'SESSION_EXPIRED', message: 'Session expired or revoked' } });
      return;
    }
    // No permission caching: role changes take effect on the next API request.
    res.locals.auth = {
      userId: session.user.id, email: session.user.email,
      fullName: session.user.fullName, roleId: session.user.role.id,
      roleKey: session.user.role.key, roleName: session.user.role.name,
      branchId: session.user.branchId, branchName: session.user.branch.name,
      department: session.user.department ? { id: session.user.department.id, name: session.user.department.name } : null,
      permissions: session.user.role.grants.map(g => g.permission.key),
      mustChangePassword: !!session.user.credential?.mustChangePassword,
      sessionId: session.id
    } satisfies AuthPrincipal;
    if (now.getTime() - session.lastSeenAt.getTime() > 60_000) {
      await db.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { lastSeenAt: now } });
    }
    next();
  } catch (error) { next(error); }
};

export function requirePermission(permission: PermissionKey): RequestHandler {
  return (_req, res, next) => {
    const auth = principal(res);
    if (!auth.permissions.includes(permission)) {
      res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient permission' } });
      return;
    }
    next();
  };
}
