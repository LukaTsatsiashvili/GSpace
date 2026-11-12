import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { app } from '../app.js';
import { db } from '../db.js';

test('session login, CSRF, RBAC directory read and logout', { skip: !process.env.AUTH_INTEGRATION_TEST }, async () => {
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP address');
  const base = 'http://127.0.0.1:' + address.port;
  try {
    const unauth = await fetch(base + '/api/v1/auth/me');
    assert.equal(unauth.status, 401);

    const csrfResponse = await fetch(base + '/api/v1/auth/csrf');
    assert.equal(csrfResponse.status, 200);
    const csrf = await csrfResponse.json() as { csrfToken: string };
    const csrfCookie = csrfResponse.headers.get('set-cookie')?.split(';')[0];
    assert.ok(csrfCookie);

    const noCsrf = await fetch(base + '/api/v1/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: process.env.BOOTSTRAP_ADMIN_EMAIL, password: process.env.BOOTSTRAP_ADMIN_PASSWORD })
    });
    assert.equal(noCsrf.status, 403);

    const login = await fetch(base + '/api/v1/auth/login', {
      method: 'POST',
      headers: { cookie: csrfCookie, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({ email: process.env.BOOTSTRAP_ADMIN_EMAIL, password: process.env.BOOTSTRAP_ADMIN_PASSWORD })
    });
    assert.equal(login.status, 200);
    const sessionCookie = login.headers.get('set-cookie')?.split(';')[0];
    assert.ok(sessionCookie);
    const both = csrfCookie + '; ' + sessionCookie;

    const me = await fetch(base + '/api/v1/auth/me', { headers: { cookie: both } });
    assert.equal(me.status, 200);
    const data = await me.json() as { user: { role: { key: string; permissions: string[] } } };
    assert.equal(data.user.role.key, 'SYSTEM_ADMIN');
    assert.ok(data.user.role.permissions.includes('users.manage'));

    const directory = await fetch(base + '/api/v1/admin/users', { headers: { cookie: both } });
    assert.equal(directory.status, 200);
    const directoryData = await directory.json() as { users: unknown[] };
    assert.equal(directoryData.users.length, 1);

    const roles = await fetch(base + '/api/v1/admin/roles', { headers: { cookie: both } });
    assert.equal(roles.status, 200);
    const roleData = await roles.json() as { roles: { id: string; code: string; protected: boolean }[] };
    const system = roleData.roles.find(r => r.code === 'SYSTEM_ADMIN');
    assert.ok(system?.protected);

    const badRole = await fetch(base + '/api/v1/admin/roles', {
      method: 'POST', headers: { cookie: both, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({
        code: 'TEST_ROLE', name: 'Test Role', description: 'Temporary role',
        permissions: ['permission.does-not-exist']
      })
    });
    assert.equal(badRole.status, 400);

    const createRole = await fetch(base + '/api/v1/admin/roles', {
      method: 'POST', headers: { cookie: both, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({
        code: 'TEST_ROLE', name: 'Test Role', description: 'Temporary role',
        permissions: ['assets.view']
      })
    });
    assert.equal(createRole.status, 201);
    const createdRole = await createRole.json() as { id: string };
    assert.ok(createdRole.id);

    const editRole = await fetch(base + '/api/v1/admin/roles/' + createdRole.id, {
      method: 'PATCH', headers: { cookie: both, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({
        name: 'Test Role Updated', description: 'Changed by admin',
        permissions: ['assets.view', 'assets.edit']
      })
    });
    assert.equal(editRole.status, 200);

    const edited = await db.role.findUniqueOrThrow({
      where: { id: createdRole.id }, include: { grants: { include: { permission: true } } }
    });
    assert.equal(edited.name, 'Test Role Updated');
    assert.deepEqual(edited.grants.map(g => g.permission.key).sort(), ['assets.edit', 'assets.view']);

    const protectedEdit = await fetch(base + '/api/v1/admin/roles/' + system.id, {
      method: 'PATCH', headers: { cookie: both, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({
        name: 'Corrupted System Admin', description: 'Unsafe',
        permissions: ['assets.view']
      })
    });
    assert.equal(protectedEdit.status, 403);

    const logout = await fetch(base + '/api/v1/auth/logout', {
      method: 'POST', headers: { cookie: both, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken }, body: '{}'
    });
    assert.equal(logout.status, 204);
    const after = await fetch(base + '/api/v1/auth/me', { headers: { cookie: both } });
    assert.equal(after.status, 401);
  } finally {
    server.close();
    await db.$disconnect();
  }
});
