export type ReportsTab = 'Overview' | 'Report library' | 'Saved reports' | 'Scheduled reports';
export type ReportModule = 'Assets' | 'Assignments' | 'Transfers' | 'Inventory' | 'Finance' | 'Maintenance' | 'Licenses';
export type ReportField = 'Resource identifier' | 'Branch / location' | 'Category / status' | 'Responsible employee' | 'Financial values' | 'Date / activity history';

export interface ReportTemplate {
  id: string;
  title: string;
  module: ReportModule;
  description: string;
  statistic: string;
  icon: 'box' | 'users' | 'arrows' | 'grid' | 'card' | 'key';
}
export interface SavedView {
  id: string;
  title: string;
  module: ReportModule;
  owner: string;
  scope: string;
  updated: string;
  favorite: boolean;
  reportId: string;
}
export interface ScheduledReport {
  id: string;
  title: string;
  reportId: string;
  reportName: string;
  frequency: string;
  delivery: string;
  audience: string;
  time: string;
  status: 'Active' | 'Paused';
}
export interface ReportScope {
  period: string;
  branch: string;
  department: string;
  employee: string;
  category: string;
  status: string;
}
export interface CustomReport {
  title: string;
  dataSource: ReportModule;
  branch: string;
  period: string;
  groupBy: string;
  visualization: string;
  fields: ReportField[];
}
export interface ScheduleDraft {
  name: string;
  reportId: string;
  frequency: string;
  channel: string;
  audience: string;
  time: string;
}

export const reportsTabs: ReportsTab[] = ['Overview','Report library','Saved reports','Scheduled reports'];
export const reportPeriods = ['Last 7 days','Last 30 days','Last 90 days','This month','This quarter','This year','Custom range'];
export const reportBranches = ['All permitted branches','Head Office','Tbilisi Store 01','Batumi Store 01','Kutaisi Store 01'];
export const reportDepartments = ['All departments','IT','Operations','Finance','Retail'];
export const reportEmployees = ['All employees','Sandro Papiashvili','Nino Kapanadze','Giorgi Maisuradze','Mariam Beridze'];
export const reportCategories = ['All categories','Hardware','Mobile devices','Peripherals','Software','Maintenance'];
export const reportStatuses = ['All statuses','Assigned','Available','In maintenance','In transit','Other'];
export const reportModules: ReportModule[] = ['Assets','Assignments','Transfers','Inventory','Finance','Maintenance','Licenses'];
export const reportGrouping = ['Branch','Department','Category','Status','Owner','Month'];
export const reportVisualizations = ['Table + bar chart','Table only','Bar chart','Summary cards'];
export const reportFields: ReportField[] = ['Resource identifier','Branch / location','Category / status','Responsible employee','Financial values','Date / activity history'];
export const scheduleFrequencies = ['Daily','Weekly','Monthly','Custom'];
export const deliveryChannels = ['Email + in-app','Email','In-app'];
export const recipientGroups = ['Only me','Branch managers','Finance editors','System administrators'];

export const templates: ReportTemplate[] = [
 {id:'REP-001',title:'Asset register',module:'Assets',description:'Inventory of assets by category, location, condition and owner.',statistic:'2,486 records',icon:'box'},
 {id:'REP-002',title:'Assignment history',module:'Assignments',description:'Who received an asset, when, and its return status.',statistic:'1,248 assignments',icon:'users'},
 {id:'REP-003',title:'Transfer activity',module:'Transfers',description:'Inter-branch movement, custody changes and confirmations.',statistic:'138 transfers',icon:'arrows'},
 {id:'REP-004',title:'Stock & discrepancies',module:'Inventory',description:'Physical counts, missing assets and reconciliation outcomes.',statistic:'97.8% verified',icon:'grid'},
 {id:'REP-005',title:'Acquisition & costs',module:'Finance',description:'Purchase values, suppliers, outstanding payments and operating costs.',statistic:'₾1.28m tracked',icon:'card'},
 {id:'REP-006',title:'Incidents & repairs',module:'Maintenance',description:'Open issues, repair timelines, severity and service expenses.',statistic:'8 active incidents',icon:'box'},
 {id:'REP-007',title:'License allocation',module:'Licenses',description:'Subscriptions, license seats, vendor ownership and renewal dates.',statistic:'184 assigned seats',icon:'key'},
 {id:'REP-008',title:'Subscription spending',module:'Licenses',description:'Recurring services, renewal commitments and periodic spend.',statistic:'₾24.8k monthly',icon:'card'}
];

export const savedViews: SavedView[] = [
 {id:'SAV-021',title:'Monthly asset utilization',module:'Assets',owner:'Sandro Papiashvili',scope:'All permitted branches',updated:'Nov 05, 2026',favorite:true,reportId:'REP-001'},
 {id:'SAV-020',title:'Branch maintenance costs',module:'Maintenance',owner:'Sandro Papiashvili',scope:'Head Office + Tbilisi',updated:'Nov 04, 2026',favorite:true,reportId:'REP-006'},
 {id:'SAV-019',title:'License renewal risks',module:'Licenses',owner:'Nino Kapanadze',scope:'Head Office',updated:'Nov 02, 2026',favorite:false,reportId:'REP-007'}
];

export const scheduledReports: ScheduledReport[] = [
 {id:'SCH-011',title:'Weekly inventory summary',reportId:'REP-004',reportName:'Stock & discrepancies',frequency:'Weekly · Monday 09:00',delivery:'Email + in-app',audience:'Branch managers',time:'09:00',status:'Active'},
 {id:'SCH-010',title:'Monthly financial overview',reportId:'REP-005',reportName:'Acquisition & costs',frequency:'Monthly · 1st day',delivery:'Email',audience:'Finance editors',time:'09:00',status:'Active'},
 {id:'SCH-009',title:'Critical incidents digest',reportId:'REP-006',reportName:'Incidents & repairs',frequency:'Daily · 08:30',delivery:'In-app',audience:'System administrators',time:'08:30',status:'Paused'}
];

export const activityMonths = [
 {label:'Jun',value:68},{label:'Jul',value:91},{label:'Aug',value:84},
 {label:'Sep',value:116},{label:'Oct',value:103},{label:'Nov',value:127}
];
export const lifecycleBreakdown = [
 {label:'Assigned',value:63},{label:'Available',value:21},{label:'In maintenance',value:9},
 {label:'In transit',value:5},{label:'Other',value:2}
];

export const initialScope: ReportScope = {
  period:'Last 30 days',branch:'All permitted branches',department:'All departments',
  employee:'All employees',category:'All categories',status:'All statuses'
};
export const initialReport: CustomReport = {
  title:'',dataSource:'Assets',branch:'All permitted branches',period:'Last 30 days',
  groupBy:'Branch',visualization:'Table + bar chart',
  fields:['Resource identifier','Branch / location','Category / status','Date / activity history']
};
export const initialSchedule: ScheduleDraft = {
  name:'',reportId:'REP-001',frequency:'Weekly',channel:'Email + in-app',audience:'Only me',time:'09:00'
};
