import {
  BarChart3,
  Database,
  Home,
  Plus,
  Settings,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  caption: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', caption: 'System overview', icon: Home },
  { href: '/tasks', label: 'My Tasks', caption: 'Orchestrate pipelines', icon: Zap },
  { href: '/tasks?create=1', label: 'Create Task', caption: 'Build automation', icon: Plus },
  { href: '/accounts', label: 'Accounts', caption: 'Connected platforms', icon: Users },
  { href: '/analytics', label: 'Analytics', caption: 'Performance insights', icon: BarChart3 },
  { href: '/executions', label: 'Executions', caption: 'Runtime history', icon: Database },
  { href: '/settings', label: 'Settings', caption: 'Workspace control', icon: Settings },
];
