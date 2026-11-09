import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Box, Check, Clock3, Plus, Warehouse } from 'lucide-react';
import { Badge, Button, Card, PageHeader, SearchInput, SectionTabs, Select } from '../components/ui';
import {
  branches, categories, isLowStock, movements, stockItems, storageLocations,
  type InventoryItem, type InventoryTab, type StorageLocation
} from './inventory-data';
import { AddLocationDialog, IssueConsumablesDialog, StockItemDrawer, StorageLocationDrawer } from './InventoryDialogs';
import './inventory.css';

const tabs: InventoryTab[] = ['Stock overview', 'Locations', 'Movement history'];

function Availability({ low }: { low: boolean }) {
  return <span className={'iv-availability ' + (low ? 'low' : 'ok')}><span className="iv-dot"/>{low ? 'Low stock' : 'In stock'}</span>;
}

export default function InventoryPage() {
  const [tab, setTab] = useState<InventoryTab>('Stock overview');
  const [search, setSearch] = useState('');
  const [branch, setBranch] = useState('All branches');
  const [category, setCategory] = useState('All categories');
  const [lowOnly, setLowOnly] = useState(false);
  const [itemDetails, setItemDetails] = useState<InventoryItem | null>(null);
  const [locationDetails, setLocationDetails] = useState<StorageLocation | null>(null);
  const [addLocation, setAddLocation] = useState(false);
  const [issue, setIssue] = useState(false);
  const [exportType, setExportType] = useState<'stock' | 'history' | null>(null);

  const shownItems = useMemo(() => stockItems.filter(item => {
    const q = search.trim().toLowerCase();
    const found = !q || [item.id, item.name, item.category, item.location, item.branch].some(v => v.toLowerCase().includes(q));
    return found && (branch === 'All branches' || item.branch === branch)
      && (category === 'All categories' || item.category === category)
      && (!lowOnly || isLowStock(item));
  }), [search, branch, category, lowOnly]);

  const clearFilters = () => { setSearch(''); setBranch('All branches'); setCategory('All categories'); setLowOnly(false); };

  return <div className="iv-page">
    <PageHeader eyebrow="STOCK MANAGEMENT / CONSUMABLES" title="Inventory"
      badgeLabel="UI concept · sample data"
      description="Track consumable stock by branch and location, with clear issue and adjustment history."
      actions={<>
        <Button icon={<ArrowDownToLine size={16}/>} onClick={() => setExportType('stock')}>Export</Button>
        <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setIssue(true)}>Issue consumables</Button>
      </>}/>
    <div className="iv-summary">
      <Card className="iv-stat"><div className="iv-stat-top"><span>Tracked stock items</span><span className="iv-stat-icon blue"><Box size={19}/></span></div><strong>342</strong><small>Across all locations</small></Card>
      <Card className="iv-stat"><div className="iv-stat-top"><span>Low-stock alerts</span><span className="iv-stat-icon amber"><Clock3 size={19}/></span></div><strong>9</strong><small>Below configured minimum</small></Card>
      <Card className="iv-stat"><div className="iv-stat-top"><span>Storage locations</span><span className="iv-stat-icon purple"><Warehouse size={19}/></span></div><strong>14</strong><small>Multiple locations per branch</small></Card>
      <Card className="iv-stat"><div className="iv-stat-top"><span>Issues this month</span><span className="iv-stat-icon mint"><Check size={19}/></span></div><strong>127</strong><small>Recorded by user and quantity</small></Card>
    </div>
    <Card className="iv-catalog">
      <SectionTabs tabs={tabs} selected={tab} onChange={value => setTab(value as InventoryTab)}/>
      {tab === 'Stock overview' ? <>
        <div className="iv-toolbar">
          <SearchInput className="iv-search" aria-label="Search stock" placeholder="Search stock item, ID or location..." value={search} onChange={e => setSearch(e.target.value)}/>
          <Select className="iv-filter" label="Filter branch" options={['All branches', ...branches]} value={branch} onChange={setBranch}/>
          <Select className="iv-filter" label="Filter category" options={['All categories', ...categories]} value={category} onChange={setCategory}/>
          <div className="iv-toolbar-space"/>
          <Button className={lowOnly ? 'iv-low-toggle active' : 'iv-low-toggle'} aria-pressed={lowOnly} onClick={() => setLowOnly(x => !x)}>Low stock only</Button>
          <Button onClick={clearFilters}>Clear</Button>
        </div>
        <div className="iv-table-scroll"><table className="iv-table">
          <thead><tr><th>STOCK ITEM</th><th>CATEGORY</th><th>BRANCH / LOCATION</th><th>ON HAND</th><th>MINIMUM</th><th>AVAILABILITY</th><th aria-label="Actions"/></tr></thead>
          <tbody>{shownItems.map(item => <tr key={item.id} role="button" tabIndex={0} aria-label={'Open stock details for ' + item.name} onClick={() => setItemDetails(item)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setItemDetails(item); } }}>
            <td><strong>{item.name}</strong><small>{item.id} · Updated {item.updated}</small></td>
            <td className="iv-muted-cell">{item.category}</td>
            <td><strong>{item.branch}</strong><small>{item.location}</small></td>
            <td><strong className={isLowStock(item) ? 'iv-low-quantity' : undefined}>{item.onHand} <span className="iv-unit">{item.unit}</span></strong></td>
            <td className="iv-muted-cell">{item.minimum} {item.unit}</td>
            <td><Availability low={isLowStock(item)}/></td>
            <td className="iv-row-icon"><ArrowLeftRight size={18}/></td>
          </tr>)}</tbody>
        </table></div>
        {!shownItems.length && <div className="iv-empty-state"><Box size={28}/><strong>No stock records found</strong><span>Try clearing your filters or searching another item.</span><Button onClick={clearFilters}>Clear filters</Button></div>}
        <div className="iv-catalog-footer">{shownItems.length} sample stock item{shownItems.length === 1 ? '' : 's'} · quantities are illustrative</div>
      </> : tab === 'Locations' ? <>
        <div className="iv-section-heading"><div><h2>Storage by branch</h2><p>A branch may contain multiple named warehouses or storage locations.</p></div>
          <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setAddLocation(true)}>Add location</Button></div>
        <div className="iv-locations-grid">
          {storageLocations.map(location => <button key={location.id} type="button" className="iv-location-card" onClick={() => setLocationDetails(location)} aria-label={'Open ' + location.name + ' details'}>
            <span className="iv-location-icon"><Warehouse size={20}/></span><strong>{location.name}</strong>
            <span>{location.branch}</span>
            <small>{location.tracked} stock units tracked · {location.alerts} alert{location.alerts === 1 ? '' : 's'}</small>
          </button>)}
        </div>
      </> : <>
        <div className="iv-section-heading"><div><h2>Movement &amp; adjustment history</h2><p>Consumable issues, inbound stock and authorized adjustments.</p></div>
          <Button icon={<ArrowDownToLine size={16}/>} onClick={() => setExportType('history')}>Export history</Button></div>
        <div className="iv-table-scroll"><table className="iv-history-table">
          <thead><tr><th>DATE</th><th>ACTION</th><th>STOCK ITEM</th><th>PERFORMED BY / REASON</th><th>QUANTITY</th></tr></thead>
          <tbody>{movements.map(movement => <tr key={movement.id}>
            <td>{movement.date}</td><td><strong>{movement.action}</strong></td><td>{movement.item}</td><td>{movement.performer} · {movement.context}</td>
            <td><strong className={movement.quantity > 0 ? 'iv-positive' : 'iv-negative'}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</strong></td>
          </tr>)}</tbody>
        </table></div>
        <div className="iv-catalog-footer">Every stock adjustment requires an authorized user and reason.</div>
      </>}
    </Card>
    <p className="iv-page-note"><Badge tone="blue">UI preview</Badge><span>All inventory data is illustrative. No stock changes or exports are performed.</span></p>
    {itemDetails && <StockItemDrawer key={itemDetails.id} item={itemDetails} close={() => setItemDetails(null)}/>}
    {locationDetails && <StorageLocationDrawer key={locationDetails.id} location={locationDetails} close={() => setLocationDetails(null)}/>}
    {issue && <IssueConsumablesDialog close={() => setIssue(false)}/>}
    {addLocation && <AddLocationDialog close={() => setAddLocation(false)}/>}
    {exportType && <div className="iv-export-overlay" onMouseDown={() => setExportType(null)}>
      <section role="dialog" aria-modal="true" aria-labelledby="iv-export-title" className="iv-notice-dialog" onMouseDown={e => e.stopPropagation()}>
        <span className="iv-notice-icon"><ArrowDownToLine size={23}/></span>
        <h3 id="iv-export-title">{exportType === 'history' ? 'Export movement history' : 'Export inventory'}</h3>
        <p>Exports require authorized, connected production inventory data. The displayed stock figures and history are sample information, not an official report.</p>
        <Button variant="primary" onClick={() => setExportType(null)}>Got it</Button>
      </section>
    </div>}
  </div>;
}
