import {
  BarChart3,
  Database,
  Home,
  Plus,
  Send,
  Settings,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Locale } from '@/lib/i18n/types';

export interface NavItem {
  href: string;
  label: string;
  caption: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', caption: 'System overview', icon: Home },
  { href: '/tasks', label: 'My Tasks', caption: 'Orchestrate pipelines', icon: Zap },
  { href: '/tasks/new', label: 'Create Task', caption: 'Build automation', icon: Plus },
  { href: '/publish/manual', label: 'Manual Publish', caption: 'Compose and schedule posts', icon: Send },
  { href: '/accounts', label: 'Accounts', caption: 'Connected platforms', icon: Users },
  { href: '/analytics', label: 'Analytics', caption: 'Performance insights', icon: BarChart3 },
  { href: '/executions', label: 'Executions', caption: 'Runtime history', icon: Database },
  { href: '/settings', label: 'Settings', caption: 'Workspace control', icon: Settings },
];

const ARABIC_NAV_TRANSLATIONS: Record<string, { label: string; caption: string }> = {
  '/': { label: 'لوحة التحكم', caption: 'نظرة عامة على النظام' },
  '/tasks': { label: 'مهامي', caption: 'إدارة مسارات الأتمتة' },
  '/tasks/new': { label: 'إنشاء مهمة', caption: 'بناء أتمتة جديدة' },
  '/publish/manual': { label: 'نشر يدوي', caption: 'كتابة وجدولة المنشورات' },
  '/accounts': { label: 'الحسابات', caption: 'المنصات المتصلة' },
  '/analytics': { label: 'التحليلات', caption: 'مؤشرات الأداء' },
  '/executions': { label: 'التنفيذات', caption: 'سجل التشغيل' },
  '/settings': { label: 'الإعدادات', caption: 'التحكم في مساحة العمل' },
};

export function getNavItemContent(item: NavItem, locale: Locale) {
  if (locale !== 'ar') {
    return { label: item.label, caption: item.caption };
  }
  return ARABIC_NAV_TRANSLATIONS[item.href] || { label: item.label, caption: item.caption };
}
