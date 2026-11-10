export type MaintenanceTab = 'All incidents' | 'My work' | 'Preventive schedules' | 'Repair expenses';
export type IncidentStatus = 'Open' | 'In progress' | 'Pending approval' | 'Resolved' | 'Under review' | 'Closed';
export type IncidentPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type IssueType = 'Malfunction' | 'Damage' | 'Missing component' | 'Lost' | 'Other';
export type ServiceChannel = 'Internal team' | 'External provider';

export interface Incident {
  id: string;
  resourceId: string;
  resource: string;
  issue: IssueType;
  branch: string;
  priority: IncidentPriority;
  reported: string;
  reporter: string;
  assignedTo: string;
  status: IncidentStatus;
  description: string;
  condition: string;
  provider: string;
  cost: number;
  currency: 'GEL' | 'USD' | 'EUR';
  evidence: string[];
  workflowStep: 1 | 2 | 3;
}

export interface PreventiveSchedule {
  id: string;
  task: string;
  assetGroup: string;
  frequency: string;
  owner: string;
  nextService: string;
  status: 'Due soon' | 'Scheduled';
}

export interface RepairExpense {
  incidentId: string;
  resource: string;
  issue: string;
  provider: string;
  amount: number;
  currency: 'GEL' | 'USD' | 'EUR';
  reported: string;
}

export const maintenanceTabs: MaintenanceTab[] = ['All incidents', 'My work', 'Preventive schedules', 'Repair expenses'];
export const priorityOptions: IncidentPriority[] = ['Low', 'Medium', 'High', 'Critical'];
export const statusOptions: IncidentStatus[] = ['Open', 'In progress', 'Pending approval', 'Resolved', 'Under review', 'Closed'];
export const issueTypes: IssueType[] = ['Malfunction', 'Damage', 'Missing component', 'Lost', 'Other'];
export const responsibleTeams = ['IT Support', 'Branch Manager', 'Operations', 'Facilities', 'TechCare Service'];
export const repeatFrequencies = ['Every month', 'Every 3 months', 'Every 6 months', 'Every year', 'Custom'];
export const currencies = ['GEL', 'USD', 'EUR'];

