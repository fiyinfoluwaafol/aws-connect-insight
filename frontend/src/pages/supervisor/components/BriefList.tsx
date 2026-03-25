import { Card } from '@/components/ui/card';
import { FileText, Calendar, TrendingUp, TrendingDown } from 'lucide-react';

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
      <h2 className="text-lg font-semibold">Generated Briefs</h2>
      {briefs.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Briefs Yet</h3>
          <p className="text-muted-foreground">
            Generate your first daily brief using the form above.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {briefs.map((brief) => (
            <Card
              key={brief.id}
              className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => onSelectBrief(brief)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(brief.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Generated {new Date(brief.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-lg font-semibold">{brief.content.totalCalls}</p>
                    <p className="text-xs text-muted-foreground">calls</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-semibold flex items-center gap-1 ${
                        brief.content.deltaVsPrior > 0 ? 'text-success' : 'text-destructive'
                      }`}
                    >
                      {brief.content.deltaVsPrior > 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {brief.content.deltaVsPrior > 0 ? '+' : ''}
                      {brief.content.deltaVsPrior}
                    </p>
                    <p className="text-xs text-muted-foreground">vs avg</p>
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
