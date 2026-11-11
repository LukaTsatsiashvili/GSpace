export type AuditTab = 'Business Audit' | 'Security Audit' | 'Diagnostics' | 'System Health' | 'Retention';
export type Severity = 'Info' | 'Warning' | 'Critical';
export type AuditResult = 'Success' | 'Failed';
export type DiagnosticStatus = 'Open' | 'Investigating' | 'Resolved';

export interface AuditEvent {
  id: string; timestamp: string; actor: string; initials: string; branch: string;
  module: string; action: string; entity: string; requestId: string;
  result: AuditResult; severity: Severity; ip: string;
  description: string; previous?: { field: string; value: string }; next?: { field: string; value: string };
  category: 'Business Audit' | 'Security Audit';
}
export interface DiagnosticEvent {
  id: string; timestamp: string; service: string; duration: number;
  operation: string; errorCode: string; requestId: string; severity: Severity;
  status: DiagnosticStatus; description: string; summary: string;
}
export interface AuditFilters {
  search: string; range: string; module: string; result: string; severity: string;
  actor: string; action: string; branch: string;
  startDate: string; endDate: string;
}
export interface HealthService { name: string; status: 'Resolved' | 'Warning'; detail: string; percent: number; }
export interface HealthCheck { name: string; detail: string; status: 'Resolved' | 'Warning'; }

export const tabs: AuditTab[] = ['Business Audit','Security Audit','Diagnostics','System Health','Retention'];
export const timeRanges = ['Last 24 hours','Last 7 days','Last 30 days','Last 90 days','All time','Custom range'];
export const severityOptions = ['All severities','Info','Warning','Critical'];
export const resultOptions = ['All results','Success','Failed'];
export const auditModuleOptions = ['All modules','Resources','Assignments','Inventory','Finance','Transfers','Administration','Authentication','Reports'];
export const auditActorOptions = ['All users','Sandro Papiashvili','Nino Kapanadze','Giorgi Maisuradze','Mariam Beridze','Luka Dolidze','System Administrator','Unknown user'];
export const auditBranchOptions = ['All branches','Head Office','Tbilisi Store 01','Batumi Store 01','Kutaisi Store 01'];
export const auditActionOptions = ['All actions','Resource updated','Assignment accepted','Count reconciled','Cost correction','Transfer created','Permission changed','Failed login','Sensitive export','Session revoked'];
export const demoFilters: AuditFilters = {
  search:'',range:'Last 7 days',module:'All modules',result:'All results',
  severity:'All severities',actor:'All users',action:'All actions',branch:'All branches',
  startDate:'',endDate:''
};

export const businessEvents: AuditEvent[] = [
 {id:'AUD-09182',timestamp:'2026-11-06T10:42:18',actor:'Sandro Papiashvili',initials:'SP',branch:'Head Office',module:'Resources',action:'Resource updated',entity:'RES-00241 · Dell U2723QE',requestId:'req_f3a82',result:'Success',severity:'Info',ip:'10.0.0.12',description:'Resource details updated by an authorized user.',previous:{field:'Condition',value:'Needs attention'},next:{field:'Condition',value:'Good'},category:'Business Audit'},
 {id:'AUD-09180',timestamp:'2026-11-06T10:34:42',actor:'Nino Kapanadze',initials:'NK',branch:'Tbilisi Store 01',module:'Assignments',action:'Assignment accepted',entity:'ASN-10348 · Lenovo T14',requestId:'req_f3a79',result:'Success',severity:'Info',ip:'10.0.0.26',description:'Assigned employee accepted the resource handover.',previous:{field:'Assignment',value:'Pending confirmation'},next:{field:'Assignment',value:'Accepted'},category:'Business Audit'},
 {id:'AUD-09178',timestamp:'2026-11-06T09:58:03',actor:'Giorgi Maisuradze',initials:'GM',branch:'Head Office',module:'Inventory',action:'Count reconciled',entity:'INV-0092 · Head Office',requestId:'req_f3a64',result:'Success',severity:'Info',ip:'10.0.0.34',description:'Inventory count verified and discrepancies reconciled.',previous:{field:'Count status',value:'Pending review'},next:{field:'Count status',value:'Reconciled'},category:'Business Audit'},
 {id:'AUD-09177',timestamp:'2026-11-06T09:31:56',actor:'Mariam Beridze',initials:'MB',branch:'Batumi Store 01',module:'Finance',action:'Cost correction',entity:'FIN-0249 · ThinkPad T14',requestId:'req_f3a56',result:'Success',severity:'Warning',ip:'10.0.0.41',description:'Purchase value correction requested with an audit reason.',previous:{field:'Acquisition cost',value:'₾3,700'},next:{field:'Acquisition cost',value:'₾3,740'},category:'Business Audit'},
 {id:'AUD-09175',timestamp:'2026-11-05T18:21:07',actor:'Luka Dolidze',initials:'LD',branch:'Kutaisi Store 01',module:'Transfers',action:'Transfer created',entity:'TRF-1204 · POS Tablet',requestId:'req_f3a33',result:'Success',severity:'Info',ip:'10.0.0.53',description:'A transfer request between branches was submitted.',previous:{field:'Transfer status',value:'Not created'},next:{field:'Transfer status',value:'Pending receipt'},category:'Business Audit'}
];

