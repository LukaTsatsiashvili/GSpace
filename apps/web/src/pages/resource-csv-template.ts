import type { Branch, Category } from './resource-api';

/**
 * Downloadable CSV aligned with BulkResourceDialog.parseCsv.
 * Category/branch examples come exclusively from the authenticated catalog,
 * never from hard-coded preview records.
 */
export function buildResourceCsvTemplate(categories: Category[], branches: Branch[], canFinance: boolean) {
  if (!categories.length || !branches.length) {
    throw Error('Create an active resource category and branch before downloading the template.');
  }
  const base = [
    'Name', 'Category', 'Branch', 'Condition', 'Serial number', 'Location',
    'Description', 'Resource type', 'Warranty end'
  ];
  const finance = [
    'Purchase price', 'Currency', 'Purchase date', 'Supplier',
    'Useful life months', 'Residual value'
  ];
  // Prefix custom-field headers so a custom key cannot shadow a standard column.
  const fields = [...new Set(categories.flatMap(category =>
    category.definitions.map(field => field.key.toLowerCase())))].sort();
  const header = [...base, ...(canFinance ? finance : []),
    ...fields.map(key => 'custom.' + key)];

  const selectedCategory = categories.find(category =>
    !category.definitions.some(field => field.required)) ?? categories[0];
  // This row must be completed before import: no fictitious resource is registered.
  const row = header.map(field => {
    switch (field) {
      case 'Name': return '';
      case 'Category': return selectedCategory.name;
      case 'Branch': return branches[0].name;
      case 'Condition': return 'Good';
      case 'Resource type': return 'Physical Asset';
      case 'Currency': return 'GEL';
      default: return '';
    }
  });
  const quote = (value: string) => {
    // Keep spreadsheet applications from evaluating formulas in catalog names.
    const escaped = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
    return '"' + escaped.replace(/"/g, '""').replace(/[\r\n]/g, ' ') + '"';
  };
  return '\uFEFF' + [header, row].map(values => values.map(quote).join(',')).join('\r\n') + '\r\n';
}
