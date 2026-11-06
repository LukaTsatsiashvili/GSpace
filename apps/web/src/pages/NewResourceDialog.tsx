import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Download, ShieldCheck, Wallet, X } from 'lucide-react';
import { Button } from '../components/ui';
import './new-resource.css';

type FormData = {
  name: string; category: string; condition: string; type: string; notes: string;
  branch: string; location: string; serial: string; warranty: string;
  processor: string; ram: string; storage: string; price: string; currency: string;
  purchaseDate: string; supplier: string; usefulLife: string; residual: string;
};

const initial: FormData = {
  name: '', category: 'Laptop', condition: 'Good', type: 'Physical Asset', notes: '',
  branch: 'Head Office', location: '', serial: '', warranty: '', processor: '', ram: '', storage: '',
  price: '', currency: 'GEL', purchaseDate: '', supplier: '', usefulLife: '36', residual: '0'
};
const steps = ['General', 'Specifications', 'Finance', 'Documents', 'Review'];
const categories = ['Laptop', 'Monitor', 'Tablet', 'Mobile Device', 'Printer', 'Network', 'POS Device', 'Other'];
const branches = ['Head Office', 'Tbilisi Store 01', 'Kutaisi Store 01', 'Batumi Store 01'];

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return <label className="nw-field"><span>{label}{required && <b> *</b>}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function SelectField({ label, required, value, options, change }: { label: string; required?: boolean; value: string; options: string[]; change: (value: string) => void }) {
  return <Field label={label} required={required}><span className="nw-select-container"><select value={value} onChange={event => change(event.target.value)}>{options.map(option => <option key={option}>{option}</option>)}</select><ChevronDown size={15}/></span></Field>;
}