export const securityEvents: AuditEvent[] = [
 {id:'AUD-09181',timestamp:'2026-11-06T10:38:09',actor:'System Administrator',initials:'SA',branch:'Head Office',module:'Administration',action:'Permission changed',entity:'ROLE-006 · Branch Manager',requestId:'req_f3a80',result:'Success',severity:'Warning',ip:'10.0.0.12',description:'Financial report export permission enabled by an authorized administrator.',previous:{field:'Finance export',value:'Disabled'},next:{field:'Finance export',value:'Enabled'},category:'Security Audit'},
 {id:'AUD-09179',timestamp:'2026-11-06T10:25:11',actor:'Unknown user',initials:'Uu',branch:'Head Office',module:'Authentication',action:'Failed login',entity:'Login attempt · username redacted',requestId:'req_f3a70',result:'Failed',severity:'Warning',ip:'10.0.0.77',description:'A failed login attempt was recorded. Credentials and identity details are not stored in this example.',category:'Security Audit'},
 {id:'AUD-09176',timestamp:'2026-11-06T09:13:29',actor:'Sandro Papiashvili',initials:'SP',branch:'Head Office',module:'Reports',action:'Sensitive export',entity:'RPT-0039 · Asset financials',requestId:'req_f3a52',result:'Success',severity:'Warning',ip:'10.0.0.12',description:'Sensitive report export was authorized and registered in the audit trail.',previous:{field:'Export status',value:'Requested'},next:{field:'Export status',value:'Approved'},category:'Security Audit'},
 {id:'AUD-09174',timestamp:'2026-11-05T17:03:42',actor:'System Administrator',initials:'SA',branch:'Head Office',module:'Authentication',action:'Session revoked',entity:'SESSION-0042',requestId:'req_f3a18',result:'Success',severity:'Info',ip:'10.0.0.12',description:'A previously authenticated session was revoked by an administrator.',previous:{field:'Session status',value:'Active'},next:{field:'Session status',value:'Revoked'},category:'Security Audit'}
];

