'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  color?: 'primary' | 'accent' | 'secondary';
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  color = 'primary',
}: StatCardProps) {
  const colorClasses = {
    primary: 'bg-primary/15 text-primary',
    accent: 'bg-accent/15 text-accent',
    secondary: 'bg-secondary/20 text-secondary',
  };

  return (
    <Card className="animate-fade-up">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-semibold tracking-tight">{value}</p>
            {trend && (
              <p
                className={cn(
                  'mt-2 inline-flex items-center gap-1 text-xs font-semibold',
                  trend.direction === 'up'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                )}
              >
                {trend.direction === 'up' ? (
                  <ArrowUpRight size={12} />
                ) : (
                  <ArrowDownRight size={12} />
                )}
                {Math.abs(trend.value)}%
              </p>
            )}
          </div>
          <div className={cn('animate-float-soft rounded-xl p-3', colorClasses[color])}>
            <Icon size={22} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
