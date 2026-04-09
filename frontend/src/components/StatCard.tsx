import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    /** Use `points` for sentiment deltas on -1..1 scale; default is percentage */
    format?: 'percent' | 'points';
  };
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  /** Visually emphasize key metrics (e.g. sentiment, open alerts) */
  emphasis?: boolean;
}

const variantTextStyles = {
  default: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
} as const;

const variantIconBgStyles = {
  default: 'bg-primary/10',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  destructive: 'bg-destructive/10',
} as const;

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  emphasis = false,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        'p-6 shadow-sm transition-shadow hover:shadow-md',
        emphasis && 'border-primary/20 bg-gradient-to-br from-card to-muted/40'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p
            className={cn(
              emphasis ? 'text-4xl' : 'text-3xl',
              'font-bold tracking-tight',
              variantTextStyles[variant]
            )}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  'font-medium',
                  trend.value > 0
                    ? 'text-success'
                    : trend.value < 0
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                )}
              >
                {trend.value > 0 ? '+' : ''}
                {trend.format === 'points'
                  ? trend.value.toFixed(2)
                  : Math.round(trend.value * 10) / 10}
                {trend.format === 'points' ? ' pts' : '%'}
              </span>
              <span className="text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn('p-3 rounded-lg', variantIconBgStyles[variant])}>
          <Icon className={cn('h-6 w-6', variantTextStyles[variant])} />
        </div>
      </div>
    </Card>
  );
}