export const diagnosticEvents: DiagnosticEvent[] = [
 {id:'ERR-00631',timestamp:'2026-11-06T10:41:12',service:'API Gateway',duration:3210,operation:'POST /api/transfers',errorCode:'HTTP 503',requestId:'req_g3la8',severity:'Critical',status:'Open',description:'Transfer service timed out while waiting for the database pool.',summary:'Retry queue activated. The incident is visible to administrators only.'},
 {id:'ERR-00630',timestamp:'2026-11-06T10:22:08',service:'Background Jobs',duration:5042,operation:'Asset reminder worker',errorCode:'JOB_RETRY',requestId:'job_70d2',severity:'Warning',status:'Investigating',description:'Reminder processing required another attempt after a queue delay.',summary:'Three jobs remain queued for retry; no permanent failure has been confirmed.'},
 {id:'ERR-00629',timestamp:'2026-11-06T09:54:44',service:'Storage',duration:8120,operation:'Attachment upload',errorCode:'STORAGE_TIMEOUT',requestId:'req_g3l91',severity:'Warning',status:'Resolved',description:'Storage operation exceeded the expected response time.',summary:'Retry succeeded and the storage request recovered.'},
 {id:'ERR-00628',timestamp:'2026-11-06T09:19:21',service:'Database',duration:1284,operation:'Inventory query',errorCode:'SLOW_QUERY',requestId:'req_g3l74',severity:'Info',status:'Resolved',description:'Inventory lookup exceeded the configured monitoring threshold.',summary:'Database query completed successfully after inspection.'},
 {id:'ERR-00627',timestamp:'2026-11-05T22:08:13',service:'Integrations',duration:6720,operation:'Email dispatch',errorCode:'SMTP_CONNECT',requestId:'job_6fb9',severity:'Critical',status:'Resolved',description:'Email provider connection was temporarily unavailable.',summary:'Subsequent dispatch succeeded. No message contents were logged.'}
];

export const healthServices: HealthService[] = [
 {name:'API services',status:'Resolved',detail:'Healthy · 99.96%',percent:98},
 {name:'Database',status:'Resolved',detail:'Healthy · 13 ms avg',percent:94},
 {name:'File storage',status:'Warning',detail:'Degraded · 240 ms avg',percent:68},
 {name:'Background jobs',status:'Resolved',detail:'Healthy · 99.7% success',percent:91}
];
export const healthChecks: HealthCheck[] = [
 {name:'API request latency',detail:'P95 response time 420 ms · within target',status:'Resolved'},
 {name:'Background queue',detail:'3 retries pending · no failed permanent jobs',status:'Warning'},
 {name:'Database connectivity',detail:'Connections stable · 12 / 40 active',status:'Resolved'},
 {name:'Backup & recovery',detail:'Last successful backup: Nov 06, 02:00',status:'Resolved'},
 {name:'Data integrity checks',detail:'Last validation passed · no checksum mismatches',status:'Resolved'}
];
export const retentionMetrics = [
 {name:'Business audit',period:'180 days',detail:'Protected archive after retention'},
 {name:'Security audit',period:'365 days',detail:'Immutable protected archive'},
 {name:'Diagnostics',period:'30 days',detail:'Auto-archive / cleanup'},
 {name:'Request metrics',period:'14 days',detail:'Aggregated performance data'}
];

export function displayTimestamp(iso: string, includeTime = true): string {
  const [date,time=''] = iso.split('T');
  const [year,month,day] = date.split('-');
  const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return names[Number(month)-1]+' '+day+', '+year+(includeTime?' · '+time:'');
}
export function matchesRange(iso: string, filters: AuditFilters): boolean {
  const date=iso.substring(0,10);
  if(filters.range==='Custom range') return !!filters.startDate && !!filters.endDate && date>=filters.startDate && date<=filters.endDate;
  if(filters.range==='All time')return true;
  // The static demonstration uses the latest sample timestamp as a reference, not a live clock.
  const anchor=new Date('2026-11-06T12:00:00');
  const recordDate=new Date(iso);
  const days=filters.range==='Last 24 hours'?1:filters.range==='Last 7 days'?7:filters.range==='Last 30 days'?30:90;
  const age=anchor.getTime()-recordDate.getTime();
  return age>=0 && age<=days*24*60*60*1000;
}
export function sampleAuditJSON(event: AuditEvent) {
  // Never include an authentication credential or full private payload in this sample.
  return JSON.stringify({
    type:'sample-audit-event',id:event.id,timestamp:event.timestamp,category:event.category,
    actor:event.actor,branch:event.branch,module:event.module,action:event.action,
    entity:event.entity,result:event.result,severity:event.severity,requestId:event.requestId,
    previous:event.previous??null,next:event.next??null
  },null,2);
}
