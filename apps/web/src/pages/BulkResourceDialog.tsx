import { useEffect, useRef, useState } from 'react';
import { Box, ClipboardList, Download, ShieldCheck, X } from 'lucide-react';
import { Button, Input, NumberInput, Select } from '../components/ui';
import { resourceApi, type Category, type Branch, type ResourcePayload, type ResourceCondition } from './resource-api';
import './new-resource.css';
import './bulk-resource.css';

type Method = 'identical' | 'spreadsheet';
const conditions: ResourceCondition[] = ['Excellent', 'Good', 'Fair', 'Damaged', 'Poor'];
const template = (name: string, category: string, branchId: string, condition: ResourceCondition): ResourcePayload =>
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
function parseCsv(text: string, categories: Category[], branches: Branch[], canFinance: boolean): ResourcePayload[] {
  const [headers, ...rows] = csvRows(text);
  if (!headers) throw Error('The CSV is empty.');
  const cols = headers.map(s => s.toLowerCase());
  const find = (row: string[], key: string) => row[cols.indexOf(key)]?.trim() ?? '';
  for (const key of ['name', 'category', 'branch', 'condition']) {
    if (!cols.includes(key)) throw Error('Required CSV column missing: ' + key);
  }
  if (!rows.length || rows.length > 100) throw Error('CSV must have 1–100 rows.');
  return rows.map((row, i) => {
    const n = i + 2;
    const label = find(row, 'name');
    const category = categories.find(c => c.name.toLowerCase() === find(row, 'category').toLowerCase());
    const branch = branches.find(b => b.name.toLowerCase() === find(row, 'branch').toLowerCase());
    const condition = conditions.find(c => c.toLowerCase() === find(row, 'condition').toLowerCase());
    if (label.length < 2 || label.length > 180 || !category || !branch || !condition) {
      throw Error('Row ' + n + ': invalid name, category, branch or condition.');
    }
    const value = template(label, category.name, branch.id, condition);
    const custom: Record<string, string> = {};
    for (const def of category.definitions) {
      custom[def.key] = find(row, def.key.toLowerCase());
      if (def.required && !custom[def.key]) throw Error('Row ' + n + ': ' + def.label + ' is required.');
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

export default function BulkResourceDialog({ close, categories, branches, canFinance, saved }: {
  close: () => void; categories: Category[]; branches: Branch[];
  canFinance: boolean; saved: (message: string) => void
}) {
  const [method, setMethod] = useState<Method>('identical');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]?.name ?? '');
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [condition, setCondition] = useState<ResourceCondition>('Good');
  const [quantity, setQuantity] = useState('5');
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ResourcePayload[]>([]);
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const branch = branches.find(b => b.id === branchId);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending && !document.querySelector('.ui-select-options')) {
        if (preview) setPreview(false); else close();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [close, preview, pending]);
  async function review() {
    setError('');
    try {
      if (method === 'identical') {
        if (name.trim().length < 2 || !branch || !category) throw Error('Name, branch and category are required.');
        if (!Number.isInteger(+quantity) || +quantity < 1 || +quantity > 100) throw Error('Quantity must be 1–100.');
        if (categories.find(c => c.name === category)?.definitions.some(d => d.required)) {
          throw Error('Category requires custom fields. Use Add resource or CSV import.');
        }
      } else {
        if (!file) throw Error('Choose a CSV file.');
        setRows(parseCsv(await file.text(), categories, branches, canFinance));
      }
      setPreview(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Invalid batch.'); }
  }
  async function create() {
    if (pending) return;
    setPending(true); setError('');
    try {
      const result = method === 'identical'
        ? await resourceApi.bulk({ quantity: Number(quantity), template: (({ serialNumber: _omit, ...rest }) => rest)(
          template(name.trim(), category, branchId, condition)) })
        : await resourceApi.importCsv(rows);
      saved(result.count + ' assets registered (' + result.firstCode + ' – ' + result.lastCode + ').');
    } catch (err) {
      setPreview(false); setError(err instanceof Error ? err.message : 'Could not create the batch.');
    } finally { setPending(false); }
  }
  return <div className="rs-overlay rs-modal-overlay" onMouseDown={() => { if (!pending) close(); }}>
    <section className="nw-modal bw-modal" role="dialog" aria-modal="true" aria-labelledby="bw-title"
      onMouseDown={event => event.stopPropagation()}>
      <header className="nw-header"><div><span className="nw-preview-label">BULK REGISTRATION · POSTGRESQL</span>
        <h2 id="bw-title">Create multiple resources</h2>
        <p>Register several assets in one validated transaction.</p>
      </div><button className="rs-close" aria-label="Close bulk create" disabled={pending} onClick={close}><X size={18}/></button></header>
      <div className="nw-content bw-content">
        <div className="bw-intro"><h3>Choose a method</h3><p>Each resource gets its own permanent Asset ID.</p></div>
        <div className="bw-methods" role="group" aria-label="Bulk creation method">
          <button type="button" className={'bw-method ' + (method === 'identical' ? 'selected' : '')}
            aria-pressed={method === 'identical'} onClick={() => { setMethod('identical'); setError(''); }}>
            <Box size={20}/><strong>Multiple identical items</strong>
            <span>Register up to 100 assets with the same description.</span>
          </button>
          <button type="button" className={'bw-method ' + (method === 'spreadsheet' ? 'selected' : '')}
            aria-pressed={method === 'spreadsheet'} onClick={() => { setMethod('spreadsheet'); setError(''); }}>
            <ClipboardList size={20}/><strong>CSV spreadsheet import</strong>
            <span>Import multiple rows from an Excel-compatible CSV file.</span>
          </button>
        </div>
        {method === 'identical' ? <>
          <div className="nw-fields bw-fields">
            <label className="nw-field nw-full"><span>Resource name <b>*</b></span>
              <Input placeholder="e.g. Dell Latitude" maxLength={180} value={name}
                onChange={event => { setName(event.target.value); setError(''); }}/></label>
            <label className="nw-field"><span>Category</span><Select label="Category"
              value={category} options={categories.map(c => c.name)} onChange={setCategory}/></label>
            <label className="nw-field"><span>Quantity (1–100)</span><NumberInput min={1} max={100} step={1}
              inputMode="numeric" value={quantity} onChange={event => { setQuantity(event.target.value); setError(''); }}/></label>
            <label className="nw-field"><span>Branch</span><Select label="Branch"
              value={branch?.name ?? ''} options={branches.map(b => b.name)}
              onChange={value => setBranchId(branches.find(b => b.name === value)?.id ?? '')}/></label>
            <label className="nw-field"><span>Condition</span><Select label="Condition"
              value={condition} options={conditions} onChange={value => setCondition(value as ResourceCondition)}/></label>
          </div><p className="bw-hint">Individual serial numbers can be added later through Edit resource.</p>
        </> : <>
          <input ref={fileInput} className="nw-file-input" type="file" accept=".csv"
            onChange={event => {
              const chosen = event.target.files?.[0];
              if (!chosen) return;
              if (!/\.csv$/i.test(chosen.name) || chosen.size > 1024 * 1024) {
                setError('Choose a CSV file under 1 MB. Save Excel files as CSV first.'); return;
              }
              setFile(chosen); setError('');
            }}/>
          <button className="nw-dropzone bw-dropzone" onClick={() => fileInput.current?.click()}>
            <Download size={22}/><strong>{file ? file.name : 'Choose a CSV file'}</strong>
            <span>Save Excel as comma-delimited CSV before importing</span>
          </button>
          <p className="bw-hint">Required headers: Name, Category, Branch, Condition.
            Optional: Serial number, Location, Description, Resource type, Warranty end,
            Purchase price, Currency, Purchase date, Supplier, Useful life months, Residual value,
            and custom field keys.</p>
        </>}
        <div className="nw-notice bw-notice"><span><ShieldCheck size={18}/></span>
          <p><strong>Administrator-managed.</strong> Validation runs on the server for each row.
            No resource is created until confirmation.</p></div>
        {error && <p className="nw-error" role="alert">{error}</p>}
      </div>
      <footer className="nw-footer"><span>1–100 resources per batch</span><div>
        <Button disabled={pending} onClick={close}>Close</Button>
        <Button variant="primary" disabled={pending} onClick={() => { void review(); }}>Review batch →</Button>
      </div></footer>
      {preview && <div className="nw-confirm-overlay" onMouseDown={() => { if (!pending) setPreview(false); }}>
        <div role="alertdialog" aria-modal="true" aria-label="Review bulk registration"
          onMouseDown={event => event.stopPropagation()}>
          <ShieldCheck size={30}/><h3>Confirm batch registration</h3>
          <p>{method === 'identical' ? quantity + ' × ' + name + ' · ' + category + ' · ' + (branch?.name ?? '') :
            rows.length + ' validated rows from ' + file?.name}
            {' '}All records will be saved to PostgreSQL.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
            <Button disabled={pending} onClick={() => setPreview(false)}>Back</Button>
            <Button variant="primary" disabled={pending} onClick={() => { void create(); }}>
              {pending ? 'Creating...' : 'Create batch'}
            </Button>
          </div>
        </div>
      </div>}
    </section>
  </div>;
}
