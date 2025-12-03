import { useState } from 'react';
import { useAppStore } from '@/stores/app-store';
import { MockService } from '@/lib/mock-service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  FileText,
  Download,
  Mail,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Star,
  Plus,
} from 'lucide-react';

export default function DailyBriefs() {
  const { dailyBriefs } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [viewBrief, setViewBrief] = useState<typeof dailyBriefs[0] | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 500)); // Simulate delay
      const brief = MockService.generateDailyBrief(selectedDate);
      toast({
        title: 'Brief Generated',
        description: `Daily brief for ${selectedDate} has been created.`,
      });
      // Find the newly created brief
      const newBrief = useAppStore.getState().dailyBriefs.find(
        (b) => b.date === selectedDate
      );
      if (newBrief) setViewBrief(newBrief);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPDF = async (brief: typeof dailyBriefs[0]) => {
    const content = `
Daily Brief - ${brief.date}
Generated: ${new Date(brief.generatedAt).toLocaleString()}

SUMMARY
-------
Total Calls: ${brief.content.totalCalls}
Average Sentiment: ${brief.content.avgSentiment}
Negative Calls: ${brief.content.negativePercent}%
Delta vs Prior 7-day Avg: ${brief.content.deltaVsPrior > 0 ? '+' : ''}${brief.content.deltaVsPrior}

TOP ISSUES
----------
${brief.content.topIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

COACHING OPPORTUNITIES
----------------------
${brief.content.coachingOpportunities.map((opp, i) => `${i + 1}. ${opp}`).join('\n')}

EXEMPLAR CALLS
--------------
${brief.content.exemplarLinks.join(', ')}
    `.trim();

    await MockService.exportPDF(content, `daily-brief-${brief.date}`);
    toast({
      title: 'PDF Exported',
      description: 'The daily brief has been downloaded as PDF.',
    });
  };

  const handleEmailBrief = (brief: typeof dailyBriefs[0]) => {
    const result = MockService.sendEmailMock(
      'leadership@demo.com',
      `Daily Brief - ${brief.date}`,
      `Daily brief report for ${brief.date}. Total calls: ${brief.content.totalCalls}, Average sentiment: ${brief.content.avgSentiment}`
    );
    toast({
      title: 'Email Queued',
      description: result.message,
    });
  };

  const sortedBriefs = [...dailyBriefs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Generate Brief */}
      <Card className="p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Generate Daily Brief</h2>
        <div className="flex items-end gap-4">
          <div className="space-y-2">
            <Label>Select Date</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            <Plus className="h-4 w-4 mr-2" />
            {generating ? 'Generating...' : 'Generate Brief'}
          </Button>
        </div>
      </Card>

      {/* Briefs List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Generated Briefs</h2>
        {sortedBriefs.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Briefs Yet</h3>
            <p className="text-muted-foreground">
              Generate your first daily brief using the form above.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {sortedBriefs.map((brief) => (
              <Card
                key={brief.id}
                className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => setViewBrief(brief)}
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

      {/* Brief Detail Dialog */}
      <Dialog open={!!viewBrief} onOpenChange={() => setViewBrief(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Daily Brief - {viewBrief?.date}
            </DialogTitle>
          </DialogHeader>
          {viewBrief && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold">{viewBrief.content.totalCalls}</p>
                  <p className="text-xs text-muted-foreground">Total Calls</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold">{viewBrief.content.avgSentiment}</p>
                  <p className="text-xs text-muted-foreground">Avg Sentiment</p>
                </Card>
                <Card className="p-4 text-center">
                  <p className="text-2xl font-bold">{viewBrief.content.negativePercent}%</p>
                  <p className="text-xs text-muted-foreground">Negative</p>
                </Card>
                <Card className="p-4 text-center">
                  <p
                    className={`text-2xl font-bold ${
                      viewBrief.content.deltaVsPrior > 0 ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {viewBrief.content.deltaVsPrior > 0 ? '+' : ''}
                    {viewBrief.content.deltaVsPrior}
                  </p>
                  <p className="text-xs text-muted-foreground">Delta</p>
                </Card>
              </div>

              {/* Top Issues */}
              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" />
                  Top Issues
                </h4>
                <div className="space-y-2">
                  {viewBrief.content.topIssues.map((issue, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Badge variant="outline">{i + 1}</Badge>
                      <span className="capitalize">{issue.replace(/-/g, ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Coaching Opportunities */}
              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4" />
                  Coaching Opportunities
                </h4>
                <div className="space-y-2">
                  {viewBrief.content.coachingOpportunities.map((opp, i) => (
                    <div key={i} className="p-3 bg-muted/50 rounded-lg text-sm">
                      {opp}
                    </div>
                  ))}
                </div>
              </div>

              {/* Exemplar Links */}
              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-3">
                  <Star className="h-4 w-4" />
                  Exemplar Calls
                </h4>
                <div className="flex flex-wrap gap-2">
                  {viewBrief.content.exemplarLinks.map((callId) => (
                    <Badge key={callId} variant="secondary">
                      {callId}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => handleExportPDF(viewBrief)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleEmailBrief(viewBrief)}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email Brief
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
