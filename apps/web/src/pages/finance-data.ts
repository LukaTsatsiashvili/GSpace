export type FinanceTab = 'Overview' | 'Asset costs' | 'Invoices & payments' | 'Operating expenses' | 'Depreciation' | 'Cost analysis';
export type PaymentStatus = 'Paid' | 'Partially Paid' | 'Unpaid';
export type MoneyCurrency = 'GEL' | 'USD' | 'EUR';

export interface FinancialAsset {
  id: string;
  resourceId: string;
  name: string;
  supplier: string;
  branch: string;
  category: string;
  value: number;
  paid: number;
  currency: MoneyCurrency;
  purchaseDate: string;
  invoice: string;
  usefulLife: number | null;
  depreciation: number;
  documents: string[];
}
export interface OperatingExpense {
  id: string;
  name: string;
  type: 'Maintenance' | 'Subscription' | 'Other';
  provider: string;
  branch: string;
  date: string;
  amount: number;
  currency: MoneyCurrency;
  status: PaymentStatus;
  resource: string;
  documents: string[];
}
export const financeTabs: FinanceTab[] = ['Overview', 'Asset costs', 'Invoices & payments', 'Operating expenses', 'Depreciation', 'Cost analysis'];
export const branches = ['Head Office', 'Tbilisi Store 01', 'Batumi Store 01', 'Kutaisi Store 01'];
export const paymentStatuses: PaymentStatus[] = ['Paid', 'Partially Paid', 'Unpaid'];
export const currencies: MoneyCurrency[] = ['GEL', 'USD', 'EUR'];
export const expenseTypes = ['Maintenance', 'Subscription', 'Other'] as const;

export const assets: FinancialAsset[] = [
  {id:'FIN-0251',resourceId:'RES-00241',name:'Dell UltraSharp U2723QE',supplier:'Alta Business',branch:'Head Office',category:'Hardware',value:1350,paid:1350,currency:'GEL',purchaseDate:'Sep 14, 2026',invoice:'INV-2026-0914',usefulLife:48,depreciation:56,documents:['Invoice-0914.pdf','Warranty.pdf']},
  {id:'FIN-0250',resourceId:'RES-00187',name:'Samsung Galaxy Tab S9',supplier:'Zoommer Business',branch:'Tbilisi Store 01',category:'Mobile devices',value:2199,paid:900,currency:'GEL',purchaseDate:'Oct 08, 2026',invoice:'INV-2026-0892',usefulLife:36,depreciation:59,documents:['Invoice-0892.pdf']},
  {id:'FIN-0249',resourceId:'RES-00311',name:'Lenovo ThinkPad T14',supplier:'IT Distribution',branch:'Batumi Store 01',category:'Hardware',value:3740,paid:0,currency:'GEL',purchaseDate:'Aug 20, 2026',invoice:'INV-2026-0871',usefulLife:48,depreciation:220,documents:['Invoice-0871.pdf','Guarantee.pdf']},
  {id:'FIN-0248',resourceId:'RES-00109',name:'HP LaserJet Pro M404',supplier:'Office Solutions',branch:'Head Office',category:'Peripherals',value:860,paid:860,currency:'GEL',purchaseDate:'Jul 11, 2026',invoice:'INV-2026-0816',usefulLife:48,depreciation:72,documents:['Invoice-0816.pdf']},
  {id:'FIN-0247',resourceId:'RES-00408',name:'Zebra TC21 Scanner',supplier:'Retail Tech',branch:'Kutaisi Store 01',category:'Mobile devices',value:1530,paid:1530,currency:'GEL',purchaseDate:'May 09, 2026',invoice:'INV-2026-0764',usefulLife:36,depreciation:213,documents:['Invoice-0764.pdf']},
  {id:'FIN-0246',resourceId:'LIC-00218',name:'Microsoft 365 Business',supplier:'Microsoft',branch:'Head Office',category:'Software',value:6240,paid:6240,currency:'USD',purchaseDate:'Nov 01, 2026',invoice:'MS-2026-0418',usefulLife:null,depreciation:0,documents:['Subscription contract.pdf']}
];

export const expenses: OperatingExpense[] = [
  {id:'EXP-0048',name:'Monitor repair · Dell U2723QE',type:'Maintenance',provider:'TechCare Service',branch:'Head Office',date:'Nov 05, 2026',amount:180,currency:'GEL',status:'Unpaid',resource:'Dell UltraSharp U2723QE',documents:['Service receipt.pdf']},
  {id:'EXP-0047',name:'Microsoft 365 Business Premium',type:'Subscription',provider:'Microsoft',branch:'Head Office',date:'Nov 01, 2026',amount:520,currency:'USD',status:'Paid',resource:'Microsoft 365 Business',documents:['Invoice.pdf']},
  {id:'EXP-0046',name:'Printer service · Epson TM-T88VI',type:'Maintenance',provider:'PrintFix',branch:'Tbilisi Store 01',date:'Oct 21, 2026',amount:75,currency:'GEL',status:'Paid',resource:'Epson TM-T88VI',documents:['Service invoice.pdf']},
  {id:'EXP-0045',name:'Replacement power adapter',type:'Maintenance',provider:'IT Support',branch:'Batumi Store 01',date:'Nov 03, 2026',amount:95,currency:'GEL',status:'Partially Paid',resource:'Lenovo ThinkPad T14',documents:[]}
];

export const branchCosts = [
  {name:'Head Office',amount:424320,percent:68},
  {name:'Tbilisi Store 01',amount:324480,percent:52},
  {name:'Batumi Store 01',amount:243360,percent:39},
  {name:'Kutaisi Store 01',amount:162240,percent:26}
];
export const expenseComposition = [
  {label:'Hardware',share:53,color:'#7da2fa'},
  {label:'Software / subscriptions',share:25,color:'#62b39a'},
  {label:'Maintenance',share:15,color:'#e4a64d'},
  {label:'Other',share:7,color:'#ae91d9'}
];
export const monthlyCosts = [
  {month:'Jun',thousands:48},{month:'Jul',thousands:68},{month:'Aug',thousands:85},
  {month:'Sep',thousands:58},{month:'Oct',thousands:92},{month:'Nov',thousands:72}
];
export const topCategories = [
  {name:'Hardware',percent:84},{name:'Software',percent:65},
  {name:'Mobile devices',percent:43},{name:'Maintenance',percent:18}
];

export function money(value: number, currency: MoneyCurrency): string {
  return (currency === 'GEL' ? '₾' : currency === 'USD' ? '$' : '€') + value.toLocaleString('en-US', {maximumFractionDigits:2});
}
export function paymentStatus(record: FinancialAsset): PaymentStatus {
  if (record.paid <= 0) return 'Unpaid';
  return record.paid >= record.value ? 'Paid' : 'Partially Paid';
}
export function remaining(record: FinancialAsset): number { return Math.max(0, record.value - record.paid); }
export function bookValue(record: FinancialAsset): number { return Math.max(0, record.value - record.depreciation); }
