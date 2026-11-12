import 'dotenv/config';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { app } from '../app.js';
import { db } from '../db.js';
import { hashPassword } from '../security/password.js';

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


    // Branch and department CRUD: actual database writes and cross-branch safeguards.
    const organization = await fetch(base + '/api/v1/admin/organization', { headers: { cookie: both } });
    assert.equal(organization.status, 200);
    const initialOrg = await organization.json() as { branches: { id: string; code: string }[] };
    assert.ok(initialOrg.branches.some(branch => branch.code === 'HEAD_OFFICE'));

    const orgWrite = (path: string, method: 'POST' | 'PATCH', body: object, cookies = both) =>
      fetch(base + '/api/v1/admin/organization' + path, {
        method, headers: { cookie: cookies, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
        body: JSON.stringify(body)
      });
    const createBranch = await orgWrite('/branches', 'POST', {
      name: 'Test Organization Branch', code: 'TEST_ORG_BRANCH',
      city: 'Tbilisi', managerId: null, active: true
    });
    assert.equal(createBranch.status, 201);
    const branchId = (await createBranch.json() as { id: string }).id;
    assert.ok(branchId);
    assert.equal((await db.branch.findUniqueOrThrow({ where: { id: branchId } })).city, 'Tbilisi');

    const duplicate = await orgWrite('/branches', 'POST', {
      name: 'test organization branch', code: 'TEST_ORG_OTHER',
      city: '', managerId: null, active: true
    });
    assert.equal(duplicate.status, 409);

    const createDepartment = await orgWrite('/departments', 'POST', {
      name: 'Support', branchId, leadUserId: null, active: true
    });
    assert.equal(createDepartment.status, 201);
    const departmentId = (await createDepartment.json() as { id: string }).id;
    assert.equal((await db.department.findUniqueOrThrow({ where: { id: departmentId } })).name, 'Support');

    const disableBranchWithDepartment = await orgWrite('/branches/' + branchId, 'PATCH', {
      name: 'Test Organization Branch', city: 'Tbilisi', managerId: null, active: false
    });
    assert.equal(disableBranchWithDepartment.status, 409);

    const updateDepartment = await orgWrite('/departments/' + departmentId, 'PATCH', {
      name: 'Support Operations', branchId, leadUserId: null, active: false
    });
    assert.equal(updateDepartment.status, 200);
    assert.equal((await db.department.findUniqueOrThrow({ where: { id: departmentId } })).active, false);

    // A user from a different branch cannot be assigned as the department lead.
    const adminIdentity = await db.user.findUniqueOrThrow({
      where: { email: process.env.BOOTSTRAP_ADMIN_EMAIL }
    });
    const invalidLead = await orgWrite('/departments/' + departmentId, 'PATCH', {
      name: 'Support Operations', branchId, leadUserId: adminIdentity.id, active: true
    });
    assert.equal(invalidLead.status, 400);

    const deactivateBranch = await orgWrite('/branches/' + branchId, 'PATCH', {
      name: 'Test Organization Branch', city: 'Tbilisi', managerId: null, active: false
    });
    assert.equal(deactivateBranch.status, 200);
    assert.equal((await db.branch.findUniqueOrThrow({ where: { id: branchId } })).active, false);

    // Employee accounts must not have directory or administration access.
    const employeeRole = await db.role.findUniqueOrThrow({ where: { key: 'EMPLOYEE' } });
    const password = 'Organization integration test passphrase';
    const employee = await db.user.create({
      data: { email: 'test-organization-employee@example.test', fullName: 'Org Test Employee',
        active: true, roleId: employeeRole.id, branchId: adminIdentity.branchId,
        credential: { create: { passwordHash: await hashPassword(password) } } }
    });
    const loginEmployee = await fetch(base + '/api/v1/auth/login', {
      method: 'POST',
      headers: { cookie: csrfCookie, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({ email: employee.email, password })
    });
    assert.equal(loginEmployee.status, 200);
    const employeeCookie = loginEmployee.headers.get('set-cookie')?.split(';')[0];
    assert.ok(employeeCookie);
    const employeeCookies = csrfCookie + '; ' + employeeCookie;
    const employeeRead = await fetch(base + '/api/v1/admin/organization', {
      headers: { cookie: employeeCookies }
    });
    assert.equal(employeeRead.status, 403);
    const employeeWrite = await orgWrite('/departments', 'POST', {
      name: 'Forbidden Department', branchId: adminIdentity.branchId, leadUserId: null, active: true
    }, employeeCookies);
    assert.equal(employeeWrite.status, 403);

    // Organization leadership follows employee branch changes.
    const headOfficeRecord = await db.branch.findUniqueOrThrow({ where: { code: 'HEAD_OFFICE' } });
    const setManager = await orgWrite('/branches/' + headOfficeRecord.id, 'PATCH', {
      name: headOfficeRecord.name, city: headOfficeRecord.city, managerId: employee.id, active: true
    });
    assert.equal(setManager.status, 200);
    const assignLead = await orgWrite('/departments', 'POST', {
      name: 'Employee Leadership Test', branchId: headOfficeRecord.id,
      leadUserId: employee.id, active: true
    });
    assert.equal(assignLead.status, 201);
    const leadDepartmentId = (await assignLead.json() as { id: string }).id;
    const reactivateBranch = await orgWrite('/branches/' + branchId, 'PATCH', {
      name: 'Test Organization Branch', city: 'Tbilisi', managerId: null, active: true
    });
    assert.equal(reactivateBranch.status, 200);

    const transferEmployee = await fetch(base + '/api/v1/admin/users/' + employee.id, {
      method: 'PATCH', headers: {
        cookie: both, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken
      }, body: JSON.stringify({ branchId, departmentId: null })
    });
    assert.equal(transferEmployee.status, 200);
    assert.equal((await db.branch.findUniqueOrThrow({ where: { id: headOfficeRecord.id } })).managerId, null);
    assert.equal((await db.department.findUniqueOrThrow({ where: { id: leadDepartmentId } })).leadUserId, null);
    assert.ok((await db.securityAuditEvent.count({
      where: { action: 'ADMIN_ORGANIZATION_LEADERSHIP_CLEARED', targetUserId: employee.id }
    })) >= 1);

    assert.ok((await db.securityAuditEvent.count({ where: { action: 'ADMIN_BRANCH_CREATED' } })) >= 1);
    assert.ok((await db.securityAuditEvent.count({ where: { action: 'ADMIN_DEPARTMENT_UPDATED' } })) >= 1);

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
