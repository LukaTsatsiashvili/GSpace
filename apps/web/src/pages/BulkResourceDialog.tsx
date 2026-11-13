import { useEffect, useState } from 'react';
import { Boxes, ShieldCheck, X } from 'lucide-react';
import { Button, Input, NumberInput, Select } from '../components/ui';
import { resourceApi, type Category, type Branch, type ResourceCondition, type ResourcePayload } from './resource-api';
import './new-resource.css';
import './bulk-resource.css';

const conditions: ResourceCondition[] = ['Excellent', 'Good', 'Fair', 'Damaged', 'Poor'];

export default function BulkResourceDialog({ close, categories, branches, saved }: {
  close: () => void; categories: Category[]; branches: Branch[];
  saved: (message: string) => void
}) {
  const [name, setName] = useState('');
  const [categoryName, setCategoryName] = useState(categories[0]?.name ?? '');
  const [branchId, setBranchId] = useState(branches[0]?.id ?? '');
  const [condition, setCondition] = useState<ResourceCondition>('Good');
  const [quantity, setQuantity] = useState('5');
  const [preview, setPreview] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const branch = branches.find(item => item.id === branchId);
  const category = categories.find(item => item.name === categoryName);
  const requiredFields = category?.definitions.filter(field => field.required) ?? [];

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending && !document.querySelector('.ui-select-options')) {
        if (preview) setPreview(false); else close();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [close, pending, preview]);

  function review() {
    setError('');
    if (name.trim().length < 2 || name.trim().length > 180) {
      setError('Resource name must contain 2–180 characters.'); return;
    }
    if (!category || !branch) {
      setError('Choose an active category and branch.'); return;
    }
    if (!quantity.trim() || !Number.isInteger(Number(quantity)) ||
        Number(quantity) < 1 || Number(quantity) > 100) {
      setError('Quantity must be a whole number from 1 to 100.'); return;
    }
    setPreview(true);
  }

  async function create() {
    if (pending || !category || !branch) return;
    setPending(true); setError('');
    try {
      const template: Omit<ResourcePayload, 'serialNumber'> = {
        name: name.trim(), category: category.name, branchId: branch.id,
        resourceType: 'Physical Asset', condition, status: 'AVAILABLE',
        location: '', description: '', warrantyEnd: null,
        purchasePrice: null, currency: 'GEL', purchaseDate: null, supplier: '',
        usefulLifeMonths: null, residualValue: null, customFields: {}
      };
      const result = await resourceApi.bulk({ quantity: Number(quantity), template });
      saved(result.count + ' resources registered (' + result.firstCode + ' – ' + result.lastCode + ').' +
        (requiredFields.length ? ' Complete required category fields through Edit resource.' : ''));
    } catch (err) {
      setPreview(false);
      setError(err instanceof Error ? err.message : 'Could not create resources.');
    } finally { setPending(false); }
  }

  return <div className="rs-overlay rs-modal-overlay" onMouseDown={() => { if (!pending) close(); }}>
    <section className="nw-modal bw-modal" role="dialog" aria-modal="true"
      aria-labelledby="bw-title" onMouseDown={event => event.stopPropagation()}>
      <header className="nw-header">
        <div>
          <span className="nw-preview-label">BULK REGISTRATION · POSTGRESQL</span>
          <h2 id="bw-title">Create multiple resources</h2>
          <p>Register identical resources with a separate Asset ID for each item.</p>
        </div>
        <button className="rs-close" type="button" aria-label="Close bulk create"
          disabled={pending} onClick={close}><X size={18}/></button>
      </header>
      <div className="nw-content bw-content">
        <div className="bw-intro">
          <span className="bw-intro-icon"><Boxes size={19}/></span>
          <div><h3>Multiple identical items</h3>
            <p>Choose shared details and quantity. Each item becomes a separate resource.</p>
          </div>
        </div>
        <div className="nw-fields bw-fields">
          <label className="nw-field nw-full"><span>Resource name <b>*</b></span>
            <Input placeholder="e.g. Dell Latitude 7440" maxLength={180} value={name}
              onChange={event => { setName(event.target.value); setError(''); }}/></label>
          <label className="nw-field"><span>Category <b>*</b></span>
            <Select label="Resource category" value={categoryName}
              options={categories.map(item => item.name)}
              onChange={value => { setCategoryName(value); setError(''); }}/></label>
          <label className="nw-field"><span>Quantity (1–100) <b>*</b></span>
            <NumberInput inputMode="numeric" min={1} max={100} step={1} value={quantity}
              onChange={event => { setQuantity(event.target.value); setError(''); }}/></label>
          <label className="nw-field"><span>Branch <b>*</b></span>
            <Select label="Resource branch" value={branch?.name ?? ''}
              options={branches.map(item => item.name)}
              onChange={value => {
                setBranchId(branches.find(item => item.name === value)?.id ?? '');
                setError('');
              }}/></label>
          <label className="nw-field"><span>Condition <b>*</b></span>
            <Select label="Resource condition" value={condition} options={conditions}
              onChange={value => { setCondition(value as ResourceCondition); setError(''); }}/></label>
        </div>
        <p className="bw-hint">Serial numbers and other individual details can be added later using Edit resource.</p>
        {requiredFields.length > 0 && <div className="bw-required-note" role="note">
          <strong>{category?.name}: {requiredFields.length} required custom field{requiredFields.length === 1 ? '' : 's'}</strong>
          <p>{requiredFields.map(field => field.label).join(', ')}</p>
          <p>Registration is allowed now. Fill these fields for each resource through <strong>Edit resource</strong> later.</p>
        </div>}
        <div className="nw-notice bw-notice"><span><ShieldCheck size={18}/></span>
          <p><strong>Safe bulk registration.</strong> Every asset receives its own Asset ID.
            The batch saves together and all creations are audited.</p>
        </div>
        {error && <p className="nw-error" role="alert">{error}</p>}
      </div>
      <footer className="nw-footer">
        <span>1–100 resources per batch</span>
        <div><Button disabled={pending} onClick={close}>Close</Button>
          <Button variant="primary" disabled={pending} onClick={review}>Review batch</Button></div>
      </footer>
      {preview && <div className="nw-confirm-overlay"
        onMouseDown={() => { if (!pending) setPreview(false); }}>
        <div role="alertdialog" aria-modal="true" aria-label="Confirm bulk registration"
          onMouseDown={event => event.stopPropagation()}>
          <ShieldCheck size={30}/><h3>Confirm batch registration</h3>
          <p>{quantity} × {name.trim()} · {category?.name} · {branch?.name} · {condition}.
            Each resource will receive a unique Asset ID.</p>
          {requiredFields.length > 0 && <p className="bw-confirm-required">
            Required Custom Fields will remain unfilled until you edit the created assets.
          </p>}
          <div className="bw-confirm-actions">
            <Button disabled={pending} onClick={() => setPreview(false)}>Back</Button>
            <Button variant="primary" disabled={pending} onClick={() => { void create(); }}>
              {pending ? 'Creating...' : 'Create resources'}
            </Button>
          </div>
        </div>
      </div>}
    </section>
  </div>;
}
