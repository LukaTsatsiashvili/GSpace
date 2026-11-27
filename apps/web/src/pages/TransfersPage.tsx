import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Box, Check, Clock3, Plus } from 'lucide-react';
import { Button, Card, PageHeader, SearchInput, SectionTabs, Select } from '../components/ui';
import { api, terminal, statuses, type Lookups, type Transfer, type TransferStatus, type TransferTab } from './transfers-data';
import { NewTransferDialog, TransferDetails, TransferReceiptDialog } from './TransfersDialogs';
import { useToast } from '../components/toast';
import './transfers.css';

const tabs: TransferTab[] = ['All transfers', 'Awaiting me', 'In progress', 'History'];
const statusFilter = ['All statuses', ...statuses];

function StatusPill({ status }: { status: TransferStatus }) {
  return <span className={'tr-status tr-' + status.toLowerCase().replace(/\s+/g, '-')}><span className="tr-status-dot"/>{status}</span>;
}

export default function TransfersPage() {
  const [tab, setTab] = useState<TransferTab>('All transfers');
  const [search, setSearch] = useState('');
  const [destination, setDestination] = useState('All destinations');
  const [status, setStatus] = useState('All statuses');
  const [active, setActive] = useState<Transfer | null>(null);
  const [receipt, setReceipt] = useState<Transfer | null>(null);
  const [creating, setCreating] = useState(false);
  const [rows,setRows]=useState<Transfer[]>([]);
  const [lookups,setLookups]=useState<Lookups|null>(null);
  const [loading,setLoading]=useState(true);
  const toast=useToast();
  const reload=useCallback(async()=>{try{const [list,look]=await Promise.all([api.list(),api.lookups()]);setRows(list.transfers);setLookups(look);setActive(old=>old?list.transfers.find(t=>t.key===old.key)??null:null);}catch(e){toast.error(e instanceof Error?e.message:'Unable to load transfers');}finally{setLoading(false);}},[toast]);
  useEffect(()=>{void reload();},[reload]);
  const destinationsFilter=['All destinations',...new Set(rows.map(t=>t.destination))];
  const done=()=>{setCreating(false);setReceipt(null);void reload();};

  const filtered = useMemo(() => rows.filter(item => {
    const tabMatches = tab === 'All transfers'
      || (tab === 'Awaiting me' && Object.values(item.actions).some(Boolean))
      || (tab === 'In progress' && !terminal(item.status))
      || (tab === 'History' && terminal(item.status));
    const keyword = search.trim().toLowerCase();
    const searchMatches = !keyword || [
      item.id, item.source, item.destination, item.sender, item.recipient, item.route,
      ...item.items.flatMap(resource => [resource.id, resource.name])
    ].some(value => value.toLowerCase().includes(keyword));
    return tabMatches && searchMatches
      && (destination === 'All destinations' || destination === item.destination)
      && (status === 'All statuses' || status === item.status);
  }), [rows, tab, search, destination, status]);

  function clearFilters() { setSearch(''); setDestination('All destinations'); setStatus('All statuses'); }

  return <div className="tr-page">
    <PageHeader eyebrow="ASSET LIFECYCLE / BRANCH MOVEMENTS" title="Transfers"
      badgeLabel="Branch movements"
      description="Move resources between branches with traceable dispatch, approval and item-level receipt."
      actions={<>
        {lookups?.canExport && <Button icon={<ArrowDownToLine size={16}/>} disabled={!filtered.length} onClick={()=>void api.export(filtered.map(t=>t.key)).then(()=>toast.success("Export downloaded")).catch(e=>toast.error(e.message))}>Export</Button>}
        {lookups?.canManage && <Button variant="primary" icon={<Plus size={17}/>} onClick={() => setCreating(true)}>New transfer</Button>}
      </>}/>
    <div className="tr-summary">
      <Card className="tr-stat"><div className="tr-stat-top"><span>Open transfers</span><span className="tr-stat-icon blue"><ArrowLeftRight size={20}/></span></div><strong>{rows.filter(t=>!terminal(t.status)).length}</strong><small>Across branches and warehouses</small></Card>
      <Card className="tr-stat"><div className="tr-stat-top"><span>Awaiting receipt</span><span className="tr-stat-icon amber"><Clock3 size={20}/></span></div><strong>{rows.filter(t=>t.status==='Awaiting receipt').length}</strong><small>Recipient action required</small></Card>
      <Card className="tr-stat"><div className="tr-stat-top"><span>Partially received</span><span className="tr-stat-icon purple"><Box size={20}/></span></div><strong>{rows.filter(t=>t.status==='Partially received').length}</strong><small>Individual items remain open</small></Card>
      <Card className="tr-stat"><div className="tr-stat-top"><span>Completed</span><span className="tr-stat-icon mint"><Check size={20}/></span></div><strong>{rows.filter(t=>t.status==='Completed').length}</strong><small>Confirmed and recorded</small></Card>
    </div>
    <Card className="tr-catalog">
      <SectionTabs tabs={tabs} selected={tab} onChange={value => { setTab(value as TransferTab); clearFilters(); }}/>
      <div className="tr-toolbar">
        <SearchInput className="tr-search" aria-label="Search transfers" placeholder="Search transfer, branch or person..." value={search} onChange={event => setSearch(event.target.value)}/>
        <Select className="tr-filter-select" label="Filter destination" options={destinationsFilter} value={destination} onChange={setDestination}/>
        <Select className="tr-filter-select" label="Filter status" options={statusFilter} value={status} onChange={setStatus}/>
        <div className="tr-toolbar-space"/>
        <Button onClick={clearFilters}>Clear filters</Button>
      </div>
      <div className="tr-table-scroll"><table className="tr-table">
        <thead><tr><th>TRANSFER</th><th>ROUTE</th><th>RESOURCES</th><th>CREATED</th><th>RECIPIENT</th><th>STATUS</th><th aria-label="Actions"/></tr></thead>
        <tbody>{filtered.map(item => <tr key={item.id} role="button" tabIndex={0} aria-label={'Open ' + item.id + ' details'}
          onClick={() => setActive(item)} onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActive(item); }
          }}>
          <td><strong>{item.id}</strong><small>{item.route}</small></td>
          <td><div className="tr-route-cell"><strong>{item.source}</strong><ArrowLeftRight size={15}/><strong>{item.destination}</strong></div></td>
          <td><strong>{item.items[0]?.name}</strong>{item.items.length > 1 && <small>+{item.items.length - 1} more resource{item.items.length > 2 ? 's' : ''}</small>}</td>
          <td className="tr-muted-td">{new Date(item.created).toLocaleDateString()}</td>
          <td><strong>{item.recipient}</strong><small>From {item.sender}</small></td>
          <td><StatusPill status={item.status}/></td>
          <td className="tr-row-arrow"><ArrowLeftRight size={18}/></td>
        </tr>)}</tbody>
      </table></div>
      {!filtered.length && <div className="tr-empty"><Box size={26}/><strong>{loading?'Loading transfers…':'No transfers found'}</strong><span>Try another tab, destination or status filter.</span><Button onClick={clearFilters}>Clear filters</Button></div>}
      <div className="tr-table-footer">{filtered.length} transfer{filtered.length === 1 ? '' : 's'} · select a row for full movement history</div>
    </Card>
    {active && !receipt && <TransferDetails key={active.id} transfer={active} close={() => setActive(null)} onReceipt={() => setReceipt(active)} onChanged={done}/>}
    {receipt && <TransferReceiptDialog key={receipt.id} transfer={receipt} close={() => setReceipt(null)} onChanged={done}/>}
    {creating && lookups && <NewTransferDialog lookups={lookups} close={() => setCreating(false)} onChanged={done}/>}

  </div>;
}
