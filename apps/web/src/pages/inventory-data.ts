export type InventoryTab = 'Stock overview' | 'Locations' | 'Movement history';

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  branch: string;
  location: string;
  onHand: number;
  minimum: number;
  unit: string;
  updated: string;
};

export type StorageLocation = {
  id: string;
  name: string;
  branch: string;
  tracked: number;
  alerts: number;
};

export type StockMovement = {
  id: string;
  date: string;
  action: string;
  item: string;
  performer: string;
  context: string;
  quantity: number;
  unit: string;
};

export const branches = ['Head Office', 'Tbilisi Store 01', 'Batumi Store 01', 'Kutaisi Store 01'];
export const categories = ['POS supplies', 'Store supplies', 'Electronics', 'Printing', 'Consumables', 'IT supplies'];
export const employees = ['Nino Kapanadze', 'Giorgi Maisuradze', 'Sandro Papiashvili', 'Mariam Beridze', 'Luka Dolidze'];

export const stockItems: InventoryItem[] = [
  { id: 'STK-00128', name: 'Thermal receipt paper', category: 'POS supplies', branch: 'Tbilisi Store 01', location: 'Backroom A', onHand: 8, minimum: 20, unit: 'rolls', updated: 'Nov 06, 2026' },
  { id: 'STK-00127', name: 'Barcode label rolls', category: 'Store supplies', branch: 'Head Office', location: 'Central Warehouse', onHand: 240, minimum: 60, unit: 'rolls', updated: 'Nov 05, 2026' },
  { id: 'STK-00126', name: 'AA batteries', category: 'Electronics', branch: 'Batumi Store 01', location: 'Stockroom', onHand: 12, minimum: 25, unit: 'pcs', updated: 'Nov 05, 2026' },
  { id: 'STK-00125', name: 'Printer toner HP 59A', category: 'Printing', branch: 'Kutaisi Store 01', location: 'Storage B', onHand: 3, minimum: 5, unit: 'pcs', updated: 'Nov 04, 2026' },
  { id: 'STK-00124', name: 'Cleaning wipes', category: 'Consumables', branch: 'Head Office', location: 'Central Warehouse', onHand: 116, minimum: 30, unit: 'packs', updated: 'Nov 04, 2026' },
  { id: 'STK-00123', name: 'HDMI cables', category: 'IT supplies', branch: 'Head Office', location: 'IT Cabinet', onHand: 32, minimum: 10, unit: 'pcs', updated: 'Nov 03, 2026' },
  { id: 'STK-00122', name: 'Shelf labels', category: 'Store supplies', branch: 'Tbilisi Store 01', location: 'Sales Floor', onHand: 6, minimum: 15, unit: 'packs', updated: 'Nov 03, 2026' }
];

export const storageLocations: StorageLocation[] = [
  { id: 'LOC-001', name: 'Central Warehouse', branch: 'Head Office', tracked: 142, alerts: 1 },
  { id: 'LOC-002', name: 'Backroom A', branch: 'Tbilisi Store 01', tracked: 68, alerts: 2 },
  { id: 'LOC-003', name: 'Stockroom', branch: 'Batumi Store 01', tracked: 54, alerts: 1 },
  { id: 'LOC-004', name: 'Storage B', branch: 'Kutaisi Store 01', tracked: 47, alerts: 1 },
  { id: 'LOC-005', name: 'IT Cabinet', branch: 'Head Office', tracked: 31, alerts: 0 },
  { id: 'LOC-006', name: 'Sales Floor', branch: 'Tbilisi Store 01', tracked: 22, alerts: 1 }
];

export const movements: StockMovement[] = [
  { id: 'MOV-001', date: 'Nov 06, 2026 · 10:42', action: 'Issued 5 rolls', item: 'Thermal receipt paper', performer: 'Nino Kapanadze', context: 'Tbilisi Store 01', quantity: -5, unit: 'rolls' },
  { id: 'MOV-002', date: 'Nov 05, 2026 · 16:20', action: 'Stock adjustment', item: 'AA batteries', performer: 'Mariam Beridze', context: 'Damaged packaging', quantity: -3, unit: 'pcs' },
  { id: 'MOV-003', date: 'Nov 05, 2026 · 14:10', action: 'Received stock', item: 'Barcode label rolls', performer: 'Head Office', context: 'Central Warehouse', quantity: 100, unit: 'rolls' },
  { id: 'MOV-004', date: 'Nov 04, 2026 · 09:30', action: 'Issued 2 units', item: 'Printer toner HP 59A', performer: 'Luka Dolidze', context: 'Kutaisi Store 01', quantity: -2, unit: 'pcs' }
];

export function isLowStock(item: InventoryItem): boolean {
  return item.onHand < item.minimum;
}
