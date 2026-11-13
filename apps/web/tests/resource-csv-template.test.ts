import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildResourceCsvTemplate, parseResourceCsv } from '../src/pages/resource-csv-template.ts';
import type { Branch, Category } from '../src/pages/resource-api.ts';

const branch: Branch = { id: 'head-office-id', name: 'Head Office' };
const categories: Category[] = [
  { id: 'laptop', name: 'Laptop', definitions: [
    { key: 'ram', label: 'RAM', required: true }, { key: 'storage', label: 'Storage', required: false }
  ] },
  { id: 'desk', name: 'Desk', definitions: [] }
];
function columns(csv: string): string[] {
  const header = csv.trimEnd().split('\r\n')[0].replace(/^\uFEFF/, '');
  return header.split(',').map(s => s.slice(1, -1));
}
function fill(csv: string, changes: Record<string,string>): string {
  const headers = columns(csv);
  const values = headers.map(key => changes[key] ?? '');
  const quote = (v: string) => '"' + v.replace(/"/g, '""') + '"';
  return csv.trimEnd().split('\r\n')[0] + '\r\n' + values.map(quote).join(',') + '\r\n';
}

test('template uses live branch and category names, dynamic custom fields and finance columns', () => {
  const csv = buildResourceCsvTemplate(categories, [branch], true);
  assert.ok(csv.startsWith('\uFEFF'));
  const headers = columns(csv);
  for (const field of ['Name', 'Category', 'Branch', 'Condition', 'Purchase price', 'Currency',
    'Purchase date', 'custom.ram', 'custom.storage']) assert.ok(headers.includes(field), field);
  const imported = parseResourceCsv(fill(csv, { Name: 'Lenovo', Category: 'Laptop', Branch: 'Head Office',
    Condition: 'Good', Currency: 'GEL', 'Resource type': 'Physical Asset',
    'custom.ram': '32 GB', 'custom.storage': '1 TB SSD', 'Purchase price': '3200' }), categories, [branch], true);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].branchId, branch.id);
  assert.equal(imported[0].category, 'Laptop');
  assert.equal(imported[0].purchasePrice, 3200);
  assert.deepEqual(imported[0].customFields, { ram: '32 GB', storage: '1 TB SSD' });
});

test('non-finance template excludes finance columns and imports with no finance fields', () => {
  const csv = buildResourceCsvTemplate(categories, [branch], false);
  assert.ok(!columns(csv).includes('Purchase price'));
  const imported = parseResourceCsv(fill(csv, {
    Name: 'Office Desk', Category: 'Desk', Branch: 'Head Office', Condition: 'Good'
  }), categories, [branch], false);
  assert.equal(imported[0].purchasePrice, null);
  assert.equal(imported[0].category, 'Desk');
});

test('required custom fields block missing values and permit a filled template', () => {
  const csv = buildResourceCsvTemplate(categories, [branch], true);
  assert.throws(() => parseResourceCsv(fill(csv, {
    Name: 'Laptop', Category: 'Laptop', Branch: 'Head Office', Condition: 'Good'
  }), categories, [branch], true), /RAM is required/);
});

test('template safely round-trips names with Georgian text, commas and spreadsheet formula prefixes', () => {
  const dangerousCategory: Category[] = [{ id: 'category-safe', name: '=Laptop, ბიზნეს',
    definitions: [] }];
  const dangerousBranch: Branch[] = [{ id: 'branch-safe', name: '+თბილისი, ოფისი' }];
  const csv = buildResourceCsvTemplate(dangerousCategory, dangerousBranch, true);
  assert.match(csv, /"'=Laptop, ბიზნეს"/);
  assert.match(csv, /"'\+თბილისი, ოფისი"/);
  // Replace only the initially blank Name cell; preserve the generated quoted catalog values.
  const usable = csv.replace('\r\n""', '\r\n"პირადი კომპიუტერი"');
  const row = parseResourceCsv(usable, dangerousCategory, dangerousBranch, true)[0];
  assert.equal(row.category, dangerousCategory[0].name);
  assert.equal(row.branchId, dangerousBranch[0].id);
  assert.equal(row.name, 'პირადი კომპიუტერი');
});

test('download cannot generate a fake branch or category when none exist', () => {
  assert.throws(() => buildResourceCsvTemplate([], [branch], true), /active resource category/);
  assert.throws(() => buildResourceCsvTemplate(categories, [], true), /active resource category/);
});
