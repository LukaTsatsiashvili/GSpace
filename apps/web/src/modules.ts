import {
  ArrowLeftRight, BarChart3, Boxes, ClipboardCheck, ClipboardList,
  CreditCard, LayoutDashboard, PackageCheck, Settings2, ShieldCheck,
  Wrench, type LucideIcon
} from 'lucide-react';

export type ModuleGroup = 'WORKSPACE' | 'MANAGEMENT' | 'SYSTEM';

export interface AppModule {
  id: string;
  label: string;
  description: string;
  group: ModuleGroup;
  icon: LucideIcon;
}

export const modules: AppModule[] = [
  { id: 'overview', label: 'Overview', description: 'A unified view of resources, handovers and activity.', group: 'WORKSPACE', icon: LayoutDashboard },
  { id: 'resources', label: 'Resources', description: 'Manage the company resource catalog and its lifecycle.', group: 'WORKSPACE', icon: Boxes },
  { id: 'assignments', label: 'Assignments', description: 'Track handovers, confirmations and returns.', group: 'WORKSPACE', icon: ClipboardList },
  { id: 'approvals', label: 'Requests & Approvals', description: 'Review resource requests and approvals.', group: 'WORKSPACE', icon: ClipboardCheck },
  { id: 'transfers', label: 'Transfers', description: 'Manage resource movement between locations.', group: 'WORKSPACE', icon: ArrowLeftRight },
  { id: 'inventory', label: 'Inventory', description: 'Reconcile physical stock and recorded inventory.', group: 'WORKSPACE', icon: PackageCheck },
  { id: 'licenses', label: 'Licenses & Subscriptions', description: 'Track licenses, seats and renewals.', group: 'MANAGEMENT', icon: CreditCard },
  { id: 'maintenance', label: 'Maintenance', description: 'Monitor repairs, incidents and servicing.', group: 'MANAGEMENT', icon: Wrench },
  { id: 'finance', label: 'Finance & Costs', description: 'Analyze purchases, payments and operating costs.', group: 'MANAGEMENT', icon: BarChart3 },
  { id: 'reports', label: 'Reports & Analytics', description: 'Review business trends and resource performance.', group: 'MANAGEMENT', icon: BarChart3 },
  { id: 'audit', label: 'Audit & Diagnostics', description: 'Inspect security and operational activity.', group: 'SYSTEM', icon: ShieldCheck },
  { id: 'administration', label: 'Administration', description: 'Configure users, roles, branches and policies.', group: 'SYSTEM', icon: Settings2 }
];

export const moduleGroups: ModuleGroup[] = ['WORKSPACE', 'MANAGEMENT', 'SYSTEM'];

export function moduleFromHash(): AppModule {
  const id = window.location.hash.replace(/^#\/?/, '');
  return modules.find((module) => module.id === id) ?? modules[0];
}
