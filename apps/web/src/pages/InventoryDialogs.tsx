import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Box, ClipboardCheck, X } from 'lucide-react';
import { Badge, Button, Input, NumberInput, Select, Textarea } from '../components/ui';
import {
  branches, employees, isLowStock, stockItems,
  type InventoryItem, type StorageLocation
} from './inventory-data';

function useInventoryEscape(close: () => void) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('.ui-select[aria-expanded="true"]')) return;
      event.stopImmediatePropagation();
      close();
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = previous;
    };
  }, [close]);
}

function ModalHeader({ eyebrow, heading, subtitle, close, id }: {
  eyebrow: string; heading: string; subtitle: string; close: () => void; id: string;
}) {
  return <header className="iv-modal-header"><div>
    <Badge tone="blue">{eyebrow}</Badge>
    <h2 id={id}>{heading}</h2><p>{subtitle}</p>
  </div><button type="button" className="iv-close" onClick={close} aria-label="Close dialog"><X size={17}/></button></header>;
}

function Field({ title, required = false, children }: { title: string; required?: boolean; children: ReactNode }) {
  return <label className="iv-field"><span>{title}{required && <b> *</b>}</span>{children}</label>;
}

export function InventoryNotice({ heading, description, close }: { heading: string; description: string; close: () => void }) {
  return <div className="iv-notice-overlay" onMouseDown={close}><section className="iv-notice-dialog" role="alertdialog" aria-modal="true" aria-labelledby="iv-notice-title" onMouseDown={event => event.stopPropagation()}>
    <span className="iv-notice-icon"><ClipboardCheck size={23}/></span><h3 id="iv-notice-title">{heading}</h3>
    <p>{description}</p><Button variant="primary" onClick={close}>Got it</Button>
  </section></div>;
}

function Availability({ low }: { low: boolean }) {
  return <span className={'iv-availability ' + (low ? 'low' : 'ok')}><i/>{low ? 'Low stock' : 'In stock'}</span>;
}

export function StorageLocationDrawer({ location, close }: { location: StorageLocation; close: () => void }) {
  useInventoryEscape(close);
  const items = stockItems.filter(item => item.branch === location.branch && item.location === location.name);
  return <div className="iv-overlay iv-side-overlay" onMouseDown={close}><aside className="iv-drawer iv-location-drawer" role="dialog" aria-modal="true" aria-labelledby="iv-location-title" onMouseDown={e => e.stopPropagation()}>
    <ModalHeader id="iv-location-title" eyebrow="STORAGE LOCATION" heading={location.name} subtitle={location.branch} close={close}/>
    <div className="iv-drawer-body">
      <div className="iv-detail-grid"><div><small>Branch</small><strong>{location.branch}</strong></div><div><small>Tracked units</small><strong>{location.tracked}</strong></div></div>
      <section className="iv-detail-section"><h3>Stock at this location</h3><div className="iv-location-stock-list">
        {items.map(item => <div className="iv-location-stock" key={item.id}>
          <span className="iv-stock-box"><Box size={17}/></span>
          <div><strong>{item.name}</strong><small>{item.onHand} {item.unit} on hand · minimum {item.minimum}</small></div>
          <Availability low={isLowStock(item)}/>
        </div>)}
        {!items.length && <div className="iv-empty-inline">No illustrative stock records at this location.</div>}
      </div></section>
      <p className="iv-note">Locations belong to a specific branch; multiple storage points per branch are supported.</p>
    </div>
    <footer className="iv-drawer-footer"><Button onClick={close}>Close</Button></footer>
  </aside></div>;
}

