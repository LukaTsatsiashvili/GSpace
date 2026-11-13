import type { Branch, Category, ResourcePayload, ResourceCondition } from './resource-api';

/**
 * Universal CSV: standard headers only, no example rows or Custom Fields.
 * Category CSV: same standard headers plus the selected category's definitions.
 * No category/branch/asset values are inserted into either template.
 */
export function buildResourceCsvTemplate(
  categories: Category[], canFinance: boolean, selectedCategoryId: string | null = null
): string {
  const selectedCategory = selectedCategoryId === null
    ? null : categories.find(category => category.id === selectedCategoryId);
  if (selectedCategoryId !== null && !selectedCategory) {
    throw Error('Selected category is unavailable. Refresh Resources and try again.');
  }
  const standard = [
    'Name', 'Category', 'Branch', 'Condition', 'Serial number', 'Location',
    'Description', 'Resource type', 'Warranty end'
  ];
  const finance = [
    'Purchase price', 'Currency', 'Purchase date', 'Supplier',
    'Useful life months', 'Residual value'
  ];
  const custom = (selectedCategory?.definitions ?? []).map(field => 'custom.' + field.key);
  const headers = [...standard, ...(canFinance ? finance : []), ...custom];
  const quote = (value: string) => '"' + value.replace(/"/g, '""') + '"';
  // UTF-8 BOM improves Excel compatibility; only the header row is exported.
  return '\uFEFF' + headers.map(quote).join(',') + '\r\n';
}

/** Keep downloaded template columns and the upload parser in the same tested module. */
const conditions: ResourceCondition[] = ['Excellent', 'Good', 'Fair', 'Damaged', 'Poor'];
export const emptyResourceTemplate = (name: string, category: string, branchId: string, condition: ResourceCondition): ResourcePayload =>
  ({ name, category, branchId, condition, resourceType: 'Physical Asset', status: 'AVAILABLE',
    location: '', serialNumber: null, description: '', warrantyEnd: null, purchaseDate: null,
    purchasePrice: null, currency: 'GEL', supplier: '', usefulLifeMonths: null,
    residualValue: null, customFields: {} });

function csvRows(content: string): string[][] {
  const result: string[][] = []; const data = content.replace(/^\uFEFF/, '');
  let quoted = false, cell = '', row: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const c = data[i];
    if (c === '"') {
      if (quoted && data[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(cell.trim()); cell = ''; }
    else if ((c === '\r' || c === '\n') && !quoted) {
      if (c === '\r' && data[i + 1] === '\n') i++;
      row.push(cell.trim()); cell = ''; if (row.some(v => v)) result.push(row); row = [];
    } else cell += c;
  }
  if (quoted) throw Error('CSV contains an unclosed quotation.');
  row.push(cell.trim()); if (row.some(v => v)) result.push(row);
  return result;
}
export function parseResourceCsv(text: string, categories: Category[], branches: Branch[], canFinance: boolean): ResourcePayload[] {
  const [headers, ...rows] = csvRows(text);
  if (!headers) throw Error('The CSV is empty.');
  const cols = headers.map(s => s.toLowerCase());
  const find = (row: string[], key: string) => row[cols.indexOf(key)]?.trim() ?? '';
  // Generated templates prefix apostrophes to defend against CSV formula injection.
  // Restore those prefixes only for lookup values that match actual catalog records.
  const catalogName = (raw: string) => raw.startsWith("'") && /^[=+\-@\t\r]/.test(raw.slice(1))
    ? raw.slice(1) : raw;
  for (const key of ['name', 'category', 'branch', 'condition']) {
    if (!cols.includes(key)) throw Error('Required CSV column missing: ' + key);
  }
  if (!rows.length || rows.length > 100) throw Error('CSV must have 1–100 rows.');
  return rows.map((row, i) => {
    const n = i + 2;
    const label = find(row, 'name');
    const category = categories.find(c => c.name.toLowerCase() === catalogName(find(row, 'category')).toLowerCase());
    const branch = branches.find(b => b.name.toLowerCase() === catalogName(find(row, 'branch')).toLowerCase());
    const condition = conditions.find(c => c.toLowerCase() === find(row, 'condition').toLowerCase());
    if (label.length < 2 || label.length > 180 || !category || !branch || !condition) {
      throw Error('Row ' + n + ': invalid name, category, branch or condition.');
    }
    const value = emptyResourceTemplate(label, category.name, branch.id, condition);
    const custom: Record<string, string> = {};
    for (const def of category.definitions) {
      custom[def.key] = find(row, 'custom.' + def.key.toLowerCase()) || find(row, def.key.toLowerCase());
      if (def.required && !custom[def.key]) throw Error(
        'Row ' + n + ': ' + def.label + ' is required for ' + category.name +
        '. Download its category template to include the required Custom Fields.'
      );
    }
    value.customFields = custom;
    value.serialNumber = find(row, 'serial number') || null;
    value.location = find(row, 'location'); value.description = find(row, 'description');
    value.warrantyEnd = find(row, 'warranty end') || null;
    value.resourceType = (['Physical Asset','Digital Asset','Bundle'].includes(find(row, 'resource type'))
      ? find(row, 'resource type') : 'Physical Asset') as ResourcePayload['resourceType'];
    const currency = find(row, 'currency').toUpperCase() || 'GEL';
    if (!['GEL','USD','EUR'].includes(currency)) throw Error('Row ' + n + ': currency is invalid.');
    value.currency = currency as ResourcePayload['currency'];
    const amount = (key: string) => {
      const input = find(row, key);
      if (!input) return null;
      const result = Number(input);
      if (!Number.isFinite(result) || result < 0) throw Error('Row ' + n + ': invalid ' + key);
      return result;
    };
    value.purchasePrice = amount('purchase price');
    value.residualValue = amount('residual value');
    value.usefulLifeMonths = amount('useful life months');
    value.purchaseDate = find(row, 'purchase date') || null;
    value.supplier = find(row, 'supplier');
    if (!canFinance && (value.purchasePrice !== null || value.residualValue !== null ||
      value.usefulLifeMonths !== null || value.purchaseDate !== null || value.supplier)) {
      throw Error('Row ' + n + ': Finance permission is required for purchase fields.');
    }
    if (value.residualValue !== null && (value.purchasePrice === null || value.residualValue > value.purchasePrice))
      throw Error('Row ' + n + ': residual value exceeds price.');
    if (value.usefulLifeMonths !== null && (!Number.isInteger(value.usefulLifeMonths) ||
      value.usefulLifeMonths < 1 || value.usefulLifeMonths > 1200))
      throw Error('Row ' + n + ': useful life is outside 1–1200 months.');
    if (value.location.length > 240 || (value.serialNumber?.length ?? 0) > 120 || value.description.length > 3000)
      throw Error('Row ' + n + ': text is too long.');
    return value;
  });
}

