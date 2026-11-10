import { useMemo, useState, type KeyboardEvent } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Box, Plus } from 'lucide-react';
import { Badge, Button, Card, PageHeader, SearchInput, SectionTabs, Select } from '../components/ui';
import {
  incidents, maintenanceTabs, priorityOptions, repairExpenses, schedules, statusOptions,
  type Incident, type IncidentPriority, type IncidentStatus, type MaintenanceTab, type PreventiveSchedule
} from './maintenance-data';
import {
  IncidentDetailsDrawer, MaintenanceNotice, PreventiveScheduleDialog, ReportIncidentDialog
} from './MaintenanceDialogs';
import './maintenance.css';

function StatusPill({ status }: { status: IncidentStatus }) {
  return <span className={'mt-pill mt-status-' + status.toLowerCase().replace(/\s+/g, '-')}><span className="mt-pill-dot"/>{status}</span>;
}
function PriorityPill({ priority }: { priority: IncidentPriority }) {
  return <span className={'mt-pill mt-priority-' + priority.toLowerCase()}><span className="mt-pill-dot"/>{priority}</span>;
}
function IncidentIdentity({ incident }: { incident: Incident }) {
  return <div className="mt-incident-identity"><span className="mt-square-icon"><Box size={18}/></span>
    <div><strong>{incident.resource}</strong><small>{incident.id} · {incident.resourceId}</small></div></div>;
}
function openWithKeyboard(event: KeyboardEvent<HTMLTableRowElement>, callback: () => void) {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); callback(); }
}

