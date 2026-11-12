import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAccessBranch } from './access-policy.js';
import { hashPassword, normalizeEmail, verifyPassword } from './password.js';

test('scrypt stores a salted hash and verifies the original password', async () => {
  const raw = 'strong passphrase for a real employee 2026!';
  const encoded = await hashPassword(raw);
  assert.ok(encoded.startsWith('scrypt$v1$'));
  assert.ok(!encoded.includes(raw));
  assert.equal(await verifyPassword(raw, encoded), true);
  assert.equal(await verifyPassword(raw + '?', encoded), false);
  assert.notEqual(encoded, await hashPassword(raw));
});

test('password policy rejects short passwords and broken hashes', async () => {
  await assert.rejects(hashPassword('12345'));
  const minimum = await hashPassword('123456');
  assert.equal(await verifyPassword('123456', minimum), true);
  assert.equal(await verifyPassword('12345', minimum), false);
  assert.equal(await verifyPassword('a', 'invalid'), false);
});

test('emails are normalized; branch scope defaults to restricted', () => {
  assert.equal(normalizeEmail('  Admin@Example.COM '), 'admin@example.com');
  assert.equal(canAccessBranch('EMPLOYEE', 'BR-1', 'BR-2'), false);
  assert.equal(canAccessBranch('BRANCH_MANAGER', 'BR-1', 'BR-1'), true);
  assert.equal(canAccessBranch('SYSTEM_ADMIN', 'BR-1', 'BR-2'), true);
});
