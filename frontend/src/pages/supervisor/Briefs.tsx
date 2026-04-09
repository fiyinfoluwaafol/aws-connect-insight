import { useState, useMemo } from 'react';
import { useAppStore } from '@/stores/app-store';
import { MockService } from '@/lib/mock-service';
import { toast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/PageHeader';
import { pageShellClassName } from '@/lib/page-animation';
import { BriefGenerator } from './components/BriefGenerator';
import { BriefList } from './components/BriefList';
import type { DailyBrief } from './components/BriefList';
import { BriefDetail } from './components/BriefDetail';

export default function DailyBriefs() {
  const { dailyBriefs } = useAppStore();
  const [selectedDate, setSelectedDate] = useState(
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [viewBrief, setViewBrief] = useState<DailyBrief | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const maxDate = new Date().toISOString().split('T')[0];

  const sortedBriefs = useMemo(
    () =>
      [...dailyBriefs].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ) as DailyBrief[],
    [dailyBriefs]
  );

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      MockService.generateDailyBrief(selectedDate);
      toast({
        title: 'Brief Generated',
        description: `Daily brief for ${selectedDate} has been created.`,
      });
      const newBrief = useAppStore.getState().dailyBriefs.find(
        (b) => b.date === selectedDate
      ) as DailyBrief | undefined;
      if (newBrief) setViewBrief(newBrief);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPDF = async (brief: DailyBrief) => {
    setExporting(true);
    try {
      await MockService.exportPDF('brief-content', `daily-brief-${brief.date}`);
      toast({
        title: 'PDF Exported',
        description: 'The daily brief has been downloaded as PDF.',
      });
    } catch {
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

      await MockService.exportPDFText(content, `daily-brief-${brief.date}`);
      toast({
        title: 'PDF Exported',
        description: 'The daily brief has been downloaded as PDF.',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleEmailBrief = (brief: DailyBrief) => {
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

  return (
    <div className={pageShellClassName()}>
      <PageHeader
        title="Daily briefs"
        description="AI-generated summaries of team performance, top issues, and coaching opportunities."
      />

      <BriefGenerator
        selectedDate={selectedDate}
        generating={generating}
        maxDate={maxDate}
        onDateChange={setSelectedDate}
        onGenerate={handleGenerate}
      />

      <BriefList briefs={sortedBriefs} onSelectBrief={setViewBrief} />

      <BriefDetail
        brief={viewBrief}
        open={!!viewBrief}
        exporting={exporting}
        onOpenChange={(open) => !open && setViewBrief(null)}
        onExportPDF={handleExportPDF}
        onEmailBrief={handleEmailBrief}
      />
    </div>
  );
}
