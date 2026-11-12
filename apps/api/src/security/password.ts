import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
const N = 1 << 17;
const r = 8;
const p = 1;
const maxmem = 256 * 1024 * 1024;
const hashBytes = 64;
const saltBytes = 32;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, hashBytes, { N, r, p, maxmem }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/** Native, memory-hard scrypt (OWASP fallback when Argon2id is unavailable). */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 15 || password.length > 1024) throw new Error('Password must be 15–1024 characters long.');
  const salt = randomBytes(saltBytes);
  const digest = await derive(password, salt);
  return ['scrypt', 'v1', String(N), String(r), String(p), salt.toString('base64url'), digest.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 7 || parts[0] !== 'scrypt' || parts[1] !== 'v1') return false;
  const n = Number(parts[2]), rr = Number(parts[3]), pp = Number(parts[4]);
  if (n !== N || rr !== r || pp !== p) return false;
  const salt = Buffer.from(parts[5], 'base64url');
  const expected = Buffer.from(parts[6], 'base64url');
  if (salt.length !== saltBytes || expected.length !== hashBytes) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected);
}

/** Equalize expensive password work for unknown users; never expose user existence. */
export async function burnPasswordCheck(password: string): Promise<void> {
  const salt = randomBytes(saltBytes);
  await derive(password, salt);
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
