import { useEffect, useRef, useState } from 'react';
import { Box, ClipboardList, Download, ShieldCheck, X } from 'lucide-react';
import { Button, Input, Select } from '../components/ui';
import './new-resource.css';
import './bulk-resource.css';

type Method = 'identical' | 'spreadsheet';
const categories = ['Laptop', 'Monitor', 'Mobile Device', 'Printer', 'Network', 'Tablet', 'POS Device', 'Other'];
const branches = ['Head Office', 'Tbilisi Store 01', 'Kutaisi Store 01', 'Batumi Store 01'];

export default function BulkResourceDialog({ close }: { close: () => void }) {
  const [method, setMethod] = useState<Method>('identical');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Laptop');
  const [quantity, setQuantity] = useState('5');
  const [branch, setBranch] = useState('Head Office');
  const [condition, setCondition] = useState('Good');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (preview) setPreview(false); else close(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close, preview]);
  const showPreview = () => {
    if (method === 'identical' && !name.trim()) { setError('Please enter a resource name.'); return; }
    if (method === 'identical' && (!Number.isInteger(Number(quantity)) || Number(quantity) < 1 || Number(quantity) > 1000)) { setError('Enter a quantity between 1 and 1000.'); return; }
    if (method === 'spreadsheet' && !file) { setError('Choose a CSV or Excel file to preview.'); return; }
    setError(''); setPreview(true);
  };
  const pickFile = (chosen: File | undefined) => {
    if (!chosen) return;
    if (!/\.(csv|xlsx|xls)$/i.test(chosen.name)) { setError('Please select a CSV or Excel file.'); return; }
    setFile(chosen); setError('');
  };
  return <div className="rs-overlay rs-modal-overlay" onMouseDown={close}>
    <section className="nw-modal bw-modal" role="dialog" aria-modal="true" aria-labelledby="bw-title" onMouseDown={event => event.stopPropagation()}>
      <header className="nw-header"><div><span className="nw-preview-label">BULK REGISTRATION</span><h2 id="bw-title">Create multiple resources</h2><p>Register several assets in one batch without repeating the whole form.</p></div><button className="rs-close" aria-label="Close bulk create" onClick={close}><X size={18}/></button></header>
      <div className="nw-content bw-content">
        <div className="bw-intro"><h3>Choose a method</h3><p>Both methods use automatic unique Asset IDs and per-item validation.</p></div>
        <div className="bw-methods" role="group" aria-label="Bulk creation method">
          <button type="button" className={`bw-method ${method === 'identical' ? 'selected' : ''}`} aria-pressed={method === 'identical'} onClick={() => { setMethod('identical'); setError(''); }}><Box size={20}/><strong>Multiple identical items</strong><span>Enter a common description and quantity, then review individual serial numbers.</span></button>
          <button type="button" className={`bw-method ${method === 'spreadsheet' ? 'selected' : ''}`} aria-pressed={method === 'spreadsheet'} onClick={() => { setMethod('spreadsheet'); setError(''); }}><ClipboardList size={20}/><strong>Spreadsheet import</strong><span>Use an Excel or CSV template to prepare varied resources.</span></button>
        </div>
        {method === 'identical' ? <>
          <div className="nw-fields bw-fields"><label className="nw-field nw-full"><span>Resource name <b>*</b></span><Input placeholder="e.g. Dell Latitude 7440" value={name} onChange={event => { setName(event.target.value); setError(''); }}/></label>
            <label className="nw-field"><span>Category</span><Select label="Category" value={category} options={categories} onChange={setCategory}/></label>
            <label className="nw-field"><span>Quantity</span><Input type="number" min={1} max={1000} step={1} value={quantity} onChange={event => { setQuantity(event.target.value); setError(''); }}/></label>
            <label className="nw-field"><span>Branch</span><Select label="Branch" value={branch} options={branches} onChange={setBranch}/></label>
            <label className="nw-field"><span>Condition</span><Select label="Condition" value={condition} options={['Excellent','Good','Fair','Damaged','Poor']} onChange={setCondition}/></label></div>
          <p className="bw-hint">Individual serial numbers and locations are reviewed before final registration.</p>
        </> : <>
          <input ref={fileInput} className="nw-file-input" type="file" accept=".csv,.xlsx,.xls" onChange={event => pickFile(event.target.files?.[0])}/>
          <button type="button" className="nw-dropzone bw-dropzone" onClick={() => fileInput.current?.click()}><Download size={22}/><strong>{file ? file.name : 'Import a CSV or Excel file'}</strong><span>{file ? 'Click to select another file' : 'Prepare data using the official template; rows are validated individually.'}</span></button>
          <p className="bw-hint">Template columns: Name, Category, Branch, Condition, Serial number, Location, Purchase price and Currency.</p>
        </>}
        <div className="nw-notice bw-notice"><span><ShieldCheck size={18}/></span><p><strong>Bulk creation is available only to authorized administrators.</strong> This is a design preview; no resources are inserted.</p></div>
        {error && <p className="nw-error" role="alert">{error}</p>}
      </div>
      <footer className="nw-footer"><span>Bulk workflow concept</span><div><Button onClick={close}>Close</Button><Button variant="primary" onClick={showPreview}>Preview batch →</Button></div></footer>
      {preview && <div className="nw-confirm-overlay" onMouseDown={() => setPreview(false)}><div role="alertdialog" aria-modal="true" aria-label="Batch preview" onMouseDown={event => event.stopPropagation()}><ShieldCheck size={30}/><h3>Batch preview ready</h3><p>{method === 'identical' ? `${quantity} × ${name.trim()} · ${category} · ${branch} · ${condition}` : `Selected file: ${file?.name}. Spreadsheet contents have not been parsed or uploaded.`} No resources have been created.</p><Button variant="primary" onClick={() => setPreview(false)}>Back to bulk create</Button></div></div>}
    </section>
  </div>;
}
