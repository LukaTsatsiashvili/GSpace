import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { ArrowRight, Inbox } from 'lucide-react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet';
  icon?: ReactNode;
};

export function Button({ variant = 'secondary', icon, children, className = '', ...props }: ButtonProps) {
  return <button className={`ui-button ui-button-${variant} ${className}`} {...props}>{icon}{children}</button>;
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