export function StockItemDrawer({ item, close }: { item: InventoryItem; close: () => void }) {
  useInventoryEscape(close);
  return <div className="iv-overlay iv-side-overlay" onMouseDown={close}><aside className="iv-drawer" role="dialog" aria-modal="true" aria-labelledby="iv-item-title" onMouseDown={e => e.stopPropagation()}>
    <ModalHeader id="iv-item-title" eyebrow={item.id} heading={item.name} subtitle="Stock level and storage details" close={close}/>
    <div className="iv-drawer-body">
      <div className="iv-item-summary"><span className="iv-stock-box"><Box size={19}/></span><div><strong>{item.category}</strong><small>Updated {item.updated}</small></div><Availability low={isLowStock(item)}/></div>
      <section className="iv-detail-section"><h3>Stock overview</h3><div className="iv-detail-grid">
        <div><small>Branch</small><strong>{item.branch}</strong></div>
        <div><small>Storage location</small><strong>{item.location}</strong></div>
        <div><small>On hand</small><strong>{item.onHand} {item.unit}</strong></div>
        <div><small>Minimum</small><strong>{item.minimum} {item.unit}</strong></div>
      </div></section>
      <p className="iv-note">This is an illustrative inventory record. Actual stock changes will be handled by the authenticated inventory workflow.</p>
    </div>
    <footer className="iv-drawer-footer"><Button onClick={close}>Close</Button></footer>
  </aside></div>;
}

export function AddLocationDialog({ close }: { close: () => void }) {
  const [branch, setBranch] = useState('Head Office');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(false);
  useInventoryEscape(() => {
    if (notice) setNotice(false);
    else if (review) setReview(false);
    else close();
  });

  const goReview = () => {
    if (!name.trim()) { setError('Location name is required.'); return; }
    setError(''); setReview(true);
  };
  return <div className="iv-overlay iv-modal-overlay" onMouseDown={close}><section className="iv-modal iv-location-modal" role="dialog" aria-modal="true" aria-labelledby="iv-new-location-title" onMouseDown={e => e.stopPropagation()}>
    <ModalHeader id="iv-new-location-title" eyebrow={review ? 'LOCATION PREVIEW' : 'NEW STORAGE LOCATION'}
      heading={review ? 'Review storage location' : 'Add warehouse or location'}
      subtitle={review ? 'Check the location details before closing this preview.' : 'Organize stock within an existing branch.'} close={close}/>
    <div className="iv-modal-body">
      {review ? <>
        <div className="iv-detail-grid"><div><small>Branch</small><strong>{branch}</strong></div><div><small>Location name</small><strong>{name.trim()}</strong></div></div>
        <section className="iv-detail-section"><h3>Notes</h3><p className="iv-preview-text">{notes.trim() || 'No notes specified'}</p></section>
        <p className="iv-note">Preview only. No new storage location has been added to the database.</p>
      </> : <>
        <div className="iv-form-grid">
          <Field title="Branch" required><Select label="Branch" value={branch} options={branches} onChange={setBranch}/></Field>
          <Field title="Location name" required><Input placeholder="e.g. Backroom B" value={name} onChange={e => { setName(e.target.value); setError(''); }}/></Field>
          <div className="iv-full"><Field title="Notes"><Textarea rows={3} placeholder="Optional location description" value={notes} onChange={e => setNotes(e.target.value)}/></Field></div>
        </div>
        <p className="iv-note">A branch can contain multiple warehouses, cabinets and stockrooms.</p>
        {error && <p className="iv-validation" role="alert">{error}</p>}
      </>}
    </div>
    <footer className="iv-modal-footer">
      {review ? <Button onClick={() => setReview(false)}>Back to edit</Button> : <span>Design preview</span>}
      <Button variant="primary" onClick={() => review ? setNotice(true) : goReview()}>{review ? 'Preview creation' : 'Preview location'} <ArrowRight size={15}/></Button>
    </footer>
    {notice && <InventoryNotice heading="Location preview ready" description="The new storage location has been reviewed, but no database record or storage location has been created." close={() => setNotice(false)}/>}
  </section></div>;
}

