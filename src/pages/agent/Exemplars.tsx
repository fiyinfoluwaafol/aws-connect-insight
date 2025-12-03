import { useState } from 'react';
import { MockService } from '@/lib/mock-service';
import { useAppStore } from '@/stores/app-store';
import { SentimentBadge } from '@/components/SentimentBadge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Star className="h-5 w-5" />
            Exemplar Calls
          </h2>
          <p className="text-sm text-muted-foreground">Learn from top-performing calls</p>
        </div>
        <Select value={topicFilter} onValueChange={setTopicFilter}>
          <SelectTrigger className="w-40">
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

      <div className="grid gap-4">
        {exemplars.map((call) => (
          <Card key={call.id} className="p-4 hover:bg-muted/50 cursor-pointer" onClick={() => setViewCall(call)}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <SentimentBadge sentiment={call.sentimentLabel} />
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />{call.agentName}
                  </span>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />{Math.floor(call.durationSec / 60)}m
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {call.topics.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">{t.replace(/-/g, ' ')}</Badge>
                  ))}
                </div>
              </div>
              <Button variant={bookmarkedExemplars.includes(call.id) ? 'secondary' : 'outline'} size="sm" onClick={(e) => { e.stopPropagation(); handleBookmark(call.id); }}>
                <Bookmark className={`h-4 w-4 ${bookmarkedExemplars.includes(call.id) ? 'fill-current' : ''}`} />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!viewCall} onOpenChange={() => setViewCall(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Exemplar Call Details</DialogTitle>
          </DialogHeader>
          {viewCall && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <SentimentBadge sentiment={viewCall.sentimentLabel} />
                <span>{viewCall.agentName}</span>
                <span className="text-muted-foreground">{Math.floor(viewCall.durationSec / 60)}m {viewCall.durationSec % 60}s</span>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Audio Playback (Mock)</span>
                  <Button size="sm" onClick={handlePlay} disabled={playing}>
                    <Play className="h-4 w-4 mr-1" />{playing ? 'Playing...' : 'Play Snippet'}
                  </Button>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full bg-primary transition-all duration-3000 ${playing ? 'w-full' : 'w-0'}`} />
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Key Moves</h4>
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
