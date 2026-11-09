import { useEffect, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, ChevronDown, Inbox, Search } from 'lucide-react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet';
  icon?: ReactNode;
};

export function Button({ variant = 'secondary', icon, children, className = '', ...props }: ButtonProps) {
  return <button className={`ui-button ui-button-${variant} ${className}`} {...props}>{icon}{children}</button>;
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`ui-input ${className}`} {...props}/>;
}

/** Shared numeric control: hide browser steppers and use one thin focus border. */
export function NumberInput({ className = '', inputMode = 'decimal', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return <Input {...props} type="number" inputMode={inputMode} className={`ui-number-input ${className}`}/>;
}

/** Consistent search control: one focus ring, one border, shared sizing and theme tokens. */
export function SearchInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <div className={`ui-search ${className}`}>
    <Search size={16} aria-hidden="true"/>
    <Input {...props} type={props.type ?? 'search'} className="ui-search-field"/>
  </div>;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ui-input ui-textarea ${className}`} {...props}/>;
}

export function Select({ value, options, onChange, label, className = '' }: {
  value: string; options: readonly string[]; onChange: (value: string) => void; label: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });
  const [menuTheme, setMenuTheme] = useState<CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const calculate = () => {
    const element = trigger.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    // The menu is portaled outside `.app` to avoid clipped modal scroll areas.
    // Copy theme tokens so its colors remain identical to the originating control.
    const computed = getComputedStyle(element);
    const tokens = ['--surface', '--surface2', '--text', '--muted', '--border', '--accent', '--accent-soft'];
    setMenuTheme(Object.fromEntries(tokens.map(token => [token, computed.getPropertyValue(token).trim()])) as CSSProperties);
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    const desiredHeight = Math.min(options.length * 39 + 12, 370);
    const showAbove = below < Math.min(desiredHeight, 190) && above > below;
    const available = Math.max(80, (showAbove ? above : below) - 14);
    const maxHeight = Math.min(desiredHeight, available);
    setPosition({ top: showAbove ? rect.top - 6 - maxHeight : rect.bottom + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: rect.width, maxHeight });
  };
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onScroll = (event: Event) => {
      // Scrolling the portaled options list is an intentional interaction.
      // Only an outside scroll should dismiss the floating menu.
      if (event.target instanceof Node && menu.current?.contains(event.target)) return;
      close();
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', key);
    return () => { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', close); document.removeEventListener('keydown', key); };
  }, [open]);
  return <div className={`ui-select-wrap ${className}`}><button ref={trigger} type="button" className="ui-select" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => { if (!open) calculate(); setOpen(!open); }}><span>{value}</span><ChevronDown size={15}/></button>
    {open && createPortal(<><button type="button" className="ui-select-dismiss" aria-label="Close dropdown" onClick={() => setOpen(false)}/><div ref={menu} className="ui-select-options" role="listbox" aria-label={label} style={{ ...menuTheme, top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}>{options.map(option => <button type="button" key={option} role="option" aria-selected={option === value} onClick={() => { onChange(option); setOpen(false); }}>{option}{option === value && <Check size={14}/>}</button>)}</div></>, document.body)}
  </div>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'green' | 'amber' }) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`ui-card ${className}`} {...props}>{children}</section>;
}

export function PageHeader({ eyebrow, title, description, actions, badgeLabel = 'UI foundation' }: { eyebrow: string; title: string; description: string; actions?: ReactNode; badgeLabel?: string }) {
  return <div className="page-header">
    <div className="page-header-copy"><div className="eyebrow">{eyebrow}</div><h1>{title} <Badge>{badgeLabel}</Badge></h1><p>{description}</p></div>
    {actions && <div className="page-header-actions">{actions}</div>}
  </div>;
}

export function SectionTabs({ tabs, selected, onChange, counts = {} }: { tabs: readonly string[]; selected: string; onChange: (tab: string) => void; counts?: Partial<Record<string, number>> }) {
  return <div className="section-tabs" role="tablist" aria-label="Section views">{tabs.map((tab) => <button key={tab} role="tab" aria-selected={selected === tab} className={`section-tab ${selected === tab ? 'active' : ''}`} onClick={() => onChange(tab)}>{tab}{counts[tab] !== undefined && <span className="section-tab-count">{counts[tab]}</span>}</button>)}</div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><div className="empty-state-icon"><Inbox size={25} /></div><h3>{title}</h3><p>{description}</p><span className="empty-state-next">Feature implementation coming next <ArrowRight size={14}/></span></div>;
}
