import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Activity, ArrowDownToLine, ArrowLeftRight, Box, Filter, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, PageHeader, SearchInput, SectionTabs, Select } from '../components/ui';
import {
  auditModuleOptions, businessEvents, demoFilters, diagnosticEvents, displayTimestamp,
  healthChecks, healthServices, matchesRange, resultOptions, retentionMetrics,
  securityEvents, severityOptions, tabs, timeRanges,
  type AuditEvent, type AuditFilters, type AuditTab, type DiagnosticEvent
} from './audit-data';
import {
  AdvancedAuditFiltersDialog, AuditEventDrawer, AuditNotice,
  DiagnosticEventDrawer, MonitoringSettingsDialog, RetentionSettingsDialog
} from './AuditDialogs';
import './audit.css';

function DetailKey(event:KeyboardEvent<HTMLTableRowElement>,open:()=>void) {
  if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}
}
function StatusPill({value}:{value:string}) {
  const cls=value.toLowerCase().replace(/\s/g,'-');
  return <span className={'ad-pill ad-result-'+cls}><i/>{value}</span>;
}
function SeverityPill({value}:{value:string}) {
  return <span className={'ad-pill ad-severity-'+value.toLowerCase()}><i/>{value}</span>;
}
function Toolbar({children}:{children:ReactNode}) {
  return <div className="ad-toolbar">{children}</div>;
}
function Footer({children}:{children:ReactNode}) {
  return <div className="ad-table-footer">{children}</div>;
}
function SectionTitle({title,description,action}:{title:string;description?:string;action?:ReactNode}) {
  return <div className="ad-section-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>;
}
function EmptyMessage({reset}:{reset:()=>void}) {
  return <div className="ad-empty"><strong>No sample events match your filters</strong>
    <span>Try another date range, search term or status.</span><Button onClick={reset}>Clear filters</Button></div>;
}
function AuditTable({rows,onOpen}:{rows:AuditEvent[];onOpen:(entry:AuditEvent)=>void}) {
  return <div className="ad-table-scroll"><table className="ad-table ad-audit-table">
    <thead><tr><th>TIME / EVENT</th><th>ACTOR</th><th>MODULE / ACTION</th><th>ENTITY</th><th>RESULT</th><th>SEVERITY</th><th aria-label="Open event"/></tr></thead>
    <tbody>{rows.map(entry=><tr key={entry.id} role="button" tabIndex={0}
      aria-label={'Open audit event '+entry.id} onClick={()=>onOpen(entry)}
      onKeyDown={event=>DetailKey(event,()=>onOpen(entry))}>
      <td><strong>{entry.id}</strong><small>{displayTimestamp(entry.timestamp)}</small></td>
      <td><div className="ad-person"><span className="ad-avatar">{entry.initials}</span><div><strong>{entry.actor}</strong><small>{entry.branch}</small></div></div></td>
      <td><strong>{entry.action}</strong><small>{entry.module}</small></td>
      <td><strong>{entry.entity}</strong><small>{entry.requestId}</small></td>
      <td><StatusPill value={entry.result}/></td><td><SeverityPill value={entry.severity}/></td>
      <td className="ad-row-action"><ArrowLeftRight size={16}/></td>
    </tr>)}</tbody>
  </table></div>;
}
function DiagnosticTable({rows,onOpen}:{rows:DiagnosticEvent[];onOpen:(entry:DiagnosticEvent)=>void}) {
  return <div className="ad-table-scroll"><table className="ad-table ad-diagnostic-table">
    <thead><tr><th>EVENT / TIMESTAMP</th><th>SERVICE</th><th>OPERATION</th><th>ERROR CODE</th><th>SEVERITY</th><th>STATUS</th><th aria-label="Open diagnostic"/></tr></thead>
    <tbody>{rows.map(entry=><tr key={entry.id} role="button" tabIndex={0}
      aria-label={'Open diagnostic event '+entry.id} onClick={()=>onOpen(entry)}
      onKeyDown={event=>DetailKey(event,()=>onOpen(entry))}>
      <td><strong>{entry.id}</strong><small>{displayTimestamp(entry.timestamp)}</small></td>
      <td><strong>{entry.service}</strong><small>{entry.duration.toLocaleString()} ms</small></td>
      <td><strong>{entry.operation}</strong><small>{entry.requestId}</small></td>
      <td className="ad-muted">{entry.errorCode}</td>
      <td><SeverityPill value={entry.severity}/></td><td><StatusPill value={entry.status}/></td>
      <td className="ad-row-action"><ArrowLeftRight size={16}/></td>
    </tr>)}</tbody></table></div>;
}

