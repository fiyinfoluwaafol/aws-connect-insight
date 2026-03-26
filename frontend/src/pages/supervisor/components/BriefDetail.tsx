import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Download, Mail, AlertTriangle, TrendingUp, Star, Loader2 } from 'lucide-react';
import type { DailyBrief } from './BriefList';

export interface BriefDetailProps {
  brief: DailyBrief | null;
  open: boolean;
  exporting: boolean;
  onOpenChange: (open: boolean) => void;
  onExportPDF: (brief: DailyBrief) => void;
  onEmailBrief: (brief: DailyBrief) => void;
}

export function BriefDetail({
  brief,
  open,
  exporting,
  onOpenChange,
  onExportPDF,
  onEmailBrief,
}: BriefDetailProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Daily Brief - {brief?.date}
          </DialogTitle>
        </DialogHeader>
        {brief && (
          <div className="space-y-6">
            <div id="brief-content" className="space-y-6 bg-background p-4 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold">{brief.content.totalCalls}</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold">{brief.content.avgSentiment}</p>
                  <p className="text-xs text-muted-foreground">Avg Sentiment</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold">{brief.content.negativePercent}%</p>
                  <p className="text-xs text-muted-foreground">Negative</p>
                </Card>
                <Card className="p-4 text-center">
                  <p
                    className={`text-2xl font-bold ${
                      brief.content.deltaVsPrior > 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {brief.content.deltaVsPrior > 0 ? '+' : ''}
                    {brief.content.deltaVsPrior}
                  </p>
                  <p className="text-xs text-muted-foreground">Delta</p>
                </Card>
              </div>

              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  Top Issues
                </h4>
                <div className="space-y-2">
                  {brief.content.topIssues.length > 0 ? (
                    brief.content.topIssues.map((issue, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge variant="outline">{i + 1}</Badge>
                        <span className="capitalize">{issue.replace(/-/g, ' ')}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No issues recorded</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4" />
                  Coaching Opportunities
                </h4>
                <div className="space-y-2">
                  {brief.content.coachingOpportunities.length > 0 ? (
                    brief.content.coachingOpportunities.map((opp, i) => (
                      <div key={i} className="p-3 bg-muted/50 rounded-lg text-sm">
                        {opp}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No coaching opportunities identified</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4" />
                  Exemplar Calls
                </h4>
                <div className="flex flex-wrap gap-2">
                  {brief.content.exemplarLinks.length > 0 ? (
                    brief.content.exemplarLinks.map((callId) => (
                      <Badge key={callId} variant="secondary">
                        {callId}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No exemplar calls for this period</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => onExportPDF(brief)}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export PDF
              </Button>
              <Button
                variant="outline"
                onClick={() => onEmailBrief(brief)}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email Brief
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
