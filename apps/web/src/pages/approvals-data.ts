export type ApprovalStatus = 'Pending approval' | 'In review' | 'Changes requested' | 'Approved' | 'Rejected';
export type ApprovalPattern = 'Sequential' | 'Parallel';
export type ApprovalTab = 'My approvals' | 'All requests' | 'Request types';

export type RequestType = {
  code: string;
  name: string;
  description: string;
  version: number;
  count: number;
  pattern: ApprovalPattern;
  active: boolean;
  route: string;
  formFields: string[];
  deadline: string;
  deadlineBehavior: string;
};

export type ApprovalRequest = {
  id: string;
  title: string;
  requester: string;
  branch: string;
  type: string;
  amount?: number;
  submitted: string;
  due: string;
  step: number;
  totalSteps: number;
  pattern: ApprovalPattern;
  status: ApprovalStatus;
  reason: string;
  activity: { title: string; detail: string }[];
  isMyApproval: boolean;
};

export const approvalTypes: RequestType[] = [
  {
    code: 'PURCHASE', name: 'Purchase request', description: 'Equipment and other company asset purchases',
    version: 3, count: 128, pattern: 'Sequential', active: true, route: 'Line Manager → Finance Manager',
    formFields: ['Item', 'Quantity', 'Estimated cost', 'Justification'],
    deadline: '3 business days', deadlineBehavior: 'Reminder then escalate'
  },
  {
    code: 'ALLOCATION', name: 'Resource allocation', description: 'Requests to allocate available resources to an employee',
    version: 2, count: 86, pattern: 'Sequential', active: true, route: 'Line Manager → Resource Manager',
    formFields: ['Resource', 'Employee', 'Required date'],
    deadline: '2 business days', deadlineBehavior: 'Reminder then escalate'
  },
  {
    code: 'SOFTWARE', name: 'Software access', description: 'Licenses, software subscriptions and access requests',
    version: 4, count: 54, pattern: 'Parallel', active: true, route: 'IT Manager + Department Manager',
    formFields: ['Software', 'License plan', 'User', 'Duration'],
    deadline: '3 business days', deadlineBehavior: 'Reminder then escalate'
  },
  {
    code: 'EXPENSE', name: 'Expense approval', description: 'Operational expenses and maintenance budgets',
    version: 2, count: 42, pattern: 'Sequential', active: true, route: 'Line Manager → Finance Manager',
    formFields: ['Expense category', 'Estimated amount', 'Business reason'],
    deadline: '3 business days', deadlineBehavior: 'Reminder then escalate'
  },
  {
    code: 'TRAVEL', name: 'Travel equipment', description: 'Short-term equipment use outside the office',
    version: 1, count: 13, pattern: 'Sequential', active: false, route: 'Line Manager → Resource Manager',
    formFields: ['Destination', 'Equipment', 'Departure date', 'Return date'],
    deadline: '5 business days', deadlineBehavior: 'Notify requester only'
  }
];

export const approvalRequests: ApprovalRequest[] = [
  {
    id: 'REQ-00482', title: 'New laptop purchase', requester: 'Nino Kapanadze',
    branch: 'Tbilisi Store 01', type: 'Purchase request', amount: 4250,
    submitted: 'Nov 05, 2026', due: 'Nov 08, 2026', step: 2, totalSteps: 2,
    pattern: 'Sequential', status: 'Pending approval', isMyApproval: true,
    reason: 'A replacement laptop is required for the store operations team.',
    activity: [{ title: 'Waiting for final approval', detail: 'Step 2 of 2 · Finance Manager' },
      { title: 'Submitted for review', detail: 'Nov 05, 2026 · Initial workflow snapshot' }]
  },
  {
    id: 'REQ-00481', title: 'Software license renewal', requester: 'Giorgi Maisuradze',
    branch: 'Head Office', type: 'Software access', amount: 1980,
    submitted: 'Nov 04, 2026', due: 'Nov 07, 2026', step: 1, totalSteps: 2,
    pattern: 'Parallel', status: 'In review', isMyApproval: true,
    reason: 'Renew software access to avoid interruption to daily operations.',
    activity: [{ title: 'Parallel review started', detail: 'Nov 04, 2026 · IT and department managers' },
      { title: 'Request submitted', detail: 'Nov 04, 2026' }]
  },
  {
    id: 'REQ-00480', title: 'Monitor allocation for new hire', requester: 'Mariam Beridze',
    branch: 'Batumi Store 01', type: 'Resource allocation',
    submitted: 'Nov 03, 2026', due: 'Nov 10, 2026', step: 1, totalSteps: 2,
    pattern: 'Sequential', status: 'Changes requested', isMyApproval: false,
    reason: 'A new team member needs a monitor to complete workstation setup.',
    activity: [{ title: 'Changes requested', detail: 'Nov 05, 2026 · Additional information required' },
      { title: 'Request submitted', detail: 'Nov 03, 2026' }]
  },
  {
    id: 'REQ-00479', title: 'Emergency maintenance budget', requester: 'Luka Dolidze',
    branch: 'Kutaisi Store 01', type: 'Expense approval', amount: 620,
    submitted: 'Nov 02, 2026', due: 'Nov 06, 2026', step: 2, totalSteps: 2,
    pattern: 'Sequential', status: 'Approved', isMyApproval: false,
    reason: 'Approval needed for urgent maintenance work.',
    activity: [{ title: 'Approved', detail: 'Nov 04, 2026 · All required approvals recorded' },
      { title: 'Request submitted', detail: 'Nov 02, 2026' }]
  },
  {
    id: 'REQ-00478', title: 'Additional warehouse scanner', requester: 'Sandro Papiashvili',
    branch: 'Head Office', type: 'Purchase request', amount: 1150,
    submitted: 'Oct 31, 2026', due: 'Nov 04, 2026', step: 1, totalSteps: 2,
    pattern: 'Sequential', status: 'Rejected', isMyApproval: false,
    reason: 'Request for additional equipment for warehouse operations.',
    activity: [{ title: 'Request rejected', detail: 'Nov 03, 2026 · Decision retained for audit' },
      { title: 'Request submitted', detail: 'Oct 31, 2026' }]
  }
];

export const branches = ['Head Office', 'Tbilisi Store 01', 'Batumi Store 01', 'Kutaisi Store 01'];
export const statuses: ApprovalStatus[] = ['Pending approval', 'In review', 'Changes requested', 'Approved', 'Rejected'];
export const deadlines = ['1 business day', '2 business days', '3 business days', '5 business days', '7 business days'];
export const deadlineBehaviors = ['Reminder then escalate', 'Notify requester only', 'Escalate to administrator'];

export function currency(amount?: number) {
  return typeof amount === 'number' && Number.isFinite(amount) ? '₾ ' + amount.toLocaleString('en-US') : '—';
}