export const incidents: Incident[] = [
  {
    id:'INC-1048',resourceId:'RES-00241',resource:'Dell UltraSharp U2723QE',issue:'Malfunction',
    branch:'Head Office',priority:'High',reported:'Nov 05, 2026',reporter:'Nino Kapanadze',
    assignedTo:'TechCare Service',status:'In progress',description:'Screen flickers intermittently and loses its connection during use.',
    condition:'In maintenance',provider:'TechCare Service',cost:180,currency:'GEL',
    evidence:['Monitor-photo.jpg'],workflowStep:2
  },
  {
    id:'INC-1047',resourceId:'RES-00187',resource:'Samsung Galaxy Tab S9',issue:'Damage',
    branch:'Tbilisi Store 01',priority:'Critical',reported:'Nov 04, 2026',reporter:'Mariam Beridze',
    assignedTo:'Unassigned',status:'Open',description:'Tablet display is cracked after accidental impact at the store.',
    condition:'Needs attention',provider:'—',cost:0,currency:'GEL',
    evidence:['Damage-photo.jpg'],workflowStep:1
  },
  {
    id:'INC-1046',resourceId:'RES-00311',resource:'Lenovo ThinkPad T14',issue:'Missing component',
    branch:'Batumi Store 01',priority:'Medium',reported:'Nov 03, 2026',reporter:'Giorgi Maisuradze',
    assignedTo:'IT Support',status:'Pending approval',description:'Original power adapter is missing; replacement requested.',
    condition:'Needs attention',provider:'Internal IT',cost:95,currency:'GEL',
    evidence:[],workflowStep:2
  },
  {
    id:'INC-1045',resourceId:'RES-00109',resource:'HP LaserJet Pro M404',issue:'Malfunction',
    branch:'Head Office',priority:'Low',reported:'Oct 29, 2026',reporter:'Sandro Papiashvili',
    assignedTo:'IT Support',status:'Resolved',description:'Paper feed roller replaced and printer tested successfully.',
    condition:'Good',provider:'Internal IT',cost:45,currency:'GEL',
    evidence:['Service-report.pdf'],workflowStep:3
  },
  {
    id:'INC-1044',resourceId:'RES-00408',resource:'Zebra TC21 Scanner',issue:'Lost',
    branch:'Kutaisi Store 01',priority:'Critical',reported:'Oct 27, 2026',reporter:'Luka Dolidze',
    assignedTo:'Branch Manager',status:'Under review',description:'Handheld scanner not found following stock count.',
    condition:'Missing',provider:'Branch Manager',cost:0,currency:'GEL',
    evidence:[],workflowStep:2
  },
  {
    id:'INC-1043',resourceId:'RES-00229',resource:'Epson TM-T88VI',issue:'Other',
    branch:'Head Office',priority:'Low',reported:'Oct 21, 2026',reporter:'Nino Kapanadze',
    assignedTo:'External service',status:'Resolved',description:'Receipt printer received routine component cleaning and calibration.',
    condition:'Good',provider:'PrintFix',cost:75,currency:'GEL',
    evidence:['Invoice-1043.pdf'],workflowStep:3
  },
  {
    id:'INC-1042',resourceId:'RES-00232',resource:'Dell Latitude 5440',issue:'Malfunction',
    branch:'Tbilisi Store 01',priority:'Medium',reported:'Oct 18, 2026',reporter:'Giorgi Maisuradze',
    assignedTo:'IT Support',status:'In progress',description:'Battery unexpectedly powers down while charging.',
    condition:'In maintenance',provider:'Internal IT',cost:110,currency:'GEL',
    evidence:[],workflowStep:2
  },
  {
    id:'INC-1041',resourceId:'RES-00420',resource:'Cisco Switch 24-Port',issue:'Damage',
    branch:'Head Office',priority:'High',reported:'Oct 11, 2026',reporter:'Sandro Papiashvili',
    assignedTo:'TechCare Service',status:'Closed',description:'Damaged ports replaced and connectivity restored.',
    condition:'Good',provider:'TechCare Service',cost:220,currency:'GEL',
    evidence:['Replacement-report.pdf'],workflowStep:3
  }
];

export const schedules: PreventiveSchedule[] = [
  {id:'PM-001',task:'Quarterly device inspection',assetGroup:'POS terminals · Tbilisi Store 01',frequency:'Every 3 months',owner:'IT Support',nextService:'Nov 12, 2026',status:'Due soon'},
  {id:'PM-002',task:'Cooling and hardware check',assetGroup:'Dell workstation fleet',frequency:'Every 6 months',owner:'IT Support',nextService:'Nov 23, 2026',status:'Scheduled'},
  {id:'PM-003',task:'Print head cleaning',assetGroup:'Store printers · Batumi',frequency:'Every month',owner:'Branch Manager',nextService:'Nov 08, 2026',status:'Due soon'}
];

export const repairExpenses: RepairExpense[] = [
  {incidentId:'INC-1048',resource:'Dell UltraSharp U2723QE',issue:'Malfunction',provider:'TechCare Service',amount:180,currency:'GEL',reported:'Nov 05, 2026'},
  {incidentId:'INC-1046',resource:'Lenovo ThinkPad T14',issue:'Missing component',provider:'Internal IT',amount:95,currency:'GEL',reported:'Nov 03, 2026'},
  {incidentId:'INC-1045',resource:'HP LaserJet Pro M404',issue:'Malfunction',provider:'Internal IT',amount:45,currency:'GEL',reported:'Oct 29, 2026'},
  {incidentId:'INC-1043',resource:'Epson TM-T88VI',issue:'Other',provider:'PrintFix',amount:75,currency:'GEL',reported:'Oct 21, 2026'}
];

export function formatCost(value: number, currency: string = 'GEL') {
  return currency === 'GEL' ? value.toLocaleString('en-US') + ' GEL' : (currency === 'USD' ? '$' : '€') + value.toLocaleString('en-US');
}