export default function AuditPage() {
  const [tab,setTab]=useState<AuditTab>('Business Audit');
  const [filters,setFilters]=useState<AuditFilters>({...demoFilters});
  const [advancedOpen,setAdvancedOpen]=useState(false);
  const [selectedAudit,setSelectedAudit]=useState<AuditEvent|null>(null);
  const [selectedDiagnostic,setSelectedDiagnostic]=useState<DiagnosticEvent|null>(null);
  const [monitorOpen,setMonitorOpen]=useState(false);
  const [retentionOpen,setRetentionOpen]=useState(false);
  const [notice,setNotice]=useState<{title:string;description:string}|null>(null);
  const change=(name:keyof AuditFilters,value:string)=>setFilters(current=>({...current,[name]:value}));
  const reset=()=>setFilters({...demoFilters});
  const isAudit=tab==='Business Audit'||tab==='Security Audit';
  const isLog=isAudit||tab==='Diagnostics';
  const auditRows=useMemo(()=>{
    const data=tab==='Security Audit'?securityEvents:businessEvents;
    return data.filter(entry=>{
      const q=filters.search.trim().toLowerCase();
      return matchesRange(entry.timestamp,filters)
        && (filters.module==='All modules'||entry.module===filters.module)
        && (filters.result==='All results'||entry.result===filters.result)
        && (filters.severity==='All severities'||entry.severity===filters.severity)
        && (filters.actor==='All users'||entry.actor===filters.actor)
        && (filters.action==='All actions'||entry.action===filters.action)
        && (filters.branch==='All branches'||entry.branch===filters.branch)
        && (!q||[entry.id,entry.actor,entry.module,entry.action,entry.entity,entry.requestId,entry.branch]
          .some(value=>value.toLowerCase().includes(q)));
    });
  },[filters,tab]);
  const diagnosticRows=useMemo(()=>diagnosticEvents.filter(entry=>{
    const q=filters.search.trim().toLowerCase();
    return matchesRange(entry.timestamp,filters)
      && (filters.severity==='All severities'||entry.severity===filters.severity)
      && (!q||[entry.id,entry.service,entry.operation,entry.errorCode,entry.requestId,entry.status]
        .some(value=>value.toLowerCase().includes(q)));
  }),[filters]);

  const changeTab=(next:AuditTab)=>{setTab(next);reset();};
  const showExport=()=>setNotice({title:'Export logs preview',description:'These are sample audit records only. Real log export requires server-side authorization, redaction, filtering and an auditable download service. No production logs have been accessed.'});
  const showRefresh=()=>setNotice({title:'Refresh preview',description:'Sample monitoring and audit data is static. Real-time refresh will be connected to authenticated backend endpoints in a future stage.'});

  return <div className="ad-page">
    <PageHeader eyebrow="SYSTEM / TRACEABILITY & HEALTH" title="Audit & Diagnostics"
      badgeLabel="UI concept · sample data"
      description="Trace business and security changes, investigate errors and monitor system health."
      actions={<><Button icon={<ArrowDownToLine size={16}/>} onClick={showExport}>Export logs</Button>
        <Button variant="primary" icon={<RefreshCw size={15}/>} onClick={showRefresh}>Refresh</Button></>}/>
    <div className="ad-kpis">
      <Card className="ad-kpi"><span>Events · past 24h</span><strong>1,284</strong><small>Across business and security</small></Card>
      <Card className="ad-kpi"><span>Failed security events</span><strong>7</strong><small>Requires security review</small></Card>
      <Card className="ad-kpi"><span>Critical errors</span><strong>2</strong><small>1 unresolved diagnostic issue</small></Card>
      <Card className="ad-kpi"><span>System availability</span><strong>99.94%</strong><small>Sample past-30-day uptime</small></Card>
    </div>

    <Card className="ad-catalog">
      <SectionTabs tabs={tabs} selected={tab} onChange={value=>changeTab(value as AuditTab)}/>
      {isLog&&<>
        <Toolbar>
          <SearchInput className="ad-search" aria-label="Search audit events" placeholder="Search actor, entity or Request ID"
            value={filters.search} onChange={event=>change('search',event.target.value)}/>
          <Select className="ad-range" label="Audit date range" value={filters.range} options={timeRanges}
            onChange={value=>change('range',value)}/>
          {isAudit && <>
            <Select className="ad-filter" label="Audit module" value={filters.module} options={auditModuleOptions}
              onChange={value=>change('module',value)}/>
            <Select className="ad-filter" label="Audit result" value={filters.result} options={resultOptions}
              onChange={value=>change('result',value)}/>
          </>}
          <Select className="ad-filter" label="Event severity" value={filters.severity} options={severityOptions}
            onChange={value=>change('severity',value)}/>
          <span className="ad-toolbar-spacer"/>
          <Button icon={<Filter size={15}/>} onClick={()=>setAdvancedOpen(true)}>More filters</Button>
        </Toolbar>
        {filters.range==='Custom range'&&<div className="ad-custom-range">
          <label>From <input aria-label="Custom start date preview" type="date" value={filters.startDate}
            onChange={e=>change('startDate',e.target.value)}/></label>
          <label>To <input aria-label="Custom end date preview" type="date" value={filters.endDate}
            onChange={e=>change('endDate',e.target.value)}/></label>
        </div>}
        {isAudit ? <AuditTable rows={auditRows} onOpen={setSelectedAudit}/>
          : <DiagnosticTable rows={diagnosticRows} onOpen={setSelectedDiagnostic}/>}
        {((isAudit&&!auditRows.length)||(!isAudit&&!diagnosticRows.length))&&<EmptyMessage reset={reset}/>}
        <Footer>{isAudit?'Showing '+auditRows.length+' sample events · immutable audit history · server-side pagination in production':
          diagnosticRows.length+' illustrative diagnostics · no private payloads or credentials logged'}</Footer>
      </>}

      {tab==='System Health'&&<>
        <div className="ad-health-grid">{healthServices.map(service=><div className="ad-health-card" key={service.name}>
          <span>{service.name}</span><StatusPill value={service.status}/>
          <small>{service.detail}</small>
          <div className="ad-health-meter"><span className={service.status==='Warning'?'warning':''} style={{width:service.percent+'%'}}/></div>
        </div>)}</div>
        <SectionTitle title="Operational monitoring" action={<Button onClick={()=>setMonitorOpen(true)}>Monitoring settings</Button>}/>
        <div className="ad-monitoring-list">{healthChecks.map(check=><div className="ad-monitoring-row" key={check.name}>
          <span className="ad-monitor-icon"><Box size={18}/></span><div><strong>{check.name}</strong><small>{check.detail}</small></div>
          <StatusPill value={check.status}/>
        </div>)}</div>
        <Footer>System health is restricted to authorized administrators. Alerts apply to critical failures. This is illustrative monitoring only.</Footer>
      </>}

      {tab==='Retention'&&<>
        <SectionTitle title="Retention & log governance" description="Separate archival policies for immutable audit trails and transient diagnostics"
          action={<Button variant="primary" onClick={()=>setRetentionOpen(true)}>Configure policy</Button>}/>
        <div className="ad-retention-grid">{retentionMetrics.map(metric=><div className="ad-retention-card" key={metric.name}>
          <span>{metric.name}</span><strong>{metric.period}</strong><small>{metric.detail}</small>
        </div>)}</div>
        <div className="ad-retention-note">Illustrative settings only. Production retention needs organization approval; ordinary users cannot edit or erase the audit log. Protected archives remain under separate administrative controls.</div>
      </>}
    </Card>
    <div className="ad-preview-caption"><Badge tone="blue">UI preview</Badge>
      <span>Audit records, diagnostics, uptime and retention are sample-only. Backend enforcement and actual monitoring are not connected.</span>
    </div>

    {advancedOpen&&<AdvancedAuditFiltersDialog diagnostics={tab==='Diagnostics'} initial={filters}
      apply={next=>{setFilters(next);setAdvancedOpen(false);}} close={()=>setAdvancedOpen(false)}/>}
    {selectedAudit&&<AuditEventDrawer event={selectedAudit} close={()=>setSelectedAudit(null)}/>}
    {selectedDiagnostic&&<DiagnosticEventDrawer event={selectedDiagnostic} close={()=>setSelectedDiagnostic(null)}/>}
    {monitorOpen&&<MonitoringSettingsDialog close={()=>setMonitorOpen(false)}/>}
    {retentionOpen&&<RetentionSettingsDialog close={()=>setRetentionOpen(false)}/>}
    {notice&&<AuditNotice title={notice.title} description={notice.description} close={()=>setNotice(null)}/>}
  </div>;
}
