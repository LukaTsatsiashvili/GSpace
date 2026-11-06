import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight, ArrowUpRight, Box, Check, ChevronDown, Clock3, CreditCard,
  Download, Filter, KeyRound, Plus, UsersRound, Wrench, X
} from 'lucide-react';
import { Button, Card } from '../components/ui';
import './overview.css';

type Range = 'Last 3 months' | 'Last 6 months' | 'Last 12 months';
type AssetStatus = 'Assigned' | 'Available' | 'Maintenance';

const series: Record<Range, { month: string; value: number }[]> = {
  'Last 3 months': [{ month: 'Sep', value: 990 }, { month: 'Oct', value: 1090 }, { month: 'Nov', value: 1248 }],
  'Last 6 months': [{ month: 'Jun', value: 710 }, { month: 'Jul', value: 790 }, { month: 'Aug', value: 910 }, { month: 'Sep', value: 970 }, { month: 'Oct', value: 1090 }, { month: 'Nov', value: 1248 }],
  'Last 12 months': [{ month: 'Dec', value: 590 }, { month: 'Jan', value: 630 }, { month: 'Feb', value: 670 }, { month: 'Mar', value: 700 }, { month: 'Apr', value: 720 }, { month: 'May', value: 740 }, { month: 'Jun', value: 710 }, { month: 'Jul', value: 790 }, { month: 'Aug', value: 910 }, { month: 'Sep', value: 970 }, { month: 'Oct', value: 1090 }, { month: 'Nov', value: 1248 }]
};

const updates = [
  { title: 'Asset assignment confirmed', detail: 'Nino K. confirmed receipt of Dell Monitor', time: '12m ago', icon: Check },
  { title: 'Transfer request approved', detail: '3 assets moved to Tbilisi Store 01', time: '1h ago', icon: ArrowLeftRight },
  { title: 'Maintenance completed', detail: 'Printer AST-00121 serviced and inspected', time: '3h ago', icon: Wrench },
  { title: 'License renewal upcoming', detail: 'Microsoft 365 renews in 14 days', time: '5h ago', icon: KeyRound }
];

const assets: { id: string; name: string; category: string; branch: string; assigned: string; status: AssetStatus }[] = [
  { id: 'AST-00123', name: 'Dell UltraSharp U2723QE', category: 'Monitors', branch: 'Head Office', assigned: 'Nino Kapanadze', status: 'Assigned' },
  { id: 'AST-00119', name: 'Samsung Galaxy Tab S9', category: 'Mobile devices', branch: 'Tbilisi Store 01', assigned: '—', status: 'Available' },
  { id: 'AST-00118', name: 'Cisco Catalyst 9200', category: 'Network equipment', branch: 'Batumi Store 01', assigned: 'IT Department', status: 'Assigned' },
  { id: 'AST-00115', name: 'HP LaserJet Pro', category: 'Printers', branch: 'Kutaisi Store 01', assigned: '—', status: 'Maintenance' }
];

function smoothPath(values: number[]) {
  const points = values.map((value, i) => ({ x: (i / Math.max(values.length - 1, 1)) * 900, y: 198 - ((value - 500) / 800) * 170 }));
  if (points.length < 2) return { line: '', last: points[0] };
  let line = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i], to = points[i + 1], midpoint = (from.x + to.x) / 2;
    line += ` C ${midpoint} ${from.y}, ${midpoint} ${to.y}, ${to.x} ${to.y}`;
  }
  return { line, last: points[points.length - 1] };
}

function AssetChart({ range }: { range: Range }) {
  const data = series[range];
  const { line, last } = useMemo(() => smoothPath(data.map(item => item.value)), [data]);
  return <div className="ov-chart">
    <div className="ov-chart-key"><span className="ov-legend-dot"/>Total assets <span>{data[data.length - 1].value.toLocaleString()} assets tracked</span></div>
    <svg className="ov-chart-svg" viewBox="0 0 900 225" preserveAspectRatio="none" role="img" aria-label={`Sample asset trend for ${range}`}>
      <defs><linearGradient id="ovFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#4a7cff" stopOpacity=".23"/><stop offset="100%" stopColor="#4a7cff" stopOpacity=".015"/></linearGradient></defs>
      {[50, 100, 150, 200].map(y => <line key={y} x1="0" x2="900" y1={y} y2={y} className="ov-chart-gridline"/>)}
      <path d={`${line} L 900 220 L 0 220 Z`} fill="url(#ovFill)"/>
      <path d={line} className="ov-chart-line"/>
      {last && <circle cx={last.x} cy={last.y} r="6" className="ov-chart-point"/>}
    </svg>
    <div className="ov-month-labels">{data.map(item => <span key={item.month}>{item.month}</span>)}</div>
  </div>;
}

function PreviewDialog({ action, close }: { action: string; close: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);
  return <div className="ov-modal-backdrop" onMouseDown={close}>
    <div className="ov-modal" role="dialog" aria-modal="true" aria-labelledby="ov-modal-title" onMouseDown={event => event.stopPropagation()}>
      <div className="ov-modal-head"><h2 id="ov-modal-title">{action}</h2><button aria-label="Close dialog" onClick={close}><X size={19}/></button></div>
      <p>This is a UI preview. The {action.toLowerCase()} workflow will become available when the relevant backend module is implemented.</p>
      <div className="ov-modal-foot"><Button variant="primary" onClick={close}>Got it</Button></div>
    </div>
  </div>;
}

