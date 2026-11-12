import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Download, ShieldCheck, Wallet, X } from 'lucide-react';
import { Button, Input, NumberInput, Select, Textarea } from '../components/ui';
import { useAuth } from '../auth/AuthGate';
import {
  asFilePayload, resourceApi,
  type Branch, type Category, type ResourcePayload, type ResourceRecord,
  type ResourceCondition, type ResourceType
} from './resource-api';
import './new-resource.css';

type FormData = {
  name: string; category: string; condition: ResourceCondition; type: ResourceType; notes: string;
  branch: string; location: string; serial: string; warranty: string;
  price: string; currency: 'GEL' | 'USD' | 'EUR';
  purchaseDate: string; supplier: string; usefulLife: string; residual: string;
  status: 'AVAILABLE' | 'RETIRED';
};
const steps = ['General', 'Specifications', 'Finance', 'Documents', 'Review'];
const conditions: ResourceCondition[] = ['Excellent', 'Good', 'Fair', 'Damaged', 'Poor'];
const allowedFileTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp',
  'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

function Field({ label, required, children, hint }: {
  label: string; required?: boolean; children: ReactNode; hint?: string
}) {
  return <label className="nw-field"><span>{label}{required && <b> *</b>}</span>
    {children}{hint && <small>{hint}</small>}</label>;
}
function SelectField({ label, required, value, options, change }: {
  label: string; required?: boolean; value: string; options: string[]; change: (value: string) => void
}) {
  return <Field label={label} required={required}><Select label={label} value={value}
    options={options} onChange={change}/></Field>;
}
function Notice({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className="nw-notice"><span>{icon}</span><p>{children}</p></div>;
}
function dateOnly(value?: string | null) { return value?.slice(0, 10) ?? ''; }
function initialForm(branches: Branch[], categories: Category[], resource?: ResourceRecord | null): FormData {
  return {
    name: resource?.name ?? '',
    category: resource?.category ?? (categories.find(c => c.name === 'Laptop')?.name ?? categories[0]?.name ?? ''),
    condition: resource?.condition ?? 'Good',
    type: resource?.resourceType ?? 'Physical Asset',
    notes: resource?.description ?? '',
    branch: resource?.branchId ?? branches[0]?.id ?? '',
    location: resource?.location ?? '', serial: resource?.serialNumber ?? '',
    warranty: dateOnly(resource?.warrantyEnd),
    price: resource?.purchasePrice ?? '', currency: (resource?.currency as FormData['currency']) ?? 'GEL',
    purchaseDate: dateOnly(resource?.purchaseDate),
    supplier: resource?.supplier ?? '', usefulLife: String(resource?.usefulLifeMonths ?? ''),
    residual: resource?.residualValue ?? '',
    status: resource?.status === 'RETIRED' ? 'RETIRED' : 'AVAILABLE'
  };
}

export default function NewResourceDialog({ close, branches, categories, resource, saved }: {
  close: () => void; branches: Branch[]; categories: Category[];
  resource?: ResourceRecord | null; saved: (assetCode: string) => void
}) {
  const { user } = useAuth();
  const canFinance = user.role.permissions.includes('finance.edit');
  const editing = !!resource;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(() => initialForm(branches, categories, resource));
  const [customFields, setCustomFields] = useState<Record<string, string>>(() =>
    resource?.customFields ?? {});
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const category = categories.find(c => c.name === form.category);
  const branch = branches.find(b => b.id === form.branch);
  const update = (key: keyof FormData) => (value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    setError('');
  };
  const field = (key: keyof FormData, placeholder = '', type = 'text') =>
    type === 'number' ?
      <NumberInput step={key === 'usefulLife' ? 1 : '0.01'} min={0}
        inputMode={key === 'usefulLife' ? 'numeric' : 'decimal'}
        placeholder={placeholder} value={form[key]}
        onChange={event => update(key)(event.target.value)}/> :
      <Input type={type} maxLength={key === 'notes' ? 3000 : 200}
        placeholder={placeholder} value={form[key]}
        onChange={event => update(key)(event.target.value)}/>;
  const go = (next: number) => { setStep(next); setError(''); content.current?.scrollTo({ top: 0 }); };

  function validate() {
    if (form.name.trim().length < 2) throw Error('Resource name must contain at least 2 characters.');
    if (!category) throw Error('Select a valid category.');
    if (!branch) throw Error('Select an active branch.');
    if (form.serial.length > 120 || form.location.length > 240) throw Error('Serial or location text is too long.');
    for (const definition of category.definitions) {
      if (definition.required && !customFields[definition.key]?.trim()) {
        throw Error(definition.label + ' is required.');
      }
      if ((customFields[definition.key] ?? '').length > 300) throw Error('Custom field values must be 300 characters or fewer.');
    }
    const price = form.price.trim() ? Number(form.price) : null;
    const residual = form.residual.trim() ? Number(form.residual) : null;
    const usefulLife = form.usefulLife.trim() ? Number(form.usefulLife) : null;
    if (price !== null && (!Number.isFinite(price) || price < 0)) throw Error('Enter a valid purchase price.');
    if (residual !== null && (!Number.isFinite(residual) || residual < 0 || price === null || residual > price)) {
      throw Error('Residual value must be between zero and purchase price.');
    }
    if (usefulLife !== null && (!Number.isInteger(usefulLife) || usefulLife < 1 || usefulLife > 1200)) {
      throw Error('Useful life must be 1–1200 months.');
    }
    if (files.length > 4 || files.reduce((sum, file) => sum + file.size, 0) > 6 * 1024 * 1024) {
      throw Error('Maximum 4 files and 6 MB total attachment size.');
    }
    return { price, residual, usefulLife };
  }
  async function submit() {
    if (pending) return;
    try {
      const money = validate();
      setPending(true); setError('');
      const payload: ResourcePayload = {
        name: form.name.trim(), category: form.category, branchId: form.branch,
        resourceType: form.type, condition: form.condition, status: form.status,
        location: form.location.trim(), serialNumber: form.serial.trim() || null,
        description: form.notes.trim(), warrantyEnd: form.warranty || null,
        customFields: Object.fromEntries((category?.definitions ?? []).map(d =>
          [d.key, (customFields[d.key] || '').trim()])),
        purchasePrice: canFinance ? money.price : null,
        currency: form.currency, purchaseDate: canFinance ? form.purchaseDate || null : null,
        supplier: canFinance ? form.supplier.trim() : '',
        usefulLifeMonths: canFinance ? money.usefulLife : null,
        residualValue: canFinance ? money.residual : null
      };
      if (resource) {
        await resourceApi.update(resource.id, payload);
        saved(resource.assetCode);
      } else {
        const documents = await Promise.all(files.map(asFilePayload));
        const result = await resourceApi.create({ ...payload, documents });
        saved(result.assetCode);
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save resource.'); }
    finally { setPending(false); }
  }
  const continueStep = () => {
    try {
      if (step === 0 && (!form.name.trim() || !category)) throw Error('Enter a resource name and category.');
      if (step === 1 && !branch) throw Error('Select a valid branch.');
      if (step === 4) { void submit(); return; }
      go(step + 1);
    } catch (err) { setError(err instanceof Error ? err.message : 'Check the form.'); }
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending && !document.querySelector('.ui-select-options')) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, pending]);

  const summary = [
    ['Resource name', form.name], ['Asset ID', resource?.assetCode ?? 'Automatically generated'],
    ['Resource type', form.type], ['Category', form.category],
    ['Condition', form.condition], ['Branch', branch?.name ?? '—'],
    ['Location', form.location || 'Not specified'],
    ['Serial number', form.serial || 'Not specified'],
    ['Purchase price', canFinance && form.price ? form.price + ' ' + form.currency : 'Not specified'],
    ['Supplier', canFinance ? form.supplier || 'Not specified' : 'Restricted'],
    ['Attachments', editing ? String(resource?.documents.length ?? 0) + ' existing' : files.length + ' new file(s)']
  ];

  return <div className="rs-overlay rs-modal-overlay" onMouseDown={() => { if (!pending) close(); }}>
    <section className="nw-modal" role="dialog" aria-modal="true" aria-labelledby="nw-title"
      onMouseDown={event => event.stopPropagation()}>
      <header className="nw-header"><div>
        <span className="nw-preview-label">RESOURCE REGISTER · POSTGRESQL</span>
        <h2 id="nw-title">{editing ? 'Edit resource' : 'Add new resource'}</h2>
        <p>Register physical or digital company assets with a permanent Asset ID.</p>
      </div><button className="rs-close" disabled={pending} aria-label="Close resource dialog" onClick={close}><X size={18}/></button></header>
      <nav className="nw-steps" aria-label="Registration steps">
        {steps.map((name, index) => <div key={name} className={'nw-step ' +
          (step === index ? 'current' : '') + ' ' + (step > index ? 'complete' : '')}>
          <span>{step > index ? <Check size={14}/> : index + 1}</span><strong>{name}</strong>
        </div>)}
      </nav>
      <div className="nw-content" ref={content}>
        {step === 0 && <>
          <div className="nw-section-title"><div><h3>General information</h3>
            <p>Identify the asset. Its unique Asset ID is assigned automatically.</p></div><span>01 / 05</span></div>
          <div className="nw-fields">
            <div className="nw-full"><Field label="Resource name" required>{field('name', 'e.g. Lenovo ThinkPad T14')}</Field></div>
            <SelectField label="Category" required value={form.category} options={categories.map(c => c.name)}
              change={value => { update('category')(value); setCustomFields({}); }}/>
            <SelectField label="Initial condition" required value={form.condition} options={conditions}
              change={value => update('condition')(value as ResourceCondition)}/>
            <div className="nw-full nw-type"><span>Resource type <b>*</b></span><div>
              {(['Physical Asset', 'Digital Asset', 'Bundle'] as ResourceType[]).map(value =>
                <button key={value} type="button" className={form.type === value ? 'selected' : ''}
                  aria-pressed={form.type === value} onClick={() => update('type')(value)}>{value}</button>)}
            </div><small>Licenses, subscriptions and consumables have specialized workflows.</small></div>
            <div className="nw-full"><Field label="Description / notes">
              <Textarea rows={3} maxLength={3000} placeholder="Optional notes about this resource"
                value={form.notes} onChange={event => update('notes')(event.target.value)}/>
            </Field></div>
            {editing && <SelectField label="Asset status" value={form.status}
              options={['AVAILABLE', 'RETIRED']} change={value => update('status')(value)}/>}
          </div>
          <Notice icon={<ShieldCheck size={18}/>}>
            <strong>Audited registration.</strong> Authorized administrators create resources; Asset IDs are permanent.
          </Notice>
        </>}
        {step === 1 && <>
          <div className="nw-section-title"><div><h3>Specifications &amp; location</h3>
            <p>Where the asset is located and category-specific information.</p></div><span>02 / 05</span></div>
          <div className="nw-fields">
            <SelectField label="Branch" required value={form.branch} options={branches.map(b => b.name)}
              change={name => update('branch')(branches.find(b => b.name === name)?.id ?? '')}/>
            <Field label="Storage / location">{field('location', 'e.g. IT Storage — Shelf A')}</Field>
            <Field label="Serial number">{field('serial', 'Manufacturer serial')}</Field>
            <Field label="Warranty end date">{field('warranty', '', 'date')}</Field>
          </div>
          <div className="nw-custom"><div className="nw-custom-title">
            <h3>{form.category} custom fields</h3><span>Category definitions</span></div>
            <p>These fields are configured for the selected category by an authorized administrator.</p>
            {category?.definitions.length ? <div className="nw-fields">
              {category.definitions.map(definition => <Field key={definition.key} label={definition.label}
                required={definition.required}>
                <Input maxLength={300} placeholder={definition.label} value={customFields[definition.key] ?? ''}
                  onChange={event => { setCustomFields(old => ({
                    ...old, [definition.key]: event.target.value
                  })); setError(''); }}/>
              </Field>)}
            </div> : <p>No additional fields for this category.</p>}
          </div>
        </>}
        {step === 2 && <>
          <div className="nw-section-title"><div><h3>Purchase &amp; financial information</h3>
            <p>Optional purchase details with controlled Finance permissions.</p></div><span>03 / 05</span></div>
          {canFinance ? <div className="nw-fields">
            <Field label="Purchase price">{field('price', '0.00', 'number')}</Field>
            <SelectField label="Currency" value={form.currency} options={['GEL', 'USD', 'EUR']}
              change={value => update('currency')(value)}/>
            <Field label="Purchase date">{field('purchaseDate', '', 'date')}</Field>
            <Field label="Supplier">{field('supplier', 'Supplier name')}</Field>
            <Field label="Useful life (months)" hint="Straight-line depreciation when applicable">
              {field('usefulLife', '', 'number')}</Field>
            <Field label="Residual value" hint="Amount in the purchase currency">
              {field('residual', '', 'number')}</Field>
          </div> : <Notice icon={<Wallet size={18}/>}>
            Purchase values are restricted. You can continue without Finance permissions.
          </Notice>}
          <Notice icon={<Wallet size={18}/>}>
            Financial data is saved separately from the public resource details and is only returned to permitted users.
          </Notice>
        </>}
        {step === 3 && <>
          <div className="nw-section-title"><div><h3>Attachments &amp; documents</h3>
            <p>Invoices, warranties, photos and supporting files are stored in PostgreSQL.</p></div><span>04 / 05</span></div>
          {!editing ? <>
            <input ref={fileInput} className="nw-file-input" type="file" multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.docx,.xlsx"
              onChange={event => {
                const incoming = Array.from(event.target.files ?? []);
                setFiles(old => [...old, ...incoming].slice(0, 5));
                if (fileInput.current) fileInput.current.value = '';
              }}/>
            <button className="nw-dropzone" type="button" onClick={() => fileInput.current?.click()}>
              <Download size={21}/><strong>Choose files to attach</strong>
              <span>Up to 4 documents, 2 MB each and 6 MB combined</span>
            </button>
            {files.length ? <div className="nw-file-list">{files.map((file, index) =>
              <div key={file.name + index}><span>{file.name} · {(file.size / 1024).toFixed(0)} KB</span>
                <button aria-label={'Remove ' + file.name}
                  onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><X size={14}/></button>
              </div>)}</div> : <p className="nw-files-caption">No files selected. Attachments are optional.</p>}
            {files.some(file => !allowedFileTypes.includes(file.type)) &&
              <p className="nw-error" role="alert">Unsupported attachment type. Use PDF, image, CSV, text or Office OpenXML files.</p>}
          </> : <p className="nw-files-caption">
            {resource?.documents.length ?? 0} existing document(s). Additional uploads will be available as a follow-up;
            editing currently preserves existing documents.
          </p>}
          <Notice icon={<ShieldCheck size={18}/>}>
            Documents are stored in the database, not as public files. Downloads require authentication and branch access.
          </Notice>
        </>}
        {step === 4 && <>
          <div className="nw-section-title"><div><h3>Review resource information</h3>
            <p>Confirm the details before saving to PostgreSQL.</p></div><span>05 / 05</span></div>
          <div className="nw-review-grid">{summary.map(([label, value]) =>
            <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
          <Notice icon={<ShieldCheck size={18}/>}>
            <strong>{editing ? 'Update resource.' : 'Create resource.'}</strong> This action changes real records and is recorded in Audit Timeline.
          </Notice>
        </>}
        {error && <p className="nw-error" role="alert">{error}</p>}
      </div>
      <footer className="nw-footer"><span>Step {step + 1} of 5 · {editing ? 'Update' : 'Registration'}</span>
        <div><Button disabled={pending} onClick={step === 0 ? close : () => go(step - 1)}>
          {step === 0 ? 'Close' : 'Back'}</Button>
          <Button variant="primary" disabled={pending} onClick={continueStep}>
            {pending ? 'Saving...' : step === 4 ? editing ? 'Save changes' : 'Create resource' : 'Continue →'}
          </Button>
        </div>
      </footer>
    </section>
  </div>;
}
