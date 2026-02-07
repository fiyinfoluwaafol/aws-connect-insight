import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useAppStore } from '@/stores/app-store';
import { mockData } from '@/lib/mock-data';
import { MockService } from '@/lib/mock-service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Lightbulb, ThumbsUp, ThumbsDown, Bookmark, X, Phone, ChevronDown, ChevronUp } from 'lucide-react';

export default function AgentHome() {
  const { user } = useAuthStore();
  const { agentTips, addAgentTip, updateAgentTip, addNotification } = useAppStore();
  const [expandedTips, setExpandedTips] = useState<string[]>([]);

  const userTips = agentTips.filter((t) => t.agentId === user?.agentId && !t.dismissed);

  const handleSimulateCallEnd = () => {
    const agentCalls = mockData.calls.filter((c) => c.agentId === user?.agentId);
    const randomCall = agentCalls[Math.floor(Math.random() * agentCalls.length)];
    if (!randomCall) return;

    const { tips, reason } = MockService.generatePostCallTips(randomCall);
    addAgentTip({ callId: randomCall.id, agentId: user?.agentId || '', tips, reason });
    addNotification(`New coaching tips available for your recent call`);
    toast({ title: 'Call Ended', description: 'New coaching tips are available!' });
  };

  const toggleExpand = (tipId: string) => {
    setExpandedTips((prev) =>
      prev.includes(tipId) ? prev.filter((id) => id !== tipId) : [...prev, tipId]
    );
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Welcome back, {user?.name}</h2>
          <p className="text-sm text-muted-foreground">Your post-call coaching tips</p>
        </div>
        <Button onClick={handleSimulateCallEnd}>
          <Phone className="h-4 w-4 mr-2" />
          Simulate Call End
        </Button>
      </div>

      {userTips.length === 0 ? (
        <Card className="p-12 text-center">
          <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Tips Yet</h3>
          <p className="text-muted-foreground mb-4">Complete a call to receive coaching tips.</p>
          <Button onClick={handleSimulateCallEnd}>Simulate Call End</Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {userTips.map((tip) => (
            <Card key={tip.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-warning" />
                  <span className="text-sm text-muted-foreground">
                    {new Date(tip.createdAt).toLocaleString()}
                  </span>
                  {tip.bookmarked && <Badge variant="secondary">Saved</Badge>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => updateAgentTip(tip.id, { dismissed: true })}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ul className="space-y-2 mb-4">
                {tip.tips.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary font-bold">{i + 1}.</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <button
                className="text-sm text-muted-foreground flex items-center gap-1 mb-3"
                onClick={() => toggleExpand(tip.id)}
              >
                Why this tip?
                {expandedTips.includes(tip.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {expandedTips.includes(tip.id) && (
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded mb-3">{tip.reason}</p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  variant={tip.helpful === true ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateAgentTip(tip.id, { helpful: true })}
                >
                  <ThumbsUp className="h-4 w-4 mr-1" />
                  Helpful
                </Button>
                <Button
                  variant={tip.helpful === false ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => updateAgentTip(tip.id, { helpful: false })}
                >
                  <ThumbsDown className="h-4 w-4 mr-1" />
                  Not Helpful
                </Button>
                <Button
                  variant={tip.bookmarked ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => updateAgentTip(tip.id, { bookmarked: !tip.bookmarked })}
                >
                  <Bookmark className={`h-4 w-4 mr-1 ${tip.bookmarked ? 'fill-current' : ''}`} />
                  {tip.bookmarked ? 'Saved' : 'Save'}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
