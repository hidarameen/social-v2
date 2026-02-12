'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Activity, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/components/layout/nav-items';

function SidebarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isActiveItem = (href: string) => {
    const [baseHref, query] = href.split('?');
    const pathMatch =
      baseHref === '/'
        ? pathname === baseHref
        : pathname === baseHref || pathname.startsWith(`${baseHref}/`);
    if (!pathMatch) return false;

    if (!query) {
      if (baseHref === '/tasks' && searchParams.get('create') === '1') return false;
      return true;
    }

    const expected = new URLSearchParams(query);
    for (const [key, value] of expected.entries()) {
      if (searchParams.get(key) !== value) return false;
    }
    return true;
  };

  return (
    <aside className="surface-card hidden h-screen w-72 flex-col border-r border-sidebar-border/80 lg:fixed lg:left-0 lg:top-0 lg:flex">
      <div className="border-b border-sidebar-border/80 px-6 py-6">
        <div className="kpi-pill mb-4 w-fit gap-2">
          <Sparkles size={14} />
          Control Center
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-sidebar-foreground">
          SocialFlow Orbit
        </h1>
        <p className="mt-1 text-sm text-sidebar-foreground/70">
          Next-gen multi-platform automation cockpit
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-2">
          {NAV_ITEMS.map((item, index) => {
            const Icon = item.icon;
            const isActive = isActiveItem(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex items-start gap-3 rounded-xl border px-4 py-3 transition-all duration-300 animate-fade-up',
                  isActive
                    ? 'border-sidebar-primary/40 bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20'
                    : 'border-transparent text-sidebar-foreground hover:border-sidebar-border hover:bg-sidebar-accent/70'
                )}
                style={{ animationDelay: `${index * 45}ms` }}
              >
                <div
                  className={cn(
                    'mt-0.5 rounded-lg p-2 transition-colors',
                    isActive
                      ? 'bg-sidebar-primary-foreground/12'
                      : 'bg-sidebar-accent/30 group-hover:bg-sidebar-accent'
                  )}
                >
                  <Icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.label}</p>
                  <p
                    className={cn(
                      'truncate text-xs',
                      isActive
                        ? 'text-sidebar-primary-foreground/85'
                        : 'text-sidebar-foreground/65'
                    )}
                  >
                    {item.caption}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-sidebar-border/80 p-4">
        <div className="rounded-xl border border-sidebar-border/70 bg-sidebar-accent/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sidebar-foreground">
            <Activity size={14} className="text-accent animate-pulse-glow rounded-full" />
            <span className="text-xs font-semibold uppercase tracking-wider">Live Status</span>
          </div>
          <p className="text-xs leading-relaxed text-sidebar-foreground/70">
            Runtime healthy. Last sync cycle completed and all services online.
          </p>
        </div>
      </div>
    </aside>
  );
}

export function Sidebar() {
  return (
    <Suspense fallback={<aside className="surface-card hidden h-screen w-72 border-r border-sidebar-border/80 lg:fixed lg:left-0 lg:top-0 lg:block" />}>
      <SidebarContent />
    </Suspense>
  );
}
