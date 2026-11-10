import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, CalendarClock, CreditCard, KeyRound, Plus, UsersRound } from 'lucide-react';
import { Badge, Button, Card, PageHeader, SearchInput, SectionTabs, Select } from '../components/ui';
import { currencyText, expenses, initials, licenseTabs, licenses, type LicenseRecord, type LicenseTab, type LicenseStatus } from './licenses-data';
import { AddLicenseDialog, LicenseDialog, LicenseNotice } from './LicensesDialogs';
import './licenses.css';

const statusOptions = ['All statuses', 'Active', 'Renewal soon', 'Expired'];
const typeOptions = ['All types', 'Individual', 'Multi-user', 'Device-bound'];
const upcoming = ['LIC-00218', 'LIC-00216', 'LIC-00214', 'LIC-00217', 'LIC-00213'];

function Status({ status }: { status: LicenseStatus }) {
  return <span className={'lic-status lic-status-' + status.toLowerCase().replace(' ', '-')}><i/>{status}</span>;
}

function LicenseIdentity({ license }: { license: LicenseRecord }) {
  return <div className="lic-identity"><span className="lic-product-mark" aria-hidden="true">{license.name.charAt(0)}</span>
    <div><strong>{license.name}</strong><small>{license.id} · {license.edition}</small></div>
  </div>;
}

function Usage({ assigned, total }: { assigned: number; total: number }) {
  return <div className="lic-seat-meter"><strong>{assigned} / {total}</strong>
    <div className="lic-meter" role="progressbar" aria-label="Assigned seats" aria-valuenow={assigned} aria-valuemin={0} aria-valuemax={total}><span style={{ width: (total ? assigned / total * 100 : 0) + '%' }}/></div>
    <small>{total - assigned} available</small>
  </div>;
}

