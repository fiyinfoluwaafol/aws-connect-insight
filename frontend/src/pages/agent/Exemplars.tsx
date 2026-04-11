import { useState } from 'react';
import { MockService } from '@/lib/mock-service';
import { useAppStore } from '@/stores/app-store';
import { SentimentBadge } from '@/components/SentimentBadge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { pageShellClassName } from '@/lib/page-animation';
import { Star, Bookmark, Clock, User, Play } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const topics = ['billing', 'shipping', 'returns', 'technical-support', 'account-setup', 'upsell'];

export default function AgentExemplars() {
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const { bookmarkedExemplars, toggleBookmark } = useAppStore();
  const [viewCall, setViewCall] = useState<ReturnType<typeof MockService.getExemplars>[0] | null>(null);
  const [playing, setPlaying] = useState(false);

  const exemplars = MockService.getExemplars({ topic: topicFilter !== 'all' ? topicFilter : undefined });

  const handleBookmark = (callId: string) => {
    toggleBookmark(callId);
    toast({ title: bookmarkedExemplars.includes(callId) ? 'Removed from bookmarks' : 'Bookmarked!' });
  };

  const handlePlay = () => {
    setPlaying(true);
    setTimeout(() => setPlaying(false), 3000);
  };

  const topicSelect = (
    <div className="flex flex-col gap-1 w-full sm:w-auto">
      <Label htmlFor="exemplar-topic" className="sr-only">
        Filter by topic
      </Label>
      <Select value={topicFilter} onValueChange={setTopicFilter}>
        <SelectTrigger id="exemplar-topic" className="w-full sm:w-40">
          <SelectValue placeholder="Filter by topic" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Topics</SelectItem>
          {topics.map((t) => (
            <SelectItem key={t} value={t}>{t.replace(/-/g, ' ')}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className={pageShellClassName()}>
      <PageHeader
        title="Exemplar calls"
        description="Learn from curated, high-performing conversations."
        actions={topicSelect}
      />

      {exemplars.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No exemplars for this topic"
          description="Try choosing “All Topics” or another category to see sample calls."
        />
      ) : (
        <div className="grid gap-4">
          {exemplars.map((call) => (
            <Card
              key={call.id}
              className="p-4 hover:bg-muted/50 cursor-pointer transition-colors shadow-sm"
              onClick={() => setViewCall(call)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                // Ignore when focus is on the bookmark button or other nested controls.
                if (e.target !== e.currentTarget) return;
                e.preventDefault();
                setViewCall(call);
              }}
              tabIndex={0}
              role="button"
              aria-label={`Open exemplar call ${call.id}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <SentimentBadge sentiment={call.sentimentLabel} />
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3 shrink-0" aria-hidden />
                      {call.agentName}
                    </span>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" aria-hidden />
                      {Math.floor(call.durationSec / 60)}m
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {call.topics.map((t) => (
                      <Badge key={t} variant="secondary" className="text-xs">{t.replace(/-/g, ' ')}</Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant={bookmarkedExemplars.includes(call.id) ? 'secondary' : 'outline'}
                  size="icon"
                  className="shrink-0"
                  aria-label={bookmarkedExemplars.includes(call.id) ? 'Remove bookmark' : 'Bookmark call'}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBookmark(call.id);
                  }}
                >
                  <Bookmark className={`h-4 w-4 ${bookmarkedExemplars.includes(call.id) ? 'fill-current' : ''}`} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!viewCall} onOpenChange={() => setViewCall(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Exemplar call details</DialogTitle>
          </DialogHeader>
          {viewCall && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <SentimentBadge sentiment={viewCall.sentimentLabel} />
                <span>{viewCall.agentName}</span>
                <span className="text-muted-foreground">
                  {Math.floor(viewCall.durationSec / 60)}m {viewCall.durationSec % 60}s
                </span>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Audio playback (mock)</span>
                  <Button size="sm" onClick={handlePlay} disabled={playing} aria-busy={playing}>
                    <Play className="h-4 w-4 mr-1" aria-hidden />
                    {playing ? 'Playing...' : 'Play snippet'}
                  </Button>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full bg-primary transition-all duration-3000 ${playing ? 'w-full' : 'w-0'}`} />
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Key moves</h4>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>• Acknowledged customer frustration early</li>
                  <li>• Offered clear next steps</li>
                  <li>• Confirmed resolution before ending</li>
                </ul>
              </div>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {MockService.getSummary(viewCall.id)?.transcript.map((t, i) => (
                    <div key={i} className={`p-2 rounded text-sm ${t.speaker === 'Agent' ? 'bg-primary/10 ml-4' : 'bg-muted mr-4'}`}>
                      <span className="font-medium">{t.speaker}:</span> {t.text}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
