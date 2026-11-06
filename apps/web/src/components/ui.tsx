import { useEffect, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, ChevronDown, Inbox } from 'lucide-react';

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

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`ui-input ui-textarea ${className}`} {...props}/>;
}

export function Select({ value, options, onChange, label, className = '' }: {
  value: string; options: readonly string[]; onChange: (value: string) => void; label: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });
  const trigger = useRef<HTMLButtonElement>(null);
  const calculate = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    const showAbove = below < 190 && above > below;
    const maxHeight = Math.min(260, Math.max(100, (showAbove ? above : below) - 18));
    setPosition({ top: showAbove ? rect.top - 6 - maxHeight : rect.bottom + 6, left: rect.left, width: rect.width, maxHeight });
  };
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', key);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); document.removeEventListener('keydown', key); };
  }, [open]);
  return <div className={`ui-select-wrap ${className}`}><button ref={trigger} type="button" className="ui-select" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => { if (!open) calculate(); setOpen(!open); }}><span>{value}</span><ChevronDown size={15}/></button>
    {open && createPortal(<><button type="button" className="ui-select-dismiss" aria-label="Close dropdown" onClick={() => setOpen(false)}/><div className="ui-select-options" role="listbox" aria-label={label} style={{ top: position.top, left: position.left, minWidth: position.width, maxHeight: position.maxHeight }}>{options.map(option => <button type="button" key={option} role="option" aria-selected={option === value} onClick={() => { onChange(option); setOpen(false); }}>{option}{option === value && <Check size={14}/>}</button>)}</div></>, document.body)}
  </div>;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'green' | 'amber' }) {
  return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`ui-card ${className}`} {...props}>{children}</section>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="page-header">
    <div className="page-header-copy"><div className="eyebrow">{eyebrow}</div><h1>{title} <Badge>UI foundation</Badge></h1><p>{description}</p></div>
    {actions && <div className="page-header-actions">{actions}</div>}
  </div>;
}

export function SectionTabs({ tabs, selected, onChange }: { tabs: readonly string[]; selected: string; onChange: (tab: string) => void }) {
  return <div className="section-tabs" role="tablist" aria-label="Section views">{tabs.map((tab) => <button key={tab} role="tab" aria-selected={selected === tab} className={`section-tab ${selected === tab ? 'active' : ''}`} onClick={() => onChange(tab)}>{tab}</button>)}</div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><div className="empty-state-icon"><Inbox size={25} /></div><h3>{title}</h3><p>{description}</p><span className="empty-state-next">Feature implementation coming next <ArrowRight size={14}/></span></div>;
}
