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

test('retail store login is restricted to branch managers, employees remain directory-only', async()=>{const {canLoginAtBranch}=await import('./organization-policy.js');assert.equal(canLoginAtBranch('BRANCH_MANAGER','STORE'),true);for(const role of ['EMPLOYEE','ASSET_MANAGER','AUDITOR','SYSTEM_ADMIN','COMPANY_ADMIN','CUSTOM_ROLE'])assert.equal(canLoginAtBranch(role,'STORE'),false);assert.equal(canLoginAtBranch('SYSTEM_ADMIN','OFFICE'),true);assert.equal(canLoginAtBranch('EMPLOYEE','OFFICE'),false);assert.equal(canLoginAtBranch('SYSTEM_ADMIN','LEGACY'),true);});
test('store membership permits exactly manager and employee, regardless of login eligibility',async()=>{const {canBelongToBranch}=await import('./organization-policy.js');for(const key of ['BRANCH_MANAGER','EMPLOYEE'])assert.equal(canBelongToBranch(key,'STORE'),true);for(const key of ['SYSTEM_ADMIN','COMPANY_ADMIN','ASSET_MANAGER','AUDITOR','CUSTOM_ROLE'])assert.equal(canBelongToBranch(key,'STORE'),false);assert.equal(canBelongToBranch('ASSET_MANAGER','OFFICE'),true);});

test('department lead login is derived from active office appointments, never from store appointments',async()=>{const {canLoginUser,leadDepartments,effectivePermissions}=await import('./organization-policy.js');const u={id:'lead',active:true,branchId:'office',role:{key:'EMPLOYEE',active:true},branch:{kind:'OFFICE',code:'HEAD_OFFICE',active:true},ledDepartments:[{id:'dept',branchId:'office',active:true}]};assert.equal(canLoginUser(u),true);assert.deepEqual(leadDepartments(u),['dept']);assert.deepEqual(effectivePermissions(u,['users.manage']),['assets.view','assignments.manage','transfers.manage','inventory.manage','maintenance.manage','approvals.request']);assert.equal(canLoginUser({...u,ledDepartments:[]}),false);assert.equal(canLoginUser({...u,ledDepartments:[{id:'dept',branchId:'other',active:true}]}),false);assert.equal(canLoginUser({...u,ledDepartments:[{id:'dept',branchId:'office',active:false}]}),false);assert.equal(canLoginUser({...u,branch:{...u.branch,kind:'STORE'}}),false);assert.equal(canLoginUser({...u,active:false}),false);});