function Notice({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="nw-notice"><span>{icon}</span><p>{children}</p></div>;
}

export default function NewResourceDialog({ close }: { close: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const update = (key: keyof FormData) => (value: string) => { setForm(current => ({ ...current, [key]: value })); setError(''); };
  const field = (key: keyof FormData, placeholder = '', type = 'text') => <input type={type} placeholder={placeholder} value={form[key]} onChange={event => update(key)(event.target.value)}/>;
  const go = (next: number) => { setStep(next); setError(''); content.current?.scrollTo({ top: 0 }); };
  const continueStep = () => {
    if (step === 0 && !form.name.trim()) { setError('Please enter a resource name.'); return; }
    if (step === 4) { setPreview(true); return; }
    go(step + 1);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { if (preview) setPreview(false); else close(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, preview]);

  const summary = [
    ['Resource name', form.name], ['Asset ID', 'Automatically generated'],
    ['Resource type', form.type], ['Category', form.category],
    ['Condition', form.condition], ['Branch', form.branch],
    ['Location', form.location || 'Not specified'], ['Serial number', form.serial || 'Not specified'],
    ['Purchase price', form.price ? `${form.price} ${form.currency}` : 'Not specified'],
    ['Supplier', form.supplier || 'Not specified'], ['Attachments', `${files.length} file(s)`]
  ];

  return <div className="rs-overlay rs-modal-overlay" onMouseDown={close}>
    <section className="nw-modal" role="dialog" aria-modal="true" aria-labelledby="nw-title" onMouseDown={event => event.stopPropagation()}>
      <header className="nw-header"><div><span className="nw-preview-label">RESOURCE REGISTER · DESIGN PREVIEW</span><h2 id="nw-title">Add new resource</h2><p>A guided flow for registering physical or digital company assets.</p></div><button className="rs-close" aria-label="Close add resource" onClick={close}><X size={18}/></button></header>
      <nav className="nw-steps" aria-label="Registration steps">{steps.map((name, index) => <div key={name} className={`nw-step ${step === index ? 'current' : ''} ${step > index ? 'complete' : ''}`}><span>{step > index ? <Check size={14}/> : index + 1}</span><strong>{name}</strong></div>)}</nav>
      <div className="nw-content" ref={content}>
        {step === 0 && <>
          <div className="nw-section-title"><div><h3>General information</h3><p>Identify your resource and select its type. The Asset ID is assigned automatically.</p></div><span>01 / 05</span></div>
          <div className="nw-fields"><div className="nw-full"><Field label="Resource name" required>{field('name', 'e.g. Lenovo ThinkPad T14')}</Field></div>
            <SelectField label="Category" required value={form.category} options={categories} change={update('category')}/>
            <SelectField label="Initial condition" required value={form.condition} options={['Excellent','Good','Fair','Damaged','Poor']} change={update('condition')}/>
            <div className="nw-full nw-type"><span>Resource type <b>*</b></span><div>{['Physical Asset','Digital Asset','Bundle'].map(value => <button className={form.type === value ? 'selected' : ''} key={value} aria-pressed={form.type === value} onClick={() => update('type')(value)}>{value}</button>)}</div><small>Consumables, licenses and subscriptions have their own specialized modules and flows.</small></div>
            <div className="nw-full"><Field label="Description / notes"><textarea rows={3} placeholder="Optional notes about this resource" value={form.notes} onChange={event => update('notes')(event.target.value)}/></Field></div></div>
          <Notice icon={<ShieldCheck size={18}/>}> <strong>Administrator-managed registration.</strong> New resources are created by authorized users. The generated identifier and subsequent changes appear in Audit Timeline.</Notice>
        </>}
        {step === 1 && <>
          <div className="nw-section-title"><div><h3>Specifications &amp; location</h3><p>Category-based attributes and where the resource is physically located.</p></div><span>02 / 05</span></div>
          <div className="nw-fields"><SelectField label="Branch" required value={form.branch} options={branches} change={update('branch')}/><Field label="Storage / location">{field('location','e.g. IT Storage — Shelf A')}</Field>
            <Field label="Serial number">{field('serial','Manufacturer serial')}</Field><Field label="Warranty end date">{field('warranty','', 'date')}</Field></div>
          <div className="nw-custom"><div className="nw-custom-title"><h3>{form.category} custom fields</h3><span>Dynamic fields</span></div><p>Relevant fields change when you select a different category. Administrators can configure their definitions.</p><div className="nw-fields"><Field label="Processor">{field('processor','Intel Core i7')}</Field><Field label="RAM">{field('ram','16 GB')}</Field><Field label="Storage">{field('storage','512 GB SSD')}</Field></div></div>
        </>}
        {step === 2 && <>
          <div className="nw-section-title"><div><h3>Purchase &amp; financial information</h3><p>Optional purchase records with currency and depreciation configuration.</p></div><span>03 / 05</span></div>
          <div className="nw-fields"><Field label="Purchase price">{field('price','0.00','number')}</Field><SelectField label="Currency" value={form.currency} options={['GEL','USD','EUR']} change={update('currency')}/>
            <Field label="Purchase date">{field('purchaseDate','','date')}</Field><Field label="Supplier">{field('supplier','Select or enter supplier')}</Field>
            <Field label="Useful life (months)" hint="Straight-line depreciation, when applicable">{field('usefulLife','','number')}</Field><Field label="Residual value" hint="Amount in the purchase currency">{field('residual','','number')}</Field></div>
          <Notice icon={<Wallet size={18}/>}><strong>Sensitive financial fields.</strong> Values are displayed only to users with Finance permissions. Production records retain the original amount and GEL conversion with the applicable exchange rate.</Notice>
        </>}
        {step === 3 && <>
          <div className="nw-section-title"><div><h3>Attachments &amp; documents</h3><p>Organize invoices, warranties, photos, contracts or supporting files.</p></div><span>04 / 05</span></div>
          <input ref={fileInput} className="nw-file-input" type="file" multiple onChange={event => setFiles(current => [...current, ...Array.from(event.target.files ?? [])])}/>
          <button className="nw-dropzone" onClick={() => fileInput.current?.click()}><Download size={21}/><strong>Choose files to attach</strong><span>PDF, images, spreadsheets and other supporting files · multiple files supported</span></button>
          {files.length ? <div className="nw-file-list">{files.map((file, index) => <div key={`${file.name}-${index}`}><span>{file.name}</span><button aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><X size={14}/></button></div>)}</div> : <p className="nw-files-caption">No files selected. You can continue without attachments.</p>}
          <Notice icon={<ShieldCheck size={18}/>}><strong>Storage policy.</strong> Per the approved requirement, production attachments will be stored in the database. This preview only lists selected file names and never uploads their contents.</Notice>
        </>}
        {step === 4 && <>
          <div className="nw-section-title"><div><h3>Review resource information</h3><p>Check the details before completing the workflow.</p></div><span>05 / 05</span></div>
          <div className="nw-review-grid">{summary.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
          <Notice icon={<ShieldCheck size={18}/>}><strong>Preview only.</strong> Registration will be completed through the authenticated API in a future phase. No database changes are made here.</Notice>
        </>}
        {error && <p className="nw-error" role="alert">{error}</p>}
      </div>
      <footer className="nw-footer"><span>Step {step + 1} of 5 · Registration prototype</span><div>{step === 0 ? <Button onClick={close}>Close</Button> : <Button onClick={() => go(step - 1)}>Back</Button>}<Button variant="primary" onClick={continueStep}>{step === 4 ? 'Preview registration ✓' : 'Continue →'}</Button></div></footer>
      {preview && <div className="nw-confirm-overlay" onMouseDown={() => setPreview(false)}><div role="alertdialog" aria-modal="true" aria-label="Registration preview" onMouseDown={event => event.stopPropagation()}><ShieldCheck size={30}/><h3>Registration preview ready</h3><p><strong>{form.name}</strong> has been reviewed. This design preview does not create any records or upload attachments.</p><Button variant="primary" onClick={() => setPreview(false)}>Back to review</Button></div></div>}
    </section>
  </div>;
}
