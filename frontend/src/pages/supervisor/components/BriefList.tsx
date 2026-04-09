import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { FileText, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DailyBrief {
  id: string;
  date: string;
  generatedAt: string;
  content: {
    totalCalls: number;
    avgSentiment: number;
    negativePercent: number;
    deltaVsPrior: number;
    topIssues: string[];
    coachingOpportunities: string[];
    exemplarLinks: string[];
  };
}

export interface BriefListProps {
  briefs: DailyBrief[];
  onSelectBrief: (brief: DailyBrief) => void;
}

export function BriefList({ briefs, onSelectBrief }: BriefListProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Generated briefs</h2>
      {briefs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No briefs yet"
          description="Generate your first daily brief using the form above."
        />
      ) : (
        <div className="grid gap-4">
          {briefs.map((brief) => (
            <Card
              key={brief.id}
              className={cn(
                'p-4 sm:p-5 border-l-4 border-l-primary/60 shadow-sm',
                'hover:bg-muted/50 cursor-pointer transition-colors'
              )}
              onClick={() => onSelectBrief(brief)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectBrief(brief);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Open daily brief for ${brief.date}`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="p-3 bg-primary/10 rounded-lg shrink-0">
                    <FileText className="h-6 w-6 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold flex flex-wrap items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span>
                        {new Date(brief.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Generated {new Date(brief.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-end justify-start gap-4 sm:justify-end lg:shrink-0">
                  <div className="text-left sm:text-right min-w-[4.5rem]">
                    <p className="text-lg font-semibold tabular-nums">{brief.content.totalCalls}</p>
                    <p className="text-xs text-muted-foreground">calls</p>
                  </div>
                  <div className="text-left sm:text-right min-w-[5rem]">
                    <Badge
                      variant="secondary"
                      className={cn(
                        'text-base font-semibold px-3 py-1 tabular-nums',
                        brief.content.deltaVsPrior > 0
                          ? 'bg-success/15 text-success border border-success/30'
                          : 'bg-destructive/10 text-destructive border border-destructive/30'
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {brief.content.deltaVsPrior > 0 ? (
                          <TrendingUp className="h-4 w-4" aria-hidden />
                        ) : (
                          <TrendingDown className="h-4 w-4" aria-hidden />
                        )}
                        {brief.content.deltaVsPrior > 0 ? '+' : ''}
                        {brief.content.deltaVsPrior}
                      </span>
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">vs avg</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
