export type TransferStatus = 'Awaiting receipt' | 'Partially received' | 'In transit' | 'Completed' | 'Pending approval';
export type TransferTab = 'All transfers' | 'Awaiting me' | 'In progress' | 'History';
export type TransferRoute = 'Manager approval' | 'Direct dispatch';

export type TransferResource = {
  id: string;
  name: string;
  origin: string;
  state: 'Awaiting receipt' | 'Received';
};

export type Transfer = {
  id: string;
  source: string;
  destination: string;
  sender: string;
  recipient: string;
  route: TransferRoute;
  created: string;
  status: TransferStatus;
  items: TransferResource[];
  activity: { title: string; date: string }[];
};

export const destinations = ['Head Office', 'Tbilisi Store 01', 'Kutaisi Store 01', 'Batumi Store 01', 'Central Warehouse'];
export const people = ['Nino Kapanadze', 'Giorgi Maisuradze', 'Sandro Papiashvili', 'Mariam Beridze', 'Luka Dolidze'];
export const routes: TransferRoute[] = ['Manager approval', 'Direct dispatch'];
export const statuses: TransferStatus[] = ['Awaiting receipt', 'Partially received', 'In transit', 'Completed', 'Pending approval'];

export const sampleTransfers: Transfer[] = [
  {
    id: 'TRF-00291', source: 'Head Office', destination: 'Tbilisi Store 01',
    sender: 'Sandro Papiashvili', recipient: 'Nino Kapanadze',
    route: 'Manager approval', created: 'Nov 06, 2026', status: 'Awaiting receipt',
    items: [
      { id: 'AST-00123', name: 'Dell UltraSharp U2723QE', origin: 'Head Office', state: 'Awaiting receipt' },
      { id: 'AST-00119', name: 'Samsung Galaxy Tab S9', origin: 'Head Office', state: 'Awaiting receipt' }
    ],
    activity: [
      { title: 'Approved by Regional Manager', date: 'Nov 06, 2026' },
      { title: 'Transfer created', date: 'Nov 06, 2026 · Movement audit recorded' }
    ]
  },
  {
    id: 'TRF-00290', source: 'Batumi Store 01', destination: 'Kutaisi Store 01',
    sender: 'Mariam Beridze', recipient: 'Luka Dolidze',
    route: 'Manager approval', created: 'Nov 04, 2026', status: 'Partially received',
    items: [
      { id: 'AST-00115', name: 'Barcode Scanner', origin: 'Batumi Store 01', state: 'Received' },
      { id: 'AST-00130', name: 'Logitech MX Keys', origin: 'Batumi Store 01', state: 'Awaiting receipt' },
      { id: 'AST-00131', name: 'Dell Docking Station', origin: 'Batumi Store 01', state: 'Awaiting receipt' }
    ],
    activity: [
      { title: 'Some items confirmed by recipient', date: 'Nov 05, 2026' },
      { title: 'Transfer created', date: 'Nov 04, 2026 · Movement audit recorded' }
    ]
  },
  {
    id: 'TRF-00289', source: 'Central Warehouse', destination: 'Batumi Store 01',
    sender: 'Sandro Papiashvili', recipient: 'Mariam Beridze',
    route: 'Direct dispatch', created: 'Nov 03, 2026', status: 'In transit',
    items: [{ id: 'AST-00109', name: 'HP EliteBook 840', origin: 'Central Warehouse', state: 'Awaiting receipt' }],
    activity: [
      { title: 'Dispatched by warehouse', date: 'Nov 04, 2026' },
      { title: 'Transfer created', date: 'Nov 03, 2026 · Movement audit recorded' }
    ]
  },
  {
    id: 'TRF-00288', source: 'Tbilisi Store 01', destination: 'Head Office',
    sender: 'Nino Kapanadze', recipient: 'Sandro Papiashvili',
    route: 'Manager approval', created: 'Oct 29, 2026', status: 'Completed',
    items: [{ id: 'AST-00122', name: 'Apple iPhone 15', origin: 'Tbilisi Store 01', state: 'Received' }],
    activity: [
      { title: 'Receipt confirmed', date: 'Oct 30, 2026' },
      { title: 'Transfer created', date: 'Oct 29, 2026 · Movement audit recorded' }
    ]
  },
  {
    id: 'TRF-00287', source: 'Head Office', destination: 'Kutaisi Store 01',
    sender: 'Giorgi Maisuradze', recipient: 'Luka Dolidze',
    route: 'Manager approval', created: 'Nov 06, 2026', status: 'Pending approval',
    items: [{ id: 'AST-00124', name: 'Lenovo ThinkPad T14', origin: 'Head Office', state: 'Awaiting receipt' }],
    activity: [
      { title: 'Manager approval requested', date: 'Nov 06, 2026' },
      { title: 'Transfer created', date: 'Nov 06, 2026 · Movement audit recorded' }
    ]
  }
];

export const availableAssets = [
  { id: 'AST-00123', name: 'Dell UltraSharp U2723QE', location: 'Head Office' },
  { id: 'AST-00119', name: 'Samsung Galaxy Tab S9', location: 'Head Office' },
  { id: 'AST-00118', name: 'Cisco Catalyst 9200', location: 'Head Office' },
  { id: 'AST-00116', name: 'Logitech MX Keys', location: 'Head Office' },
  { id: 'AST-00115', name: 'Barcode Scanner', location: 'Head Office' },
  { id: 'AST-00122', name: 'Apple iPhone 15', location: 'Tbilisi Store 01' },
  { id: 'AST-00132', name: 'HP LaserJet Pro', location: 'Tbilisi Store 01' },
  { id: 'AST-00108', name: 'POS Tablet', location: 'Kutaisi Store 01' },
  { id: 'AST-00133', name: 'Dell Latitude 5440', location: 'Kutaisi Store 01' },
  { id: 'AST-00134', name: 'Zebra Barcode Scanner', location: 'Batumi Store 01' },
  { id: 'AST-00135', name: 'Logitech MX Master 3S', location: 'Batumi Store 01' },
  { id: 'AST-00109', name: 'HP EliteBook 840', location: 'Central Warehouse' },
  { id: 'AST-00136', name: 'Cisco Meraki MX67', location: 'Central Warehouse' }
];