export default function MaintenancePage() {
  const [tab, setTab] = useState<MaintenanceTab>('All incidents');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [priority, setPriority] = useState('All priorities');
  const [incident, setIncident] = useState<Incident | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<PreventiveSchedule | null>(null);
  const [notice, setNotice] = useState('');

  const rows = useMemo(() => incidents.filter(item => {
    const query = search.trim().toLowerCase();
    const matches = !query || [item.id, item.resource, item.resourceId, item.issue, item.reporter, item.branch, item.assignedTo]
      .some(value => value.toLowerCase().includes(query));
    return matches && (status === 'All statuses' || item.status === status)
      && (priority === 'All priorities' || item.priority === priority)
      && (tab !== 'My work' || item.assignedTo === 'IT Support');
  }), [search, status, priority, tab]);

  const clearFilters = () => { setSearch(''); setStatus('All statuses'); setPriority('All priorities'); };
  const chooseTab = (next: MaintenanceTab) => { setTab(next); clearFilters(); };
  const previewExport = () => setNotice('Sample incident and repair data is illustrative. Authenticated production records and the export API must be connected before a real file can be generated.');

  function incidentTable() {
    return <>
      <div className="mt-toolbar">
        <SearchInput className="mt-search" aria-label="Search maintenance incidents" value={search}
          placeholder="Search asset, incident or reporter..." onChange={event => setSearch(event.target.value)}/>
        <Select className="mt-filter" label="Filter incident status" value={status}
          options={['All statuses', ...statusOptions]} onChange={setStatus}/>
        <Select className="mt-filter" label="Filter incident priority" value={priority}
          options={['All priorities', ...priorityOptions]} onChange={setPriority}/>
        <span className="mt-toolbar-spacer"/><Button onClick={clearFilters}>Clear filters</Button>
      </div>
      <div className="mt-table-scroll"><table className="mt-table mt-incident-table">
        <thead><tr><th>INCIDENT / RESOURCE</th><th>ISSUE</th><th>PRIORITY</th><th>REPORTED</th><th>ASSIGNED TO</th><th>STATUS</th><th aria-label="Open details"/></tr></thead>
        <tbody>{rows.map(item => <tr key={item.id} role="button" tabIndex={0} aria-label={'Open details for ' + item.id}
          onClick={() => setIncident(item)} onKeyDown={event => openWithKeyboard(event, () => setIncident(item))}>
          <td><IncidentIdentity incident={item}/></td>
          <td><strong>{item.issue}</strong><small>{item.branch}</small></td>
          <td><PriorityPill priority={item.priority}/></td>
          <td><strong>{item.reported}</strong><small>{item.reporter}</small></td>
          <td><strong>{item.assignedTo}</strong></td>
          <td><StatusPill status={item.status}/></td>
          <td className="mt-table-action"><ArrowLeftRight size={17}/></td>
        </tr>)}</tbody>
      </table></div>
      {!rows.length && <div className="mt-empty"><Box size={23}/><strong>No incidents match your filters</strong><span>Try a different keyword, status or priority.</span><Button onClick={clearFilters}>Clear filters</Button></div>}
      <div className="mt-table-footer"><span>{rows.length} sample incident record{rows.length === 1 ? '' : 's'} · illustrative only</span><span>Select a row for details</span></div>
    </>;
  }

  return <div className="mt-page">
    <PageHeader eyebrow="RESOURCE LIFECYCLE / OPERATIONS" title="Maintenance & Incidents"
      badgeLabel="UI concept · sample data"
      description="Report issues, coordinate repairs, track service costs and plan preventive care."
      actions={<><Button icon={<ArrowDownToLine size={16}/>} onClick={previewExport}>Export</Button>
        <Button variant="primary" icon={<Plus size={16}/>} onClick={() => setReportOpen(true)}>Report incident</Button></>}/>
    <div className="mt-summary">
      <Card className="mt-stat"><div className="mt-stat-top"><span>Active incidents</span><span className="mt-stat-icon"><Box size={19}/></span></div><strong>8</strong><small>Across company assets</small></Card>
      <Card className="mt-stat"><div className="mt-stat-top"><span>Critical issues</span><span className="mt-stat-icon"><Box size={19}/></span></div><strong>2</strong><small>Require immediate attention</small></Card>
      <Card className="mt-stat"><div className="mt-stat-top"><span>Under maintenance</span><span className="mt-stat-icon"><Box size={19}/></span></div><strong>5</strong><small>Unavailable for new assignment</small></Card>
      <Card className="mt-stat"><div className="mt-stat-top"><span>Service costs · month</span><span className="mt-stat-icon"><Box size={19}/></span></div><strong>₾ 1,290</strong><small>Recorded repair expenses</small></Card>
    </div>

    <Card className="mt-catalog">
      <SectionTabs tabs={maintenanceTabs} selected={tab} onChange={value => chooseTab(value as MaintenanceTab)}/>
      {(tab === 'All incidents' || tab === 'My work') && incidentTable()}
      {tab === 'Preventive schedules' && <>
        <div className="mt-panel-heading"><div><h2>Preventive care plans</h2></div>
          <Button variant="primary" icon={<Plus size={16}/>} onClick={() => { setSelectedSchedule(null); setScheduleOpen(true); }}>New schedule</Button></div>
        <div className="mt-schedule-list">{schedules.map(item =>
          <button className="mt-schedule-row" type="button" key={item.id}
            aria-label={'Preview maintenance schedule ' + item.task}
            onClick={() => { setSelectedSchedule(item); setScheduleOpen(true); }}>
            <span className="mt-square-icon"><Box size={17}/></span><span className="mt-schedule-text">
              <strong>{item.task}</strong><small>{item.assetGroup}</small><small>{item.frequency} · Owner: {item.owner}</small>
            </span>
            <span className="mt-schedule-end"><span className={'mt-pill ' + (item.status === 'Due soon' ? 'mt-status-open' : 'mt-status-in-progress')}>
              <span className="mt-pill-dot"/>{item.status}</span><small>Next: {item.nextService}</small></span>
          </button>)}</div>
        <div className="mt-table-footer">Planned maintenance creates an auditable service history once completed.</div>
      </>}
      {tab === 'Repair expenses' && <>
        <div className="mt-expense-stats">
          <Card><span>Total repair costs · month</span><strong>₾ 1,290</strong><small>Sample forecast</small></Card>
          <Card><span>Completed interventions</span><strong>12</strong><small>Across branches</small></Card>
          <Card><span>Average resolution cost</span><strong>₾ 108</strong><small>Illustrative only</small></Card>
        </div>
        <div className="mt-table-scroll"><table className="mt-table mt-expense-table">
          <thead><tr><th>INCIDENT</th><th>ASSET</th><th>PROVIDER</th><th>AMOUNT</th><th>REPORTED</th><th aria-label="Open details"/></tr></thead>
          <tbody>{repairExpenses.map(entry => {
            const linked = incidents.find(item => item.id === entry.incidentId);
            return <tr key={entry.incidentId} role="button" tabIndex={0} aria-label={'Open ' + entry.incidentId + ' details'}
              onClick={() => { if (linked) setIncident(linked); }}
              onKeyDown={event => openWithKeyboard(event, () => { if (linked) setIncident(linked); })}>
              <td><strong>{entry.incidentId}</strong><small>{entry.issue}</small></td>
              <td><strong>{entry.resource}</strong></td><td className="mt-muted">{entry.provider}</td>
              <td><strong>{entry.currency === 'GEL' ? entry.amount + ' GEL' : (entry.currency === 'USD' ? '$' : '€') + entry.amount}</strong></td>
              <td className="mt-muted">{entry.reported}</td><td className="mt-table-action"><ArrowLeftRight size={17}/></td>
            </tr>;
          })}</tbody>
        </table></div>
        <div className="mt-table-footer">Original currencies, providers and supporting invoices are kept in the asset history.</div>
      </>}
    </Card>
    <div className="mt-preview-note"><Badge tone="blue">UI preview</Badge><span>These incident counts, costs, reminders and workflows are sample data. No production record is created or changed.</span></div>
    {reportOpen && <ReportIncidentDialog close={() => setReportOpen(false)}/>}
    {scheduleOpen && <PreventiveScheduleDialog initial={selectedSchedule} close={() => setScheduleOpen(false)}/>}
    {incident && <IncidentDetailsDrawer incident={incident} close={() => setIncident(null)}/>}
    {notice && <MaintenanceNotice title="Export preview" description={notice} close={() => setNotice('')}/>}
  </div>;
}
