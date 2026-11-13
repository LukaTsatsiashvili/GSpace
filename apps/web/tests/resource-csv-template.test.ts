import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildResourceCsvTemplate, parseResourceCsv } from '../src/pages/resource-csv-template.ts';
import type { Branch, Category } from '../src/pages/resource-api.ts';

const branch: Branch = { id: 'head-office-id', name: 'Head Office' };
const categories: Category[] = [
  { id: 'laptop', name: 'Laptop', definitions: [
    { key: 'ram', label: 'RAM', required: true }, { key: 'storage', label: 'Storage', required: false }
  ] },
  { id: 'monitor', name: 'Monitor', definitions: [
    { key: 'resolution', label: 'Resolution', required: false }
  ] },
  { id: 'desk', name: 'Desk', definitions: [] }
];
function columns(csv: string): string[] {
  const header = csv.split('\r\n')[0].replace(/^\uFEFF/, '');
  return header.split(',').map(item => item.slice(1, -1));
}
function fill(csv: string, ...rows: Record<string,string>[]): string {
  const headers = columns(csv);
  const quote = (v: string) => '"' + v.replace(/"/g, '""') + '"';
  return csv + rows.map(changes =>
    headers.map(key => quote(changes[key] ?? '')).join(',')).join('\r\n') + '\r\n';
}
function expectHeaderOnly(csv: string) {
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(csv.split('\r\n').filter(Boolean).length, 1);
  assert.ok(columns(csv).includes('Name'));
  assert.ok(columns(csv).includes('Category'));
  assert.ok(columns(csv).includes('Branch'));
  assert.ok(columns(csv).includes('Condition'));
}

test('universal template is completely blank after standard headers, with no custom columns', () => {
  const csv = buildResourceCsvTemplate(categories, true);
  expectHeaderOnly(csv);
  assert.ok(columns(csv).includes('Purchase price'));
  assert.ok(!columns(csv).some(field => field.startsWith('custom.')));
  assert.ok(!csv.includes('Laptop'));
  assert.ok(!csv.includes('Head Office'));
});

test('universal template imports different categories in one batch when no required fields are missing', () => {
  const csv = buildResourceCsvTemplate(categories, true);
  const rows = parseResourceCsv(fill(csv,
    { Name: 'Office Desk', Category: 'Desk', Branch: 'Head Office', Condition: 'Good' },
    { Name: 'Dell Monitor', Category: 'Monitor', Branch: 'Head Office', Condition: 'Excellent' }
  ), categories, [branch], true);
  assert.deepEqual(rows.map(row => row.category), ['Desk', 'Monitor']);
  assert.equal(rows[0].branchId, branch.id);
});

test('category template includes only selected custom fields and has no prefilled rows', () => {
  const csv = buildResourceCsvTemplate(categories, true, 'laptop');
  expectHeaderOnly(csv);
  const headers = columns(csv);
  assert.ok(headers.includes('custom.ram'));
  assert.ok(headers.includes('custom.storage'));
  assert.ok(!headers.includes('custom.resolution'));
  const rows = parseResourceCsv(fill(csv, {
    Name: 'Lenovo', Category: 'Laptop', Branch: 'Head Office',
    Condition: 'Good', Currency: 'GEL', 'Resource type': 'Physical Asset',
    'custom.ram': '32 GB', 'custom.storage': '1 TB SSD', 'Purchase price': '3200'
  }), categories, [branch], true);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].purchasePrice, 3200);
  assert.deepEqual(rows[0].customFields, { ram: '32 GB', storage: '1 TB SSD' });
});

test('non-finance templates exclude finance columns for both template variants', () => {
  const universal = buildResourceCsvTemplate(categories, false);
  const laptop = buildResourceCsvTemplate(categories, false, 'laptop');
  expectHeaderOnly(universal);
  expectHeaderOnly(laptop);
  assert.ok(!columns(universal).includes('Purchase price'));
  assert.ok(!columns(laptop).includes('Purchase price'));
  assert.ok(columns(laptop).includes('custom.ram'));
  const parsed = parseResourceCsv(fill(universal, {
    Name: 'Office Desk', Category: 'Desk', Branch: 'Head Office', Condition: 'Good'
  }), categories, [branch], false);
  assert.equal(parsed[0].purchasePrice, null);
});

test('required fields remain enforced and the error directs user to category template', () => {
  const universal = buildResourceCsvTemplate(categories, true);
  assert.throws(() => parseResourceCsv(fill(universal, {
    Name: 'Lenovo Laptop', Category: 'Laptop', Branch: 'Head Office', Condition: 'Good'
  }), categories, [branch], true), /RAM is required for Laptop.*category template/);
  const specialized = buildResourceCsvTemplate(categories, true, 'laptop');
  assert.throws(() => parseResourceCsv(fill(specialized, {
    Name: 'Lenovo Laptop', Category: 'Laptop', Branch: 'Head Office', Condition: 'Good'
  }), categories, [branch], true), /RAM is required/);
});

test('category-specific template without custom fields still has only standard headers', () => {
  const csv = buildResourceCsvTemplate(categories, true, 'desk');
  expectHeaderOnly(csv);
  assert.ok(!columns(csv).some(name => name.startsWith('custom.')));
});

test('CSV parser supports Georgian text, commas and formula-prefixed catalog names', () => {
  const specialCategories: Category[] = [
    { id: 'georgian', name: '=Laptop, ბიზნეს', definitions: [] }
  ];
  const specialBranches: Branch[] = [{ id: 'tbilisi', name: '+თბილისი, ოფისი' }];
  const csv = buildResourceCsvTemplate(specialCategories, true, 'georgian');
  expectHeaderOnly(csv);
  const entries = parseResourceCsv(fill(csv, {
    Name: 'პირადი, კომპიუტერი', Category: "'=Laptop, ბიზნეს",
    Branch: "'+თბილისი, ოფისი", Condition: 'Good'
  }), specialCategories, specialBranches, true);
  assert.equal(entries[0].name, 'პირადი, კომპიუტერი');
  assert.equal(entries[0].category, '=Laptop, ბიზნეს');
  assert.equal(entries[0].branchId, 'tbilisi');
});

test('universal template needs no catalog values; invalid category selection is rejected', () => {
  expectHeaderOnly(buildResourceCsvTemplate([], false));
  assert.throws(() => buildResourceCsvTemplate([], true, 'missing'),
    /Selected category is unavailable/);
  assert.throws(() => buildResourceCsvTemplate(categories, true, 'missing'),
    /Selected category is unavailable/);
});

test('blank header-only templates cannot be imported without resource rows', () => {
  for(const csv of [buildResourceCsvTemplate(categories, true),
    buildResourceCsvTemplate(categories, true, 'laptop')]) {
    assert.throws(() => parseResourceCsv(csv, categories, [branch], true),
      /CSV must have 1–100 rows/);
  }
});
