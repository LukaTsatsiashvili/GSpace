import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Boxes, CreditCard, KeyRound, LayoutGrid, Plus, SlidersHorizontal, UsersRound } from 'lucide-react';
import { Badge, Button, Card, PageHeader, SearchInput, SectionTabs, Select } from '../components/ui';
import {
  activityMonths, initialScope, lifecycleBreakdown, reportBranches, reportDepartments, reportModules,
  reportPeriods, reportsTabs, savedViews, scheduledReports, templates,
  type ReportModule, type ReportScope, type ReportsTab, type ReportTemplate, type SavedView, type ScheduledReport
} from './reports-data';
import {
  AdvancedReportFiltersDialog, CreateReportDialog, ScheduleReportDialog, ReportsNotice
} from './ReportsDialogs';
import './reports.css';

const icons = {
  box: Boxes,
  users: UsersRound,
  arrows: ArrowLeftRight,
  grid: LayoutGrid,
  card: CreditCard,
  key: KeyRound
} as const;
function TemplateCard({template,onOpen}: {template:ReportTemplate;onOpen:(template:ReportTemplate)=>void}) {
  const Icon = icons[template.icon];
  return <button className="rp-template" type="button" onClick={()=>onOpen(template)}
    aria-label={'Customize '+template.title+' report'}>
    <span className="rp-template-icon"><Icon size={18}/></span>
    <strong>{template.title}</strong><span className="rp-template-description">{template.description}</span>
    <span className="rp-template-stat">{template.statistic}<ArrowLeftRight size={14}/></span>
  </button>;
}
function KeyRow(event:KeyboardEvent<HTMLTableRowElement>,action:()=>void) {
  if(event.key==='Enter'||event.key===' '){event.preventDefault();action();}
}
function SectionTitle({title,description,action}: {title:string;description?:string;action?:ReactNode}) {
  return <div className="rp-section-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</div>;
}
function ReportTableFooter({children}: {children:ReactNode}) {
  return <div className="rp-table-footer">{children}</div>;
}
function ReportsTable({saved,open}: {saved:SavedView[];open:(entry:SavedView)=>void}) {
  return <div className="rp-table-scroll"><table className="rp-table rp-saved-table">
    <thead><tr><th>SAVED REPORT</th><th>MODULE</th><th>OWNER</th><th>SCOPE</th><th>LAST UPDATED</th><th aria-label="Actions"/></tr></thead>
    <tbody>{saved.map(entry=><tr key={entry.id} role="button" tabIndex={0} aria-label={'Customize saved report '+entry.title}
      onClick={()=>open(entry)} onKeyDown={e=>KeyRow(e,()=>open(entry))}>
      <td><strong>{entry.title}</strong><small>{entry.id} · {entry.favorite?'★ Favorite':'Custom view'}</small></td>
      <td className="rp-muted">{entry.module}</td><td className="rp-muted">{entry.owner}</td>
      <td className="rp-muted">{entry.scope}</td><td className="rp-muted">{entry.updated}</td>
      <td className="rp-table-action"><ArrowLeftRight size={17}/></td>
    </tr>)}</tbody></table></div>;
}
function ScheduledTable({items,open}: {items:ScheduledReport[];open:(entry:ScheduledReport)=>void}) {
  return <div className="rp-table-scroll"><table className="rp-table rp-schedule-table">
    <thead><tr><th>SCHEDULE</th><th>REPORT</th><th>FREQUENCY</th><th>DELIVERY</th><th>AUDIENCE</th><th>STATUS</th></tr></thead>
    <tbody>{items.map(entry=><tr key={entry.id} role="button" tabIndex={0} aria-label={'Review schedule '+entry.title}
      onClick={()=>open(entry)} onKeyDown={e=>KeyRow(e,()=>open(entry))}>
      <td><strong>{entry.title}</strong><small>{entry.id}</small></td>
      <td className="rp-muted">{entry.reportName}</td><td className="rp-muted">{entry.frequency}</td>
      <td className="rp-muted">{entry.delivery}</td><td className="rp-muted">{entry.audience}</td>
      <td><span className={'rp-status rp-status-'+entry.status.toLowerCase()}>{entry.status}</span></td>
    </tr>)}</tbody></table></div>;
}