export default function OverviewPage({ navigate }: { navigate: (id: string) => void }) {
  const [range, setRange] = useState<Range>('Last 6 months');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<'All statuses' | AssetStatus>('All statuses');
  const [dialog, setDialog] = useState<string | null>(null);
  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Tbilisi' }).format(now).toUpperCase();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Tbilisi' }).format(now));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const visibleAssets = assets.filter(asset => filter === 'All statuses' || asset.status === filter);

  return <div className="ov-page">
    <div className="ov-welcome"><div><p className="ov-date">{dateLabel}</p><h1>{greeting}, Sandro <span aria-hidden="true">👋</span></h1><p className="ov-subtitle">Here's what's happening with your company resources today.</p></div><div className="ov-header-actions"><Button icon={<Download size={15}/>} onClick={() => setDialog('Export report')}>Export Report</Button><Button variant="primary" icon={<Plus size={16}/>} onClick={() => setDialog('Add resource')}>Add Resource</Button></div></div>
    <div className="ov-kpi-grid">
      <Card className="ov-kpi"><div className="ov-kpi-top"><span>Total Assets</span><div className="ov-kpi-icon blue"><Box size={19}/></div></div><strong>1,248</strong><p><em className="up">↑ 8.2%</em> vs. last month</p></Card>
      <Card className="ov-kpi"><div className="ov-kpi-top"><span>Assigned Assets</span><div className="ov-kpi-icon mint"><UsersRound size={19}/></div></div><strong>892</strong><p><em className="up">71.5%</em> of total assets</p></Card>
      <Card className="ov-kpi"><div className="ov-kpi-top"><span>Pending Actions</span><div className="ov-kpi-icon amber"><Clock3 size={19}/></div></div><strong>24</strong><p><em className="warn">6 urgent</em> require attention</p></Card>
      <Card className="ov-kpi"><div className="ov-kpi-top"><span>Asset Value</span><div className="ov-kpi-icon purple"><CreditCard size={19}/></div></div><strong>₾ 428.5k</strong><p><em className="up">↑ 3.4%</em> vs. last month</p></Card>
    </div>
    <div className="ov-main-grid">
      <Card className="ov-feature-card"><div className="ov-card-head"><div><h2>Asset overview</h2><p>Activity and utilization across your branches</p></div><div className="ov-menu-wrap"><button className="ov-select" aria-haspopup="listbox" aria-expanded={rangeOpen} onClick={() => setRangeOpen(!rangeOpen)}>{range}<ChevronDown size={15}/></button>{rangeOpen && <div className="ov-menu" role="listbox">{(Object.keys(series) as Range[]).map(item => <button key={item} role="option" aria-selected={range === item} onClick={() => { setRange(item); setRangeOpen(false); }}>{item}</button>)}</div>}</div></div><AssetChart range={range}/></Card>
      <Card className="ov-feature-card"><div className="ov-card-head"><div><h2>Recent activity</h2><p>Latest resource management updates</p></div><button className="ov-text-action" onClick={() => navigate('audit')}>View all →</button></div><div className="ov-activity">{updates.map(({ title, detail, time, icon: Icon }) => <div className="ov-activity-row" key={title}><span className="ov-activity-icon"><Icon size={16}/></span><div className="ov-activity-copy"><strong>{title}</strong><p>{detail}</p></div><time>{time}</time></div>)}</div></Card>
    </div>
    <Card className="ov-assets-card"><div className="ov-card-head ov-assets-head"><div><h2>Recently updated assets</h2><p>A quick look at inventory activity across branches</p></div><div className="ov-table-actions"><div className="ov-menu-wrap"><Button icon={<Filter size={15}/>} onClick={() => setFilterOpen(!filterOpen)}>Filter{filter !== 'All statuses' && <span className="ov-filter-dot"/>}</Button>{filterOpen && <div className="ov-menu" role="listbox">{(['All statuses', 'Assigned', 'Available', 'Maintenance'] as const).map(item => <button key={item} role="option" aria-selected={filter === item} onClick={() => { setFilter(item); setFilterOpen(false); }}>{item}</button>)}</div>}</div><button className="ov-text-action" onClick={() => navigate('resources')}>View all →</button></div></div><div className="ov-table-scroll"><table className="ov-table"><thead><tr><th>ASSET</th><th>CATEGORY</th><th>BRANCH</th><th>ASSIGNED TO</th><th>STATUS</th></tr></thead><tbody>{visibleAssets.map(asset => <tr key={asset.id}><td><div className="ov-asset-name"><span className="ov-asset-icon"><Box size={18}/></span><div><strong>{asset.name}</strong><small>{asset.id}</small></div></div></td><td>{asset.category}</td><td>{asset.branch}</td><td>{asset.assigned}</td><td><span className={`ov-status ${asset.status.toLowerCase()}`}>{asset.status}</span></td></tr>)}</tbody></table></div>{visibleAssets.length === 0 && <p className="ov-table-empty">No matching sample assets.</p>}</Card>
    <p className="ov-sample-note">Preview with illustrative data · no production changes are made from this page.</p>
    {dialog && <PreviewDialog action={dialog} close={() => setDialog(null)}/>}
  </div>;
}
