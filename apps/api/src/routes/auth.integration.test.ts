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
