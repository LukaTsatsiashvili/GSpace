import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeftRight, CreditCard, Plus } from 'lucide-react';
import { Badge, Button, Card, PageHeader, SearchInput, SectionTabs, Select } from '../components/ui';
import {
  assets, bookValue, branches, branchCosts, expenseComposition, expenses, financeTabs, money,
  monthlyCosts, paymentStatus, paymentStatuses, remaining, topCategories,
  type FinanceTab, type FinancialAsset, type OperatingExpense, type PaymentStatus
} from './finance-data';
import { DepreciationPolicyDialog, FinanceAssetDrawer, FinanceNotice, InvoicePaymentPicker, NewExpenseDialog, OperatingExpenseDrawer } from './FinanceDialogs';
import './finance.css';

function StatusTag({status}: {status: PaymentStatus}) {
  return <span className={'fn-status fn-status-' + status.toLowerCase().replace(/\s/g,'-')}>{status}</span>;
}
function AssetIdentity({item}: {item: FinancialAsset}) {
  return <div className="fn-identity"><span className="fn-record-icon"><CreditCard size={17}/></span>
    <div><strong>{item.name}</strong><small>{item.resourceId} · {item.id}</small></div></div>;
}
function openByKey(event: KeyboardEvent<HTMLTableRowElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); }
}
function AssetTable({items, open}: {items: FinancialAsset[]; open: (item: FinancialAsset) => void}) {
  return <div className="fn-table-scroll"><table className="fn-table fn-assets-table">
    <thead><tr><th>RESOURCE / RECORD</th><th>SUPPLIER</th><th>PURCHASE VALUE</th><th>PAID / BALANCE</th><th>PURCHASE DATE</th><th>PAYMENT STATUS</th><th aria-label="Actions"/></tr></thead>
    <tbody>{items.map(item => <tr role="button" tabIndex={0} key={item.id} aria-label={'Open financial record for ' + item.name}
      onClick={() => open(item)} onKeyDown={e => openByKey(e, () => open(item))}>
      <td><AssetIdentity item={item}/></td>
      <td><strong>{item.supplier}</strong><small>{item.branch}</small></td>
      <td><strong>{money(item.value,item.currency)}</strong><small>{item.category}</small></td>
      <td><strong>{money(item.paid,item.currency)}</strong><small>Balance: {money(remaining(item),item.currency)}</small></td>
      <td><strong>{item.purchaseDate}</strong></td><td><StatusTag status={paymentStatus(item)}/></td>
      <td className="fn-action-cell"><ArrowLeftRight size={18}/></td>
    </tr>)}</tbody>
  </table></div>;
}
function SectionHeading({title,subtitle,actions}: {title: string; subtitle?: string; actions?: ReactNode}) {
  return <div className="fn-section-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{actions}</div>;
}
export default function FinancePage() {
  const [tab,setTab] = useState<FinanceTab>('Overview');
  const [search,setSearch] = useState('');
  const [branch,setBranch] = useState('All branches');
  const [status,setStatus] = useState('All payment statuses');
  const [activeAsset,setActiveAsset] = useState<FinancialAsset|null>(null);
  const [assetView,setAssetView] = useState<'details'|'payment'>('details');
  const [showPaymentPicker,setShowPaymentPicker] = useState(false);
  const [activeExpense,setActiveExpense] = useState<OperatingExpense|null>(null);
  const [showAdd,setShowAdd] = useState(false);
  const [showPolicy,setShowPolicy] = useState(false);
  const [notice,setNotice] = useState('');

  const filtered = useMemo(() => assets.filter(item => {
    const q=search.trim().toLowerCase();
    return (!q || [item.name,item.resourceId,item.id,item.supplier,item.invoice].some(v=>v.toLowerCase().includes(q)))
      && (branch === 'All branches' || item.branch === branch)
      && (status === 'All payment statuses' || paymentStatus(item) === status);
  }),[search,branch,status]);
  const clear = () => {setSearch('');setBranch('All branches');setStatus('All payment statuses');};
  const switchTab = (next: FinanceTab) => {setTab(next);clear();};
  const openAsset = (item: FinancialAsset) => {setAssetView('details');setActiveAsset(item);};
  const exportPreview = () => setNotice('Exports are a design preview. Production Excel, CSV and PDF exports will require authorized financial data and server-side services.');

  return <div className="fn-page">
    <PageHeader eyebrow="MANAGEMENT / RESOURCE FINANCIALS" title="Finance & Costs" badgeLabel="UI concept · sample data"
      description="Track acquisition value, invoices, payments, operating costs and asset depreciation."
      actions={<><Button icon={<ArrowDownToLine size={16}/>} onClick={exportPreview}>Export</Button>
        <Button variant="primary" icon={<Plus size={16}/>} onClick={()=>setShowAdd(true)}>Add expense</Button></>}/>
    <div className="fn-kpis">
      <Card className="fn-kpi"><span>Tracked asset purchase value</span><strong>₾ 1.28m</strong><small>GEL equivalent · indicative</small></Card>
      <Card className="fn-kpi"><span>Outstanding payments</span><strong>₾ 92.4k</strong><small>Unpaid and partially paid</small></Card>
      <Card className="fn-kpi"><span>Monthly operating costs</span><strong>₾ 24.8k</strong><small>Maintenance and subscriptions</small></Card>
      <Card className="fn-kpi"><span>Estimated net book value</span><strong>₾ 986k</strong><small>Management straight-line estimate</small></Card>
    </div>
    <Card className="fn-catalog">
      <SectionTabs tabs={financeTabs} selected={tab} onChange={value=>switchTab(value as FinanceTab)}/>

      {tab === 'Overview' && <>
        <div className="fn-overview-charts">
          <div className="fn-panel"><h2>Cost distribution by branch</h2><div className="fn-branch-bars">
            {branchCosts.map(item=><div className="fn-branch-row" key={item.name}>
              <div><strong>{item.name}</strong><span>{money(item.amount,'GEL')}</span></div>
              <div className="fn-progress"><span style={{width:item.percent+'%'}}/></div>
            </div>)}
          </div></div>
          <div className="fn-panel"><h2>Expense composition</h2><div className="fn-donut-layout">
            <div className="fn-donut" role="img" aria-label="Illustrative cost composition: Hardware 53 percent, software 25 percent, maintenance 15 percent, other 7 percent"/>
            <div className="fn-donut-legend">{expenseComposition.map(item=><div key={item.label}>
              <span className="fn-legend-dot" style={{background:item.color}}/><span>{item.label}</span><strong>{item.share}%</strong>
            </div>)}</div>
          </div></div>
        </div>
        <div className="fn-recent-box">
          <SectionHeading title="Recent financial records" actions={<Button onClick={()=>switchTab('Asset costs')}>View all costs</Button>}/>
          <AssetTable items={assets.slice(0,4)} open={openAsset}/>
        </div>
      </>}

      {tab === 'Asset costs' && <>
        <div className="fn-toolbar">
          <SearchInput className="fn-search" aria-label="Search financial records" placeholder="Search resource, supplier or invoice..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <Select className="fn-filter" label="Filter branch" options={['All branches',...branches]} value={branch} onChange={setBranch}/>
          <Select className="fn-filter" label="Filter payment status" options={['All payment statuses',...paymentStatuses]} value={status} onChange={setStatus}/>
          <span className="fn-toolbar-spacer"/><Button onClick={clear}>Clear filters</Button>
        </div>
        <AssetTable items={filtered} open={openAsset}/>
        {!filtered.length && <div className="fn-empty">No matching financial records. Try another filter or search term.</div>}
        <div className="fn-table-footer">{filtered.length} illustrative record{filtered.length===1?'':'s'} · select a row for financial details</div>
      </>}

      {tab === 'Invoices & payments' && <>
        <SectionHeading title="Invoices and payments" subtitle="Informational statuses only · no bank reconciliation"
          actions={<Button variant="primary" icon={<Plus size={16}/>} onClick={()=>setShowPaymentPicker(true)}>Record payment</Button>}/>
        <div className="fn-table-scroll"><table className="fn-table fn-invoice-table"><thead><tr>
          <th>INVOICE</th><th>SUPPLIER / RESOURCE</th><th>TOTAL</th><th>PAID</th><th>REMAINING</th><th>STATUS</th><th aria-label="Actions"/>
        </tr></thead><tbody>{assets.map(item=><tr key={item.id} role="button" tabIndex={0}
          aria-label={'Open invoice '+item.invoice} onClick={()=>openAsset(item)}
          onKeyDown={e=>openByKey(e,()=>openAsset(item))}>
          <td><strong>{item.invoice}</strong><small>{item.purchaseDate}</small></td>
          <td><strong>{item.supplier}</strong><small>{item.name}</small></td>
          <td><strong>{money(item.value,item.currency)}</strong></td><td className="fn-muted">{money(item.paid,item.currency)}</td>
          <td><strong>{money(remaining(item),item.currency)}</strong></td><td><StatusTag status={paymentStatus(item)}/></td>
          <td className="fn-action-cell"><ArrowLeftRight size={18}/></td>
        </tr>)}</tbody></table></div>
        <div className="fn-table-footer">Payment status is tracked per purchase; actual transactions are handled outside this preview.</div>
      </>}

      {tab === 'Operating expenses' && <>
        <SectionHeading title="Maintenance & recurring operating costs" subtitle="All original currencies retained"
          actions={<Button variant="primary" icon={<Plus size={16}/>} onClick={()=>setShowAdd(true)}>Add expense</Button>}/>
        <div className="fn-table-scroll"><table className="fn-table fn-expense-table"><thead><tr>
          <th>EXPENSE</th><th>TYPE</th><th>PROVIDER</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th>
        </tr></thead><tbody>{expenses.map(item=><tr key={item.id} role="button" tabIndex={0}
          aria-label={'Open expense '+item.name} onClick={()=>setActiveExpense(item)}
          onKeyDown={e=>openByKey(e,()=>setActiveExpense(item))}>
          <td><strong>{item.name}</strong><small>{item.id} · {item.branch}</small></td>
          <td className="fn-muted">{item.type}</td><td className="fn-muted">{item.provider}</td>
          <td className="fn-muted">{item.date}</td><td><strong>{money(item.amount,item.currency)}</strong></td>
          <td><StatusTag status={item.status}/></td>
        </tr>)}</tbody></table></div>
        <div className="fn-table-footer">Sample expense ledger · no full accounting or accounts payable functions.</div>
      </>}

      {tab === 'Depreciation' && <>
        <SectionHeading title="Management depreciation estimate"
          subtitle="Straight-line method · configurable useful life · informational values"
          actions={<Button onClick={()=>setShowPolicy(true)}>Depreciation policy</Button>}/>
        <div className="fn-table-scroll"><table className="fn-table fn-depreciation-table"><thead><tr>
          <th>ASSET</th><th>ACQUISITION COST</th><th>USEFUL LIFE</th><th>METHOD</th><th>ACCUMULATED DEPRECIATION</th><th>EST. BOOK VALUE</th><th aria-label="Actions"/>
        </tr></thead><tbody>{assets.filter(item=>item.usefulLife!==null).map(item=><tr key={item.id} role="button" tabIndex={0}
          aria-label={'Open depreciation for '+item.name} onClick={()=>openAsset(item)}
          onKeyDown={e=>openByKey(e,()=>openAsset(item))}>
          <td><strong>{item.name}</strong><small>{item.resourceId}</small></td>
          <td><strong>{money(item.value,item.currency)}</strong></td>
          <td className="fn-muted">{item.usefulLife} months</td><td className="fn-muted">Straight-line</td>
          <td className="fn-muted">{money(item.depreciation,item.currency)}</td>
          <td><strong>{money(bookValue(item),item.currency)}</strong></td><td className="fn-action-cell"><ArrowLeftRight size={18}/></td>
        </tr>)}</tbody></table></div>
        <div className="fn-table-footer">These are management estimates, not tax or statutory accounting depreciation.</div>
      </>}

      {tab === 'Cost analysis' && <>
        <div className="fn-analysis-grid">
          <div className="fn-panel"><h2>Costs by month · sample GEL equivalent</h2>
            <div className="fn-month-bars">{monthlyCosts.map(item=><div className="fn-month-column" key={item.month}>
              <strong>{item.thousands}k</strong><div className="fn-month-bar" style={{height:(item.thousands/100*130)+'px'}}/>
              <small>{item.month}</small></div>)}</div>
          </div>
          <div className="fn-panel"><h2>Top spend categories</h2><div className="fn-category-bars">{topCategories.map(item=><div key={item.name} className="fn-category-row">
            <div><strong>{item.name}</strong><span>{item.percent}%</span></div>
            <div className="fn-progress"><span className={item.name==='Maintenance'?'fn-maintenance-bar':''} style={{width:item.percent+'%'}}/></div>
          </div>)}</div></div>
        </div>
        <div className="fn-export-panel"><div className="fn-section-heading"><h2>Reports & exports</h2>
          <Button icon={<ArrowDownToLine size={16}/>} onClick={exportPreview}>Export report</Button></div>
          <p>Slice by branch, category, supplier, resource and period. Excel / CSV / PDF exports are planned for production.</p>
        </div>
      </>}
    </Card>

    <div className="fn-preview-caption"><Badge tone="blue">UI preview</Badge><span>All totals, transactions, exchange equivalents and depreciation values are sample information only.</span></div>
    {activeAsset && <FinanceAssetDrawer key={activeAsset.id} record={activeAsset} initialView={assetView} close={()=>setActiveAsset(null)}/>}
    {showPaymentPicker && <InvoicePaymentPicker close={()=>setShowPaymentPicker(false)} select={item=>{setShowPaymentPicker(false);setAssetView('payment');setActiveAsset(item);}}/>}
    {activeExpense && <OperatingExpenseDrawer key={activeExpense.id} item={activeExpense} close={()=>setActiveExpense(null)}/>}
    {showAdd && <NewExpenseDialog close={()=>setShowAdd(false)}/>}
    {showPolicy && <DepreciationPolicyDialog close={()=>setShowPolicy(false)}/>}
    {notice && <FinanceNotice title="Export preview" description={notice} close={()=>setNotice('')}/>}
  </div>;
}