export function IssueConsumablesDialog({ close }: { close: () => void }) {
  const [itemId, setItemId] = useState(stockItems[0].id);
  const [quantity, setQuantity] = useState('');
  const [recipient, setRecipient] = useState('Select employee...');
  const [purpose, setPurpose] = useState('');
  const [review, setReview] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(false);
  const item = useMemo(() => stockItems.find(x => x.id === itemId) ?? stockItems[0], [itemId]);
  const itemOptions = stockItems.map(x => x.name + ' · ' + x.onHand + ' ' + x.unit);
  const currentChoice = item.name + ' · ' + item.onHand + ' ' + item.unit;
  useInventoryEscape(() => {
    if (notice) setNotice(false);
    else if (review) setReview(false);
    else close();
  });

  const goReview = () => {
    const n = Number(quantity);
    if (!quantity.trim() || !Number.isInteger(n) || n < 1) { setError('Enter a positive whole-number quantity.'); return; }
    if (n > item.onHand) { setError('Quantity cannot exceed the available stock (' + item.onHand + ' ' + item.unit + ').'); return; }
    if (recipient === 'Select employee...') { setError('Please choose the recipient.'); return; }
    setError(''); setReview(true);
  };

  return <div className="iv-overlay iv-modal-overlay" onMouseDown={close}><section className="iv-modal iv-issue-modal" role="dialog" aria-modal="true" aria-labelledby="iv-issue-title" onMouseDown={e => e.stopPropagation()}>
    <ModalHeader id="iv-issue-title" eyebrow={review ? 'STOCK ISSUE · REVIEW' : 'STOCK ISSUE'}
      heading={review ? 'Review consumables issue' : 'Issue consumables'}
      subtitle={review ? 'Check the issue details before closing this preview.' : 'Record who receives consumable units.'} close={close}/>
    <div className="iv-modal-body">
      {review ? <>
        <div className="iv-detail-grid">
          <div><small>Stock item</small><strong>{item.name}</strong></div>
          <div><small>Quantity to issue</small><strong>{quantity} {item.unit}</strong></div>
          <div><small>Branch / location</small><strong>{item.branch} · {item.location}</strong></div>
          <div><small>Recipient</small><strong>{recipient}</strong></div>
        </div>
        <section className="iv-detail-section"><h3>Issue purpose</h3><p className="iv-preview-text">{purpose.trim() || 'Not specified'}</p></section>
        <p className="iv-note">Preview only. Stock quantities, issue history and user records have not changed.</p>
      </> : <>
        <div className="iv-form-grid">
          <Field title="Stock item" required><Select label="Stock item" value={currentChoice} options={itemOptions} onChange={value => {
            const index = itemOptions.indexOf(value);
            if (index !== -1) { setItemId(stockItems[index].id); setQuantity(''); setError(''); }
          }}/></Field>
          <Field title="Quantity to issue" required><NumberInput inputMode="numeric" min={1} max={item.onHand} step={1} placeholder="e.g. 5" value={quantity} onChange={e => { setQuantity(e.target.value); setError(''); }}/></Field>
          <Field title="Branch / location" required><Input value={item.branch + ' · ' + item.location} aria-label="Branch and location" disabled readOnly/></Field>
          <Field title="Recipient" required><Select label="Recipient" options={['Select employee...', ...employees]} value={recipient} onChange={e => { setRecipient(e); setError(''); }}/></Field>
          <div className="iv-full"><Field title="Issue purpose (optional)"><Textarea placeholder="Optional purpose or project" rows={3} value={purpose} onChange={e => setPurpose(e.target.value)}/></Field></div>
        </div>
        <p className="iv-note">Issuing consumables decreases stock and records recipient plus quantity. Recipient confirmation is not required in the future production workflow.</p>
        {error && <p role="alert" className="iv-validation">{error}</p>}
      </>}
    </div>
    <footer className="iv-modal-footer">
      {review ? <Button onClick={() => setReview(false)}>Back to edit</Button> : <span>No real stock will be modified</span>}
      <Button variant="primary" onClick={() => review ? setNotice(true) : goReview()}>{review ? 'Preview confirmation' : 'Preview issue'} <ArrowRight size={15}/></Button>
    </footer>
    {notice && <InventoryNotice heading="Consumables issue preview" description="No inventory quantities, stock movements or database records have been changed. This was a UI demonstration only." close={() => setNotice(false)}/>}
  </section></div>;
}
