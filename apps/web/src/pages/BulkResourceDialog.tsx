import { useEffect, useRef, useState } from 'react';
import { Box, ClipboardList, Download, FileDown, ShieldCheck, X } from 'lucide-react';
import { Button, Input, NumberInput, Select } from '../components/ui';
import { resourceApi, type Category, type Branch, type ResourcePayload, type ResourceCondition } from './resource-api';
import { buildResourceCsvTemplate, emptyResourceTemplate, parseResourceCsv } from './resource-csv-template';
import './new-resource.css';
import './bulk-resource.css';

type Method = 'identical' | 'spreadsheet';
const conditions: ResourceCondition[] = ['Excellent', 'Good', 'Fair', 'Damaged', 'Poor'];
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
  const [templateCategoryId, setTemplateCategoryId] = useState<string>('universal');
  const selectedTemplateCategory = categories.find(item => item.id === templateCategoryId);
  const universalLabel = 'Universal template — all categories';
  const templateChoices = [universalLabel, ...categories.map(item => item.name)];
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
  function downloadTemplate() {
    setError('');
    try {
      const text = buildResourceCsvTemplate(categories, canFinance, selectedTemplateCategory?.id ?? null);
      const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const slug = selectedTemplateCategory?.name.trim().toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 45);
      link.download = slug ? 'gspace-resources-' + slug + '-template.csv' : 'gspace-resources-universal-template.csv';
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not prepare the CSV template.');
    }
  }
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
        setRows(parseResourceCsv(await file.text(), categories, branches, canFinance));
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
          emptyResourceTemplate(name.trim(), category, branchId, condition)) })
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
          <div className="bw-template-help">
            <div className="bw-template-copy">
              <strong>Download a blank CSV template</strong>
              <span>Select a universal template for multiple categories or choose one category to include its Custom Fields.
                Both templates contain headers only — no example assets or pre-filled values.</span>
            </div>
            <div className="bw-template-controls">
              <label className="bw-template-label" htmlFor="bw-template-type">Template category</label>
              <Select className="bw-template-select" label="Template category"
                value={selectedTemplateCategory?.name ?? universalLabel}
                options={templateChoices}
                onChange={value => {
                  setTemplateCategoryId(categories.find(item => item.name === value)?.id ?? 'universal');
                  setError('');
                }}/>
              <Button icon={<FileDown size={16}/>} onClick={downloadTemplate}
                disabled={!!templateCategoryId && templateCategoryId !== 'universal' && !selectedTemplateCategory}>
                Download template
              </Button>
            </div>
            <p className="bw-template-explanation">
              {selectedTemplateCategory
                ? 'Category template: standard columns + ' + selectedTemplateCategory.name +
                  ' Custom Fields (' + selectedTemplateCategory.definitions.length + '). Enter the category name in each row.'
                : 'Universal template: standard columns only. You can mix categories, but categories with required Custom Fields need a category template.'}
            </p>
          </div>
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
            and, for category-specific templates, Custom Fields (custom.fieldKey). Every row must include a valid Category and Branch name.</p>
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