export default function ReportsPage() {
  const [tab,setTab]=useState<ReportsTab>('Overview');
  const [scope,setScope]=useState<ReportScope>(initialScope);
  const [librarySearch,setLibrarySearch]=useState('');
  const [moduleFilter,setModuleFilter]=useState('All modules');
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [builderOpen,setBuilderOpen]=useState(false);
  const [builderTemplate,setBuilderTemplate]=useState<ReportTemplate|null>(null);
  const [builderSaved,setBuilderSaved]=useState<SavedView|null>(null);
  const [scheduleOpen,setScheduleOpen]=useState(false);
  const [scheduleInitial,setScheduleInitial]=useState<ScheduledReport|null>(null);
  const [notice,setNotice]=useState('');

  const filteredTemplates=useMemo(()=>templates.filter(item=>{
    const query=librarySearch.trim().toLowerCase();
    return (!query||[item.title,item.description,item.module].some(t=>t.toLowerCase().includes(query)))
      && (moduleFilter==='All modules'||item.module===moduleFilter);
  }),[librarySearch,moduleFilter]);

  const newReport=()=>{setBuilderTemplate(null);setBuilderSaved(null);setBuilderOpen(true);};
  const openTemplate=(template:ReportTemplate)=>{
    setBuilderTemplate(template);setBuilderSaved(null);setBuilderOpen(true);
  };
  const openSaved=(saved:SavedView)=>{
    setBuilderSaved(saved);
    setBuilderTemplate(templates.find(template=>template.id===saved.reportId)??null);
    setBuilderOpen(true);
  };
  const openSchedule=(existing:ScheduledReport|null=null)=>{
    setScheduleInitial(existing);setScheduleOpen(true);
  };
  const exportNotice=()=>setNotice('The report export is a visual preview. Real Excel, CSV and PDF exports require a permission-scoped API and authorized data.');
  const goLibrary=()=>setTab('Report library');
  return <div className="rp-page">
    <PageHeader eyebrow="INSIGHTS / ORGANIZATION INTELLIGENCE" title="Reports & Analytics" badgeLabel="UI concept · sample data"
      description="Explore resource operations across departments, locations and historical periods."
      actions={<><Button icon={<ArrowDownToLine size={16}/>} onClick={exportNotice}>Export</Button>
        <Button variant="primary" icon={<Plus size={16}/>} onClick={newReport}>Create report</Button></>}/>
    <div className="rp-kpis">
      <Card className="rp-kpi"><span>Assets under management</span><strong>2,486</strong><small>Across authorized branches</small></Card>
      <Card className="rp-kpi"><span>Active assignments</span><strong>1,248</strong><small>50.2% of registered assets</small></Card>
      <Card className="rp-kpi"><span>Inventory accuracy</span><strong>97.8%</strong><small>Latest completed counts</small></Card>
      <Card className="rp-kpi"><span>Open incidents</span><strong>8</strong><small>2 critical · requires review</small></Card>
    </div>
    <Card className="rp-catalog">
      <SectionTabs tabs={reportsTabs} selected={tab} onChange={next=>setTab(next as ReportsTab)}/>
      {tab==='Overview'&&<>
        <div className="rp-scope-bar">
          <span className="rp-scope-label">REPORT SCOPE</span>
          <Select className="rp-scope-period" label="Report period" value={scope.period} options={reportPeriods}
            onChange={period=>setScope(current=>({...current,period}))}/>
          <Select className="rp-scope-branch" label="Report branch" value={scope.branch} options={reportBranches}
            onChange={branch=>setScope(current=>({...current,branch}))}/>
          <Select className="rp-scope-department" label="Report department" value={scope.department} options={reportDepartments}
            onChange={department=>setScope(current=>({...current,department}))}/>
          <span className="rp-flex-space"/>
          <Button icon={<SlidersHorizontal size={15}/>} onClick={()=>setFiltersOpen(true)}>Advanced filters</Button>
        </div>
        <div className="rp-overview-charts">
          <section className="rp-chart-panel"><h2>Resource activity over time</h2>
            <p>Assignments and movement events · sample period</p>
            <div className="rp-activity-chart" role="img" aria-label="Sample resource activity: June 68, July 91, August 84, September 116, October 103, November 127">
              {activityMonths.map(entry=><div className="rp-month" key={entry.label}>
                <strong>{entry.value}</strong><span className="rp-activity-column" style={{height:Math.round(entry.value/140*135)+'px'}}/>
                <small>{entry.label}</small>
              </div>)}
            </div>
          </section>
          <section className="rp-chart-panel"><h2>Resources by lifecycle status</h2><p>Active operational snapshot · sample</p>
            <div className="rp-lifecycle-chart">{lifecycleBreakdown.map(item=><div key={item.label} className="rp-lifecycle-row">
              <strong>{item.label}</strong><div className="rp-progress"><span style={{width:item.value+'%'}}/></div><span>{item.value}%</span>
            </div>)}</div>
          </section>
        </div>
        <SectionTitle title="Popular report templates" action={<Button onClick={goLibrary}>Browse all reports</Button>}/>
        <div className="rp-template-grid rp-popular">{templates.slice(0,3).map(template=>
          <TemplateCard key={template.id} template={template} onOpen={openTemplate}/>)}</div>
      </>}
      {tab==='Report library'&&<>
        <div className="rp-library-toolbar"><SearchInput className="rp-library-search" aria-label="Search report templates"
          placeholder="Search reports and modules..." value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)}/>
          <Select className="rp-library-module" label="Filter reports by module"
            options={['All modules',...reportModules]} value={moduleFilter} onChange={setModuleFilter}/>
          <span className="rp-flex-space"/><span className="rp-template-count">{filteredTemplates.length} report template{filteredTemplates.length===1?'':'s'}</span>
        </div>
        <div className="rp-template-grid rp-library-grid">{filteredTemplates.map(template=>
          <TemplateCard key={template.id} template={template} onOpen={openTemplate}/>)}</div>
        {!filteredTemplates.length&&<div className="rp-empty"><strong>No report templates match your search.</strong>
          <Button onClick={()=>{setLibrarySearch('');setModuleFilter('All modules');}}>Clear filters</Button></div>}
      </>}
      {tab==='Saved reports'&&<>
        <SectionTitle title="Saved report views" action={<Button variant="primary" icon={<Plus size={16}/>}
          onClick={newReport}>New saved view</Button>}/>
        <ReportsTable saved={savedViews} open={openSaved}/>
        <ReportTableFooter>Custom views retain filters, columns and chart selections; access remains permission-scoped.</ReportTableFooter>
      </>}
      {tab==='Scheduled reports'&&<>
        <SectionTitle title="Scheduled report delivery"
          description="Daily / Weekly / Monthly / Custom · email or system notification"
          action={<Button variant="primary" icon={<Plus size={16}/>} onClick={()=>openSchedule()}>New schedule</Button>}/>
        <ScheduledTable items={scheduledReports} open={openSchedule}/>
        <ReportTableFooter>Recipients must be authorized for the report scope and sensitive fields before delivery.</ReportTableFooter>
      </>}
    </Card>
    <p className="rp-footnote"><Badge tone="blue">UI preview</Badge> All counts, charts, permissions and report records are illustrative. No report is saved, sent, scheduled or exported.</p>
    {filtersOpen&&<AdvancedReportFiltersDialog initial={scope} close={()=>setFiltersOpen(false)} apply={next=>{setScope(next);setFiltersOpen(false);}}/>}
    {builderOpen&&<CreateReportDialog key={(builderSaved?.id??builderTemplate?.id??'new')}
      template={builderTemplate} saved={builderSaved} close={()=>setBuilderOpen(false)}/>}
    {scheduleOpen&&<ScheduleReportDialog key={scheduleInitial?.id??'new'} initial={scheduleInitial}
      close={()=>setScheduleOpen(false)}/>}
    {notice&&<ReportsNotice title="Export preview" message={notice} close={()=>setNotice('')}/>}
  </div>;
}
