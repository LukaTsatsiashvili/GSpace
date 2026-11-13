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

    // Resources: authenticated real CRUD, unique Asset IDs, documents, custom fields and bulk registration.
    const resourceApi = (path: string, method: 'POST' | 'PATCH' | 'DELETE', body: object) =>
      fetch(base + '/api/v1/resources' + path, {
        method, headers: { cookie: both, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
        body: JSON.stringify(body)
      });
    assert.equal((await fetch(base + '/api/v1/resources')).status, 401);
    const resourceCatalog = await fetch(base + '/api/v1/resources/catalog', { headers: { cookie: both } });
    assert.equal(resourceCatalog.status, 200);
    const catalogData = await resourceCatalog.json() as {
      categories: { name: string }[]; branches: { id: string; name: string }[]
    };
    assert.ok(catalogData.categories.some(value => value.name === 'Laptop'));
    const resourceBranchId = catalogData.branches.find(value => value.name === 'Head Office')?.id;
    assert.ok(resourceBranchId);
    const resourceTemplate = {
      name: 'Integration Test Laptop', category: 'Laptop', branchId: resourceBranchId,
      resourceType: 'Physical Asset', condition: 'Good', status: 'AVAILABLE',
      location: 'IT Office', serialNumber: 'INTEGRATION-123', description: 'Created by integration test',
      warrantyEnd: '2028-05-02', purchaseDate: '2026-10-20',
      purchasePrice: 1300.5, currency: 'GEL', supplier: 'Test Supplier',
      usefulLifeMonths: 36, residualValue: 100, customFields: { processor: 'Intel i7' }
    };
    const badResource = await resourceApi('/', 'POST', {
      ...resourceTemplate, name: '', documents: []
    });
    assert.equal(badResource.status, 400);
    const createdResource = await resourceApi('/', 'POST', {
      ...resourceTemplate, documents: [{ filename: 'invoice.pdf', mimeType: 'application/pdf',
        base64: Buffer.from('%PDF-1.7\nintegration test document').toString('base64') }]
    });
    assert.equal(createdResource.status, 201);
    const createdAsset = await createdResource.json() as { id: string; assetCode: string };
    assert.match(createdAsset.assetCode, /^AST-\d+$/);
    const stored = await db.resource.findUniqueOrThrow({ where: { id: createdAsset.id },
      include: { documents: true } });
    assert.equal(stored.name, resourceTemplate.name);
    assert.equal(stored.purchasePrice?.toString(), '1300.5');
    assert.equal(stored.documents.length, 1);
    const readResource = await fetch(base + '/api/v1/resources/' + createdAsset.id, {
      headers: { cookie: both }
    });
    assert.equal(readResource.status, 200);
    const readDetails = await readResource.json() as {
      resource: { documents: { id: string }[]; purchasePrice?: string }
    };
    assert.equal(readDetails.resource.purchasePrice, '1300.5');
    const doc = await fetch(base + '/api/v1/resources/' + createdAsset.id +
      '/documents/' + readDetails.resource.documents[0].id, { headers: { cookie: both } });
    assert.equal(doc.status, 200);
    assert.match(await doc.text(), /^%PDF-1.7/);


    // An existing asset accepts late attachments without a full edit or changes to its metadata.
    const lateFile = {
      filename: 'გარანტია.pdf', mimeType: 'application/pdf',
      base64: Buffer.from('%PDF-1.7\nextra warranty').toString('base64')
    };
    const missingCsrf = await fetch(base + '/api/v1/resources/' +
      createdAsset.id + '/documents', {
      method: 'POST', headers: { cookie: both, 'content-type': 'application/json' },
      body: JSON.stringify({ documents: [lateFile] })
    });
    assert.equal(missingCsrf.status, 403);

    const tooManyInBatch = await resourceApi('/' + createdAsset.id + '/documents', 'POST', {
      documents: Array.from({ length: 5 }, () => lateFile)
    });
    assert.equal(tooManyInBatch.status, 400);

    const lateUpload = await resourceApi('/' + createdAsset.id + '/documents', 'POST', {
      documents: [lateFile]
    });
    assert.equal(lateUpload.status, 201);
    const lateResult = await lateUpload.json() as {
      resource: { documents: { id: string; filename: string }[] }
    };
    assert.equal(lateResult.resource.documents.length, 2);
    const extraFile = lateResult.resource.documents.find(x => x.filename === lateFile.filename);
    assert.ok(extraFile);
    const downloadedExtra = await fetch(base + '/api/v1/resources/' + createdAsset.id +
      '/documents/' + extraFile.id, { headers: { cookie: both } });
    assert.equal(downloadedExtra.status, 200);
    assert.match(await downloadedExtra.text(), /extra warranty/);

    const invalidLate = await resourceApi('/' + createdAsset.id + '/documents', 'POST', {
      documents: [{ filename: 'fake.png', mimeType: 'image/png',
        base64: Buffer.from('%PDF-1.7\nnot PNG').toString('base64') }]
    });
    assert.equal(invalidLate.status, 400);
    const badDelete = await resourceApi('/' + createdAsset.id +
      '/documents/not-a-real-id', 'DELETE', {});
    assert.equal(badDelete.status, 404);
    const removedExtra = await resourceApi('/' + createdAsset.id +
      '/documents/' + extraFile.id, 'DELETE', {});
    assert.equal(removedExtra.status, 200);
    const remainingDocs = await removedExtra.json() as {
      resource: { documents: { id: string }[] }
    };
    assert.equal(remainingDocs.resource.documents.length, 1);
    const missingFile = await fetch(base + '/api/v1/resources/' + createdAsset.id +
      '/documents/' + extraFile.id, { headers: { cookie: both } });
    assert.equal(missingFile.status, 404);
    const auditOfFiles = await db.resourceAuditEvent.findMany({
      where: { resourceId: createdAsset.id,
        action: { in: ['DOCUMENT_ADDED', 'DOCUMENT_DELETED'] } }
    });
    assert.equal(auditOfFiles.length, 2);
    assert.equal(auditOfFiles.some(entry => entry.action === 'DOCUMENT_ADDED'), true);
    assert.equal(auditOfFiles.some(entry => entry.action === 'DOCUMENT_DELETED'), true);

    const updatedAsset = await resourceApi('/' + createdAsset.id, 'PATCH', {
      ...resourceTemplate, name: 'Integration Test Laptop Updated', status: 'RETIRED',
      documents: undefined
    });
    assert.equal(updatedAsset.status, 200);
    assert.equal((await db.resource.findUniqueOrThrow({ where: { id: createdAsset.id } })).status, 'RETIRED');
    const history = await fetch(base + '/api/v1/resources/' + createdAsset.id + '/audit', {
      headers: { cookie: both }
    });
    assert.equal(history.status, 200);
    const auditData = await history.json() as { events: { action: string }[] };
    assert.ok(auditData.events.some(v => v.action === 'CREATED'));
    assert.ok(auditData.events.some(v => v.action === 'UPDATED'));

    // Asset Manager is permitted to edit details, never to register new records or read financial data.
    const assetManagerRole = await db.role.findUniqueOrThrow({ where: { key: 'ASSET_MANAGER' } });
    const assetManagerPassword = 'asset-manager-long-passphrase';
    const assetManager = await db.user.create({ data: {
      email: 'resource-test-manager@example.test', fullName: 'Resource Test Manager',
      roleId: assetManagerRole.id, branchId: resourceBranchId,
      credential: { create: { passwordHash: await hashPassword(assetManagerPassword) } }
    } });
    const assetManagerLogin = await fetch(base + '/api/v1/auth/login', {
      method: 'POST', headers: { cookie: csrfCookie, 'content-type': 'application/json',
        'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({ email: assetManager.email, password: assetManagerPassword })
    });
    assert.equal(assetManagerLogin.status, 200);
    const assetCookie = assetManagerLogin.headers.get('set-cookie')?.split(';')[0];
    assert.ok(assetCookie);
    const assetHeaders = { cookie: csrfCookie + '; ' + assetCookie };
    const assetView = await fetch(base + '/api/v1/resources/' + createdAsset.id, {
      headers: assetHeaders
    });
    assert.equal(assetView.status, 200);
    const assetViewResult = await assetView.json() as { resource: { purchasePrice?: string } };
    assert.equal(assetViewResult.resource.purchasePrice, undefined);
    const assetEdit = await fetch(base + '/api/v1/resources/' + createdAsset.id, {
      method: 'PATCH', headers: { ...assetHeaders,
        'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({
        ...resourceTemplate, status: 'AVAILABLE', purchasePrice: null, purchaseDate: null,
        supplier: '', usefulLifeMonths: null, residualValue: null, location: 'Asset Manager Edited'
      })
    });
    assert.equal(assetEdit.status, 200);
    assert.equal((await db.resource.findUniqueOrThrow({ where: { id: createdAsset.id } })).purchasePrice?.toString(), '1300.5');
    // Resource editors can attach documents without the asset-creation grant.
    const managerUpload = await fetch(base + '/api/v1/resources/' +
      createdAsset.id + '/documents', {
      method: 'POST',
      headers: { ...assetHeaders, 'content-type': 'application/json',
        'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({ documents: [{
        filename: 'editor.pdf', mimeType: 'application/pdf',
        base64: Buffer.from('%PDF-1.7\neditor document').toString('base64')
      }] })
    });
    assert.equal(managerUpload.status, 201);

    const forbiddenCreate = await fetch(base + '/api/v1/resources', {
      method: 'POST', headers: { ...assetHeaders,
        'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({ ...resourceTemplate, documents: [] })
    });
    assert.equal(forbiddenCreate.status, 403);
    const forbiddenImport = await fetch(base + '/api/v1/resources/bulk/import', {
      method: 'POST', headers: { cookie: both, 'content-type': 'application/json',
        'x-csrf-token': csrf.csrfToken }, body: JSON.stringify({ resources: [] })
    });
    assert.equal(forbiddenImport.status, 404);


    const bulkTemplate = {
      ...resourceTemplate, name: 'Batch Laptop', serialNumber: undefined,
      purchaseDate: null, purchasePrice: null, supplier: '',
      usefulLifeMonths: null, residualValue: null
    };
    const bulk = await resourceApi('/bulk', 'POST', {
      template: bulkTemplate, quantity: 3
    });
    assert.equal(bulk.status, 201);
    const bulkResult = await bulk.json() as { count: number; firstCode: string; lastCode: string };
    assert.equal(bulkResult.count, 3);
    assert.notEqual(bulkResult.firstCode, createdAsset.assetCode);

    const customCategory = await resourceApi('/categories', 'POST', {
      name: 'Test New Equipment', definitions: [
        { key: 'identification', label: 'Identification', required: true }
      ]
    });
    assert.equal(customCategory.status, 201);
    const categoryId = (await customCategory.json() as { id: string }).id;
    const missingCustom = await resourceApi('/', 'POST', {
      ...resourceTemplate, category: 'Test New Equipment', customFields: {}, documents: []
    });
    assert.equal(missingCustom.status, 400);

    // Identical-item Bulk Create intentionally accepts incomplete required Custom Fields;
    // assets can be completed later through Edit Resource.
    const incompleteBatch = await resourceApi('/bulk', 'POST', {
      template: {
        ...bulkTemplate, category: 'Test New Equipment', customFields: {},
        location: 'Asset Storage'
      },
      quantity: 2
    });
    assert.equal(incompleteBatch.status, 201);
    const incompleteBatchResult = await incompleteBatch.json() as {
      count: number; firstCode: string; lastCode: string
    };
    assert.equal(incompleteBatchResult.count, 2);
    const incompleteResource = await db.resource.findUniqueOrThrow({
      where: { assetCode: incompleteBatchResult.firstCode }
    });
    assert.deepEqual(incompleteResource.customFields, {});
    assert.equal(incompleteResource.category, 'Test New Equipment');
    assert.equal(incompleteResource.status, 'AVAILABLE');

    // Document uploads operate independently of incomplete required custom fields.
    const documentsBeforeSpecifications = await resourceApi(
      '/' + incompleteResource.id + '/documents', 'POST', {
        documents: [{ filename: 'post-registration.pdf', mimeType: 'application/pdf',
          base64: Buffer.from('%PDF-1.7\nuploaded before specifications').toString('base64') }]
      }
    );
    assert.equal(documentsBeforeSpecifications.status, 201);
    const incompletelyRegistered = await documentsBeforeSpecifications.json() as {
      resource: { customFields: Record<string, string>; documents: { filename: string }[] }
    };
    assert.deepEqual(incompletelyRegistered.resource.customFields, {});
    assert.equal(incompletelyRegistered.resource.documents.length, 1);


    const stillRequiredOnEdit = await resourceApi('/' + incompleteResource.id, 'PATCH', {
      ...resourceTemplate, name: 'Completed Later', category: 'Test New Equipment',
      customFields: {}, status: 'AVAILABLE'
    });
    assert.equal(stillRequiredOnEdit.status, 400);
    const filledLater = await resourceApi('/' + incompleteResource.id, 'PATCH', {
      ...resourceTemplate, name: 'Completed Later', category: 'Test New Equipment',
      customFields: { identification: 'COMPLETED-EDIT-1' }, status: 'AVAILABLE'
    });
    assert.equal(filledLater.status, 200);
    assert.deepEqual((await db.resource.findUniqueOrThrow({
      where: { id: incompleteResource.id }
    })).customFields, { identification: 'COMPLETED-EDIT-1' });

    // Missing required specs do not waive other field validation or branch security.
    const invalidBulk = await resourceApi('/bulk', 'POST', {
      template: { ...bulkTemplate, category: 'Test New Equipment',
        customFields: {}, condition: 'Invalid condition' }, quantity: 2
    });
    assert.equal(invalidBulk.status, 400);

    const customResource = await resourceApi('/', 'POST', {
      ...resourceTemplate, name: 'Custom Equipment', category: 'Test New Equipment',
      customFields: { identification: 'TEST-RESOURCE-1' }, documents: []
    });
    assert.equal(customResource.status, 201);
    const cannotDisable = await resourceApi('/categories/' + categoryId, 'PATCH', {
      name: 'Test New Equipment', definitions: [
        { key: 'identification', label: 'Identification', required: true }
      ], active: false
    });
    assert.equal(cannotDisable.status, 409);

    const deleted = await resourceApi('/' + createdAsset.id, 'DELETE', {});
    assert.equal(deleted.status, 204);
    assert.equal(await db.resource.findUnique({ where: { id: createdAsset.id } }), null);
    assert.ok((await db.resourceAuditEvent.count({ where: { resourceId: createdAsset.id } })) >= 3);
    const resourceList = await fetch(base + '/api/v1/resources', { headers: { cookie: both } });
    assert.equal(resourceList.status, 200);
    const resourceSummary = await resourceList.json() as { summary: { total: number }; resources: unknown[] };
    assert.ok(resourceSummary.summary.total >= 6);

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
    // Persisted assignments: issue, recipient acknowledgement, and verified return.
    const assignmentWrite = (suffix: string, cookies: string, body: object) =>
      fetch(base + '/api/v1/assignments' + suffix, {
        method: 'POST',
        headers: { cookie: cookies, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
        body: JSON.stringify(body)
      });
    assert.equal((await fetch(base + '/api/v1/assignments')).status, 401);
    const peerLookups = await fetch(base + '/api/v1/assignments/lookups', { headers: { cookie: employeeCookies } });
    const peers = await peerLookups.json() as { recipients: { id: string }[]; availableAssets: unknown[] };
    assert.ok(peers.recipients.some(p => p.id === adminIdentity.id));
    assert.equal(peers.availableAssets.length, 0);

    // Regression: BranchManager has assignments.manage and a single-branch scope.
    // A Branch lookup must filter by Branch.id, not Resource/User.branchId.
    const scopedRole = await db.role.findUniqueOrThrow({ where: { key: 'BRANCH_MANAGER' } });
    const scopedManager = await db.user.create({
      data: {
        email: 'test-assignment-branch-manager@example.test',
        fullName: 'Assignment Branch Manager', active: true,
        roleId: scopedRole.id, branchId: adminIdentity.branchId,
        credential: { create: { passwordHash: await hashPassword(password) } }
      }
    });
    const managerLogin = await fetch(base + '/api/v1/auth/login', {
      method: 'POST',
      headers: { cookie: csrfCookie, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({ email: scopedManager.email, password })
    });
    assert.equal(managerLogin.status, 200);
    const managerSessionCookie = managerLogin.headers.get('set-cookie')?.split(';')[0];
    assert.ok(managerSessionCookie);
    const managerCookies = csrfCookie + '; ' + managerSessionCookie;
    const managerLookups = await fetch(base + '/api/v1/assignments/lookups', {
      headers: { cookie: managerCookies }
    });
    assert.equal(managerLookups.status, 200);
    const scopedLookups = await managerLookups.json() as {
      canManage: boolean;
      recipients: { branchId: string }[];
      availableAssets: { branchId: string }[];
      branches: { id: string }[]
    };
    assert.equal(scopedLookups.canManage, true);
    assert.deepEqual(scopedLookups.branches.map(value => value.id), [adminIdentity.branchId]);
    assert.ok(scopedLookups.recipients.every(value => value.branchId === adminIdentity.branchId));
    assert.ok(scopedLookups.availableAssets.every(value => value.branchId === adminIdentity.branchId));
    const deniedIssue = await assignmentWrite('/', employeeCookies, {
      recipientId: employee.id, resourceIds: [incompleteResource.id], dueAt: null, notes: ''
    });
    assert.equal(deniedIssue.status, 403);
    const createdAssignment = await assignmentWrite('/', both, {
      recipientId: employee.id, resourceIds: [incompleteResource.id], dueAt: null, notes: '=1+1'
    });
    assert.equal(createdAssignment.status, 201);
    const assignmentId = (await createdAssignment.json() as { id: string }).id;
    const item = await db.assignmentItem.findFirstOrThrow({ where: { assignmentId } });
    assert.equal((await db.resource.findUniqueOrThrow({ where: { id: incompleteResource.id } })).status, 'ASSIGNED');
    // Resources must reflect the recipient immediately, without inventing acceptance.
    const assignedResource = await fetch(base + '/api/v1/resources/' + incompleteResource.id,
      { headers: { cookie: both } });
    assert.equal(assignedResource.status, 200);
    const assignee = (await assignedResource.json() as {
      resource: { assignedTo: { userId: string; userName: string; itemStatus: string } }
    }).resource.assignedTo;
    assert.equal(assignee.userId, employee.id);
    assert.equal(assignee.itemStatus, 'PENDING');
    const assignedList = await fetch(base + '/api/v1/resources', { headers: { cookie: both } });
    const assignedListData = await assignedList.json() as {
      resources: { id: string; assignedTo: { userId: string } | null }[]
    };
    assert.equal(assignedListData.resources.find(resource => resource.id === incompleteResource.id)?.assignedTo?.userId, employee.id);
    const earlyHistory = await fetch(base + '/api/v1/resources/' + incompleteResource.id + '/assignments',
      { headers: { cookie: both } });
    assert.equal(earlyHistory.status, 200);
    const earlyHistoryData = await earlyHistory.json() as {
      current: { userId: string }; assignments: { assignmentCode: string; status: string }[]
    };
    assert.equal(earlyHistoryData.current.userId, employee.id);
    assert.equal(earlyHistoryData.assignments[0]?.status, 'PENDING');
    assert.equal((await assignmentWrite('/', both, {
      recipientId: employee.id, resourceIds: [incompleteResource.id], dueAt: null, notes: ''
    })).status, 409);
    assert.equal((await assignmentWrite('/' + assignmentId + '/receipt', both, {
      decisions: [{ itemId: item.id, decision: 'ACCEPT', notes: '' }]
    })).status, 403);
    assert.equal((await assignmentWrite('/' + assignmentId + '/receipt', employeeCookies, {
      decisions: [{ itemId: item.id, decision: 'REPORT_ISSUE',
        damageReported: true, notes: 'Damaged item reported' }]
    })).status, 400);
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XJioAAAAASUVORK5CYII=';
    assert.equal((await assignmentWrite('/' + assignmentId + '/receipt', employeeCookies, {
      decisions: [{ itemId: item.id, decision: 'ACCEPT', notes: 'Confirmed in test',
        evidence: { filename: 'receipt.png', mimeType: 'image/png', base64: tinyPng } }]
    })).status, 200);
    assert.equal((await fetch(base + '/api/v1/assignments/' + assignmentId +
      '/items/' + item.id + '/evidence', { headers: { cookie: employeeCookies } })).status, 200);
    assert.equal((await assignmentWrite('/' + assignmentId + '/receipt', employeeCookies, {
      decisions: [{ itemId: item.id, decision: 'ACCEPT', notes: 'Duplicate' }]
    })).status, 409);
    assert.equal((await assignmentWrite('/' + assignmentId + '/returns/request', employeeCookies, {
      itemIds: [item.id]
    })).status, 200);
    assert.equal((await assignmentWrite('/' + assignmentId + '/returns/verify', employeeCookies, {
      items: [{ itemId: item.id, condition: 'Good' }]
    })).status, 403);
    assert.equal((await assignmentWrite('/' + assignmentId + '/returns/verify', both, {
      items: [{ itemId: item.id, condition: 'Good' }]
    })).status, 200);
    assert.equal((await db.resource.findUniqueOrThrow({ where: { id: incompleteResource.id } })).status, 'AVAILABLE');
    const returnedHistory = await fetch(base + '/api/v1/resources/' + incompleteResource.id + '/assignments',
      { headers: { cookie: both } });
    const returnedResult = await returnedHistory.json() as {
      current: null | { userId: string }; assignments: { status: string }[]
    };
    assert.equal(returnedResult.current, null);
    assert.equal(returnedResult.assignments[0]?.status, 'RETURNED');
    assert.equal((await resourceApi('/' + incompleteResource.id, 'DELETE', {})).status, 409);
    const completed = await fetch(base + '/api/v1/assignments/' + assignmentId,
      { headers: { cookie: both } });
    assert.equal((await completed.json() as { assignment: { status: string } }).assignment.status, 'Completed');

    // Export is real CSV, limited to server-authorized handovers and audited.
    assert.equal((await assignmentWrite('/export', employeeCookies, { ids: [assignmentId] })).status, 403);
    assert.equal((await assignmentWrite('/export', managerCookies, { ids: [assignmentId] })).status, 403);
    assert.equal((await assignmentWrite('/export', both, { ids: [assignmentId, assignmentId] })).status, 400);
    const exportedAssignments = await assignmentWrite('/export', both, { ids: [assignmentId] });
    assert.equal(exportedAssignments.status, 200);
    assert.match(exportedAssignments.headers.get('content-type') ?? '', /text\/csv/);
    const csvText = await exportedAssignments.text();
    assert.match(csvText, /Assignment ID/);
    assert.ok(csvText.includes('=1+1'));
    assert.ok(csvText.includes("'=1+1")); // Excel formula injection is neutralized.
    assert.ok(csvText.includes(incompleteResource.assetCode));
    assert.ok((await db.securityAuditEvent.count({
      where: { action: 'ASSIGNMENTS_EXPORTED', actorUserId: adminIdentity.id }
    })) >= 1);

    // Employee-to-employee transfer retains custody until the new recipient accepts.
    const original = await assignmentWrite('/', both, {
      recipientId: employee.id, resourceIds: [incompleteResource.id], dueAt: null, notes: 'Transfer source'
    });
    assert.equal(original.status, 201);
    const originalId = (await original.json() as { id: string }).id;
    const originalItem = await db.assignmentItem.findFirstOrThrow({ where: { assignmentId: originalId } });
    assert.equal((await assignmentWrite('/' + originalId + '/receipt', employeeCookies, {
      decisions: [{ itemId: originalItem.id, decision: 'ACCEPT', notes: '' }]
    })).status, 200);
    const beginTransfer = () => assignmentWrite('/' + originalId + '/transfers', both, {
      recipientId: adminIdentity.id, itemIds: [originalItem.id], dueAt: null, notes: 'To colleague'
    });
    const firstTransfer = await beginTransfer();
    assert.equal(firstTransfer.status, 201);
    const transferId = (await firstTransfer.json() as { id: string }).id;
    assert.equal((await db.assignmentItem.findUniqueOrThrow({ where: { id: originalItem.id } })).status, 'TRANSFER_PENDING');
    const transferPendingResource = await fetch(base + '/api/v1/resources/' + incompleteResource.id,
      { headers: { cookie: both } });
    const transferPendingOwner = (await transferPendingResource.json() as {
      resource: { assignedTo: { userId: string; pendingRecipientName: string | null } }
    }).resource.assignedTo;
    assert.equal(transferPendingOwner.userId, employee.id);
    assert.equal(transferPendingOwner.pendingRecipientName, adminIdentity.fullName);
    assert.equal((await fetch(base + '/api/v1/assignments/' + transferId,
      { headers: { cookie: employeeCookies } })).status, 200);
    assert.equal((await assignmentWrite('/' + transferId + '/transfers/cancel', employeeCookies, {})).status, 200);
    assert.equal((await db.assignmentItem.findUniqueOrThrow({ where: { id: originalItem.id } })).status, 'ACCEPTED');
    const secondTransfer = await beginTransfer();
    assert.equal(secondTransfer.status, 201);
    const secondTransferId = (await secondTransfer.json() as { id: string }).id;
    const nextItem = await db.assignmentItem.findFirstOrThrow({ where: { assignmentId: secondTransferId } });
    assert.equal((await assignmentWrite('/' + secondTransferId + '/receipt', employeeCookies, {
      decisions: [{ itemId: nextItem.id, decision: 'ACCEPT', notes: '' }]
    })).status, 403);
    assert.equal((await assignmentWrite('/' + secondTransferId + '/receipt', both, {
      decisions: [{ itemId: nextItem.id, decision: 'ACCEPT', notes: '' }]
    })).status, 200);
    assert.equal((await db.assignmentItem.findUniqueOrThrow({ where: { id: originalItem.id } })).status, 'TRANSFERRED');
    const acceptedTransferResource = await fetch(base + '/api/v1/resources/' + incompleteResource.id,
      { headers: { cookie: both } });
    const acceptedOwner = (await acceptedTransferResource.json() as {
      resource: { assignedTo: { userId: string; itemStatus: string } }
    }).resource.assignedTo;
    assert.equal(acceptedOwner.userId, adminIdentity.id);
    assert.equal(acceptedOwner.itemStatus, 'ACCEPTED');
    assert.equal((await assignmentWrite('/' + secondTransferId + '/returns/request', both, {
      itemIds: [nextItem.id]
    })).status, 200);
    assert.equal((await assignmentWrite('/' + secondTransferId + '/returns/verify', both, {
      items: [{ itemId: nextItem.id, condition: 'Excellent' }]
    })).status, 200);
    assert.equal((await db.resource.findUniqueOrThrow({ where: { id: incompleteResource.id } })).status, 'AVAILABLE');
    assert.ok((await db.securityAuditEvent.count({ where: { action: 'ASSIGNMENT_TRANSFER_STARTED' } })) >= 1);

    const employeeRead = await fetch(base + '/api/v1/admin/organization', {
      headers: { cookie: employeeCookies }
    });
    assert.equal(employeeRead.status, 403);
    const readOnlyDocumentWrite = await fetch(base + '/api/v1/resources/' +
      createdAsset.id + '/documents', {
      method: 'POST', headers: { cookie: employeeCookies, 'content-type': 'application/json',
        'x-csrf-token': csrf.csrfToken },
      body: JSON.stringify({ documents: [{ filename: 'test.pdf',
        mimeType: 'application/pdf', base64: Buffer.from('%PDF-1.7\ntest').toString('base64') }] })
    });
    assert.equal(readOnlyDocumentWrite.status, 403);

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

    // The resource handover history API must respect the same branch boundary
    // as the resource register and must not leak another branch's personnel.
    const otherBranchCreated = await resourceApi('/', 'POST', {
      ...resourceTemplate, name: 'Second Branch Integration Laptop',
      branchId, serialNumber: 'CROSS-BRANCH-RESOURCE', documents: []
    });
    assert.equal(otherBranchCreated.status, 201);
    const otherBranchResource = await otherBranchCreated.json() as { id: string };
    assert.equal((await fetch(base + '/api/v1/resources/' + otherBranchResource.id + '/assignments',
      { headers: { cookie: managerCookies } })).status, 404);
    assert.equal((await fetch(base + '/api/v1/resources/' + otherBranchResource.id,
      { headers: { cookie: managerCookies } })).status, 404);

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


    // Administrator-issued reset link: the same activation endpoint accepts a six-character password.
    const issueReset = await fetch(base + '/api/v1/admin/users/' + employee.id + '/reset-password', {
      method: 'POST', headers: {
        cookie: both, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken
      }, body: JSON.stringify({ reason: 'Employee requested a password reset.' })
    });
    assert.equal(issueReset.status, 200);
    const resetPath = (await issueReset.json() as { activationPath: string }).activationPath;
    const resetToken = new URLSearchParams(resetPath.split('#')[1]).get('activate');
    assert.ok(resetToken);
    const activatePassword = (passwordValue: string) => fetch(base + '/api/v1/auth/activate', {
      method: 'POST', headers: {
        cookie: csrfCookie, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken
      }, body: JSON.stringify({ token: resetToken, password: passwordValue })
    });
    assert.equal((await activatePassword('12345')).status, 400);
    assert.equal((await activatePassword('A1bcde')).status, 204);
    assert.equal((await activatePassword('A1bcde')).status, 400);

    const loginWith = (passwordValue: string) => fetch(base + '/api/v1/auth/login', {
      method: 'POST', headers: {
        cookie: csrfCookie, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken
      }, body: JSON.stringify({ email: employee.email, password: passwordValue })
    });
    assert.equal((await loginWith(password)).status, 401);
    const shortLogin = await loginWith('A1bcde');
    assert.equal(shortLogin.status, 200);
    const shortCookie = shortLogin.headers.get('set-cookie')?.split(';')[0];
    assert.ok(shortCookie);
    const activeEmployeeCookies = csrfCookie + '; ' + shortCookie;

    // Self-service password change requires the old password, protects against reuse, and revokes sessions.
    const change = (currentPassword: string, newPassword: string) => fetch(base + '/api/v1/auth/change-password', {
      method: 'POST', headers: {
        cookie: activeEmployeeCookies, 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken
      }, body: JSON.stringify({ currentPassword, newPassword })
    });
    assert.equal((await change('A1bcde', 'short')).status, 400);
    assert.equal((await change('incorrect', 'A1bcdef')).status, 403);
    assert.equal((await change('A1bcde', 'A1bcde')).status, 400);
    assert.equal((await change('A1bcde', 'A1bcdef')).status, 204);
    assert.equal((await fetch(base + '/api/v1/auth/me', { headers: { cookie: activeEmployeeCookies } })).status, 401);
    assert.equal((await loginWith('A1bcde')).status, 401);
    assert.equal((await loginWith('A1bcdef')).status, 200);
    assert.ok((await db.securityAuditEvent.count({
      where: { action: 'AUTH_PASSWORD_CHANGED', actorUserId: employee.id }
    })) >= 1);

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
