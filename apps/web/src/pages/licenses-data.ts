export type LicenseStatus = 'Active' | 'Renewal soon' | 'Expired';
export type LicenseModel = 'Individual' | 'Multi-user' | 'Device-bound';
export type LicenseTab = 'All licenses' | 'Renewals' | 'Seat allocations' | 'Expenses';

export interface LicenseRecord {
  id: string;
  name: string;
  vendor: string;
  edition: string;
  model: LicenseModel;
  assigned: number;
  total: number;
  amount: number;
  currency: 'USD' | 'EUR' | 'GEL';
  billing: 'Monthly' | 'Quarterly' | 'Yearly' | 'Custom';
  start: string;
  renewal: string | null;
  autoRenew: boolean;
  owner: string;
  branch: string;
  status: LicenseStatus;
  users: string[];
  documents: string[];
}

export const employees = ['Sandro Papiashvili', 'Giorgi Maisuradze', 'Nino Kapanadze', 'Mariam Beridze', 'Luka Tsatsiashvili'];
export const licenseBranches = ['Head Office', 'Tbilisi Store 01', 'Batumi Store 01'];
export const licenseTabs: LicenseTab[] = ['All licenses', 'Renewals', 'Seat allocations', 'Expenses'];

export const licenses: LicenseRecord[] = [
  {
    id: 'LIC-00218', name: 'Microsoft 365 Business', vendor: 'Microsoft', edition: 'Business Premium',
    model: 'Multi-user', assigned: 36, total: 42, amount: 6240, currency: 'USD', billing: 'Yearly',
    start: 'Dec 15, 2025', renewal: 'Dec 15, 2026', autoRenew: true, owner: 'Sandro Papiashvili',
    branch: 'Head Office', status: 'Active', users: ['Nino Kapanadze', 'Giorgi Maisuradze', 'Mariam Beridze'],
    documents: ['Subscription contract.pdf', 'Invoice-2026.pdf']
  },
  {
    id: 'LIC-00217', name: 'Adobe Creative Cloud', vendor: 'Adobe', edition: 'Teams',
    model: 'Multi-user', assigned: 11, total: 12, amount: 899, currency: 'USD', billing: 'Monthly',
    start: 'Nov 19, 2025', renewal: 'Nov 19, 2026', autoRenew: false, owner: 'Giorgi Maisuradze',
    branch: 'Head Office', status: 'Renewal soon', users: ['Giorgi Maisuradze'], documents: ['Invoice-Adobe.pdf']
  },
  {
    id: 'LIC-00216', name: 'JetBrains All Products', vendor: 'JetBrains', edition: 'Commercial',
    model: 'Individual', assigned: 1, total: 1, amount: 649, currency: 'EUR', billing: 'Yearly',
    start: 'Jan 12, 2026', renewal: 'Jan 12, 2027', autoRenew: true, owner: 'Sandro Papiashvili',
    branch: 'Head Office', status: 'Active', users: ['Sandro Papiashvili'], documents: ['Receipt.pdf']
  },
  {
    id: 'LIC-00215', name: 'Windows Server CAL', vendor: 'Microsoft', edition: 'Device license',
    model: 'Device-bound', assigned: 8, total: 8, amount: 1750, currency: 'USD', billing: 'Custom',
    start: 'Mar 03, 2026', renewal: null, autoRenew: false, owner: 'Sandro Papiashvili',
    branch: 'Head Office', status: 'Active', users: ['Workstation WS-01', 'Workstation WS-02'], documents: ['CAL agreement.pdf']
  },
  {
    id: 'LIC-00214', name: 'Figma Professional', vendor: 'Figma', edition: 'Professional',
    model: 'Multi-user', assigned: 5, total: 8, amount: 420, currency: 'USD', billing: 'Quarterly',
    start: 'Aug 11, 2026', renewal: 'Nov 11, 2026', autoRenew: true, owner: 'Nino Kapanadze',
    branch: 'Tbilisi Store 01', status: 'Renewal soon', users: ['Nino Kapanadze', 'Mariam Beridze'],
    documents: ['Invoice-Q3.pdf']
  },
  {
    id: 'LIC-00213', name: 'Autodesk AutoCAD', vendor: 'Autodesk', edition: 'Commercial',
    model: 'Individual', assigned: 0, total: 1, amount: 1730, currency: 'USD', billing: 'Yearly',
    start: 'Oct 31, 2025', renewal: 'Oct 31, 2026', autoRenew: false, owner: 'Mariam Beridze',
    branch: 'Batumi Store 01', status: 'Expired', users: [], documents: ['Agreement.pdf']
  }
];

export const expenses = [
  { date: 'Nov 01, 2026', subscription: 'Adobe Creative Cloud', billing: 'Monthly', amount: 899, currency: 'USD', evidence: 'Invoice' },
  { date: 'Oct 15, 2026', subscription: 'Microsoft 365 Business', billing: 'Yearly', amount: 6240, currency: 'USD', evidence: 'Contract + invoice' },
  { date: 'Oct 11, 2026', subscription: 'Figma Professional', billing: 'Quarterly', amount: 420, currency: 'USD', evidence: 'Invoice' },
  { date: 'Oct 01, 2026', subscription: 'JetBrains All Products', billing: 'Yearly', amount: 649, currency: 'EUR', evidence: 'Receipt' }
];

export function currencyText(amount: number, currency: string) {
  return (currency === 'EUR' ? '€' : currency === 'GEL' ? '₾' : '$') + amount.toLocaleString('en-US');
}
export function initials(name: string) {
  return name.split(' ').map(x => x[0] || '').slice(0, 2).join('').toUpperCase();
}