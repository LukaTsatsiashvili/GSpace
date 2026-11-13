import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button, Checkbox, Input, Select } from '../components/ui';
import { resourceApi, type Category, type CustomDefinition } from './resource-api';
import './resource-categories.css';

const blank = (): CustomDefinition => ({ key: '', label: '', required: false });
export default function ResourceCategoriesDialog({ close, categories, saved }: {
  close: () => void; categories: Category[]; saved: () => void
}) {
  const [selected, setSelected] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [fields, setFields] = useState<CustomDefinition[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending && !document.querySelector('.ui-select-options')) close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [close, pending]);
  function select(category: Category | null) {
    setSelected(category); setName(category?.name ?? '');
    setFields(category ? category.definitions.map(f => ({ ...f })) : []);
    setError('');
  }
  function field(index: number, key: keyof CustomDefinition, value: string | boolean) {
    setFields(old => old.map((item, i) => i === index ? ({ ...item, [key]: value }) : item));
    setError('');
  }
  async function save() {
    if (pending) return;
    if (name.trim().length < 2 || name.trim().length > 180) {
      setError('Category name must contain 2–180 characters.'); return;
    }
    if (fields.some(f => !/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(f.key) || f.label.trim().length < 2)) {
      setError('Each custom field needs a valid key and label.'); return;
    }
    if (new Set(fields.map(f => f.key)).size !== fields.length) {
      setError('Custom field keys must be unique.'); return;
    }
    setPending(true); setError('');
    try {
      if (selected) await resourceApi.categoryUpdate(selected.id, {
        name: name.trim(), definitions: fields, active: true
      });
      else await resourceApi.categoryCreate({ name: name.trim(), definitions: fields });
      saved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save category.'); }
    finally { setPending(false); }
  }
  return <div className="rs-overlay rs-modal-overlay" onMouseDown={() => { if (!pending) close(); }}>
    <section className="rc-modal" role="dialog" aria-modal="true" aria-labelledby="rc-title"
      onMouseDown={e => e.stopPropagation()}>
      <header className="rc-header">
        <div><h2 id="rc-title">Resource categories</h2>
          <p>Configure available categories and their custom fields.</p></div>
        <button type="button" className="rs-close" aria-label="Close categories" onClick={close}><X size={18}/></button>
      </header>
      <div className="rc-content">
        <div className="rc-toolbar"><label htmlFor="rc-categories">Select category</label>
          <Select label="Select resource category" value={selected?.name ?? 'New category'}
            options={['New category', ...categories.map(c => c.name)]}
            onChange={value => select(categories.find(c => c.name === value) ?? null)}/>
          <Button onClick={() => select(null)} icon={<Plus size={15}/>}>New</Button>
        </div>
        <div className="rc-field">
          <label htmlFor="rc-name">Category name *</label>
          <Input id="rc-name" value={name} maxLength={180}
            placeholder="e.g. Furniture" onChange={e => { setName(e.target.value); setError(''); }}/>
        </div>
        <div className="rc-fields-heading"><div><h3>Custom field definitions</h3>
          <p>Additional information requested when registering a resource of this category.</p></div>
          <Button disabled={fields.length >= 20} icon={<Plus size={15}/>}
            onClick={() => setFields(old => [...old, blank()])}>Add field</Button>
        </div>
        {fields.map((def, index) => <div key={index} className="rc-field-row">
          <div className="rc-field"><label htmlFor={'rc-field-key-' + index}>Field key</label>
            <Input id={'rc-field-key-' + index} maxLength={40} placeholder="e.g. screenSize"
              value={def.key} onChange={e => field(index, 'key', e.target.value)}/></div>
          <div className="rc-field"><label htmlFor={'rc-field-label-' + index}>Label</label>
            <Input id={'rc-field-label-' + index} maxLength={80} placeholder="e.g. Screen size"
              value={def.label} onChange={e => field(index, 'label', e.target.value)}/></div>
          <label className="rc-checkbox"><Checkbox checked={def.required}
            onChange={e => field(index, 'required', e.target.checked)}/>Required</label>
          <Button aria-label={'Remove ' + (def.label || def.key || 'field')} icon={<Trash2 size={15}/>}
            disabled={pending} onClick={() => setFields(old => old.filter((_, i) => i !== index))}/>
        </div>)}
        {!fields.length && <p className="rc-empty">No custom fields. You can add fields as needed.</p>}
        <p className="rc-note">Field keys are stored with each resource. Changing existing keys can require updating existing assets.</p>
        {error && <p className="nw-error" role="alert">{error}</p>}
      </div>
      <footer className="rc-footer"><Button disabled={pending} onClick={close}>Close</Button>
        <Button variant="primary" disabled={pending} onClick={() => { void save(); }}>
          {pending ? 'Saving...' : selected ? 'Save category' : 'Create category'}
        </Button>
      </footer>
    </section>
  </div>;
}