export default function LicensesPage() {
  const [tab, setTab] = useState<LicenseTab>('All licenses');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [type, setType] = useState('All types');
  const [active, setActive] = useState<LicenseRecord | null>(null);
  const [activeView, setActiveView] = useState<'details' | 'renewal' | 'seats'>('details');
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState('');

  const filtered = useMemo(() => licenses.filter(item => {
    const query = search.trim().toLowerCase();
    return (!query || [item.id, item.name, item.vendor, item.owner, item.edition].some(value => value.toLowerCase().includes(query)))
      && (status === 'All statuses' || item.status === status)
      && (type === 'All types' || item.model === type);
  }), [search, status, type]);

  function clear() { setSearch(''); setStatus('All statuses'); setType('All types'); }
  function open(license: LicenseRecord, view: 'details' | 'renewal' | 'seats' = 'details') {
    setActive(license); setActiveView(view);
  }
  function keyOpen(event: React.KeyboardEvent<HTMLTableRowElement>, license: LicenseRecord) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(license); }
  }
  const exportNotice = 'Exports are a design preview only. A real export requires connected and authorized license data.';

  return <div className="lic-page">
    <PageHeader eyebrow="MANAGEMENT / SOFTWARE & SERVICES" title="Licenses & Subscriptions" badgeLabel="UI concept · sample data"
      description="Control license ownership, seat allocation, recurring costs and upcoming renewals."
      actions={<><Button icon={<ArrowDownToLine size={16}/>} onClick={() => setNotice(exportNotice)}>Export</Button>
        <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setAdding(true)}>Add license</Button></>}/>
    <div className="lic-stats">
      <Card className="lic-stat"><div className="lic-stat-label"><span>Active subscriptions</span><span className="lic-stat-icon blue"><KeyRound size={19}/></span></div><strong>48</strong><small>Across vendors and branches</small></Card>
      <Card className="lic-stat"><div className="lic-stat-label"><span>Renewals in 30 days</span><span className="lic-stat-icon amber"><CalendarClock size={19}/></span></div><strong>6</strong><small>2 need attention this week</small></Card>
      <Card className="lic-stat"><div className="lic-stat-label"><span>Assigned seats</span><span className="lic-stat-icon green"><UsersRound size={19}/></span></div><strong>184<span> / 218</span></strong><small>34 seats currently available</small></Card>
      <Card className="lic-stat"><div className="lic-stat-label"><span>Annual forecast</span><span className="lic-stat-icon purple"><CreditCard size={19}/></span></div><strong>₾ 94.2k</strong><small>Converted estimate · sample</small></Card>
    </div>

    <Card className="lic-content">
      <SectionTabs tabs={licenseTabs} selected={tab} onChange={value => setTab(value as LicenseTab)}/>
      {tab === 'All licenses' && <>
        <div className="lic-toolbar"><SearchInput className="lic-search" aria-label="Search licenses" placeholder="Search license, vendor or owner..." value={search} onChange={e => setSearch(e.target.value)}/>
          <Select className="lic-filter" label="Filter licenses by status" options={statusOptions} value={status} onChange={setStatus}/>
          <Select className="lic-filter" label="Filter licenses by type" options={typeOptions} value={type} onChange={setType}/>
          <span className="lic-toolbar-spacer"/><Button onClick={clear}>Clear filters</Button>
        </div>
        <div className="lic-table-scroll"><table className="lic-table lic-main-table">
          <thead><tr><th>PRODUCT / LICENSE</th><th>TYPE</th><th>SEATS</th><th>BILLING</th><th>RENEWAL</th><th>OWNER</th><th>STATUS</th><th aria-label="Actions"/></tr></thead>
          <tbody>{filtered.map(item => <tr key={item.id} tabIndex={0} role="button" aria-label={'Open ' + item.name} onKeyDown={e => keyOpen(e, item)} onClick={() => open(item)}>
            <td><LicenseIdentity license={item}/></td><td className="lic-muted">{item.model}</td><td><Usage assigned={item.assigned} total={item.total}/></td>
            <td><strong>{currencyText(item.amount, item.currency)}</strong><small>{item.billing}</small></td>
            <td><strong>{item.renewal || '—'}</strong><small>{item.autoRenew ? 'Auto-renew on' : 'Manual renewal'}</small></td>
            <td className="lic-muted">{item.owner}</td><td><Status status={item.status}/></td>
            <td><button className="lic-row-action" type="button" aria-label={'Manage seats for ' + item.name} title="Manage seats"
              onClick={e => { e.stopPropagation(); open(item, 'seats'); }}><ArrowLeftRight size={17}/></button></td>
          </tr>)}</tbody>
        </table></div>
        {!filtered.length && <div className="lic-empty">No matching licenses. Try changing the search or filters.</div>}
        <div className="lic-table-footer">{filtered.length} illustrative licenses · click any row for details</div>
      </>}

      {tab === 'Renewals' && <section className="lic-tab-panel">
        <div className="lic-panel-heading"><div><h2>Renewal calendar & reminders</h2><p>Configurable notices at 30, 14 and 7 days before renewal.</p></div>
          <Button onClick={() => open(licenses[0], 'renewal')}>Reminder settings</Button></div>
        <div className="lic-renewal-list">{upcoming.map(id => {
          const license = licenses.find(item => item.id === id);
          if (!license) return null;
          return <button className="lic-renewal-row" type="button" key={id} onClick={() => open(license)}>
            <LicenseIdentity license={license}/>
            <div className="lic-renewal-note">{license.owner} · {license.billing} · {currencyText(license.amount, license.currency)}<small>{license.autoRenew ? 'Automatic renewal enabled' : 'Manual renewal'}</small></div>
            <div className="lic-renewal-end"><Status status={license.status}/><strong>{license.renewal}</strong></div>
          </button>;
        })}</div>
      </section>}

      {tab === 'Seat allocations' && <section>
        <div className="lic-panel-heading"><div><h2>Seat availability & assignments</h2><p>Individual users or devices are assigned without recipient confirmation.</p></div></div>
        <div className="lic-table-scroll"><table className="lic-table lic-allocation-table">
          <thead><tr><th>LICENSE</th><th>ALLOCATED</th><th>AVAILABLE</th><th>ASSIGNMENT TYPE</th><th>OWNER</th><th aria-label="Actions"/></tr></thead>
          <tbody>{licenses.map(item => <tr key={item.id} tabIndex={0} role="button" onClick={() => open(item, 'seats')} onKeyDown={e => keyOpen(e, item)}>
            <td><LicenseIdentity license={item}/></td><td><strong>{item.assigned} / {item.total}</strong></td>
            <td className="lic-muted">{item.total - item.assigned}</td><td className="lic-muted">{item.model === 'Device-bound' ? 'Device' : item.model === 'Individual' ? 'Named user' : 'Named users'}</td>
            <td className="lic-muted">{item.owner}</td><td><ArrowLeftRight size={17} className="lic-quiet-icon"/></td>
          </tr>)}</tbody>
        </table></div><div className="lic-table-footer lic-footer-split"><span>Seat counts are calculated from assignments</span><span>Open a license to manage seats</span></div>
      </section>}

      {tab === 'Expenses' && <section>
        <div className="lic-expense-cards">
          <Card><span>Monthly equivalent · estimate</span><strong>₾ 7,850</strong><small>Multi-currency normalized</small></Card>
          <Card><span>Annual forecast · estimate</span><strong>₾ 94,200</strong><small>Recurring license commitments</small></Card>
          <Card><span>Upcoming renewal value</span><strong>₾ 13,480</strong><small>Next 30 days</small></Card>
        </div>
        <div className="lic-panel-heading"><div><h2>Subscription expense history</h2><p>Original currencies retained; forecasts shown as illustrative GEL equivalents.</p></div>
          <Button icon={<ArrowDownToLine size={15}/>} onClick={() => setNotice(exportNotice)}>Export expenses</Button></div>
        <div className="lic-table-scroll"><table className="lic-table lic-expense-table"><thead><tr><th>DATE</th><th>SUBSCRIPTION</th><th>BILLING PERIOD</th><th>AMOUNT</th><th>EVIDENCE</th></tr></thead>
          <tbody>{expenses.map(item => <tr key={item.date + item.subscription}>
            <td className="lic-muted">{item.date}</td><td><strong>{item.subscription}</strong></td><td className="lic-muted">{item.billing}</td>
            <td><strong>{currencyText(item.amount, item.currency)}</strong></td><td className="lic-muted">{item.evidence}</td>
          </tr>)}</tbody></table></div>
      </section>}
    </Card>
    <p className="lic-disclaimer"><Badge tone="blue">UI preview</Badge> All amounts, license counts, renewals and assignments are illustrative. No production records are changed.</p>
    {active && <LicenseDialog key={active.id} license={active} initialView={activeView} close={() => setActive(null)}/>}
    {adding && <AddLicenseDialog close={() => setAdding(false)}/>}
    {notice && <LicenseNotice title="Preview only" text={notice} close={() => setNotice('')}/>}
  </div>;
}
