import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center',
        className
      )}
    >
      <Icon className="h-12 w-12 text-muted-foreground mb-4" aria-hidden />
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      {description ? (
        <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>
      ) : null}
      {action}
    </div>
  );
}
