import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useAppStore } from '@/stores/app-store';
import { callsApi, type SimulateCallResponse } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SentimentBadge } from '@/components/SentimentBadge';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { pageShellClassName } from '@/lib/page-animation';
import { toast } from '@/hooks/use-toast';
import {
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  X,
  Phone,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';

type TranscriptTurn = SimulateCallResponse['transcript'][number];

const simulateStages = [
  'Selecting a sample transcript',
  'Running transcript analysis',
  'Saving the call and insights',
  'Preparing your coaching view',
];

export default function AgentHome() {
  const { user } = useAuthStore();
  const {
    agentTips,
    addAgentTip,
    updateAgentTip,
    addNotification,
    addAgentCall,
    agentCalls,
  } = useAppStore();
  const [expandedTips, setExpandedTips] = useState<string[]>([]);
  const [expandedCalls, setExpandedCalls] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulateStage, setSimulateStage] = useState(0);
  const simulateTimerRef = useRef<number | null>(null);

  const userTips = useMemo(
    () => agentTips.filter((t) => t.agentId === user?.id && !t.dismissed),
    [agentTips, user?.id]
  );

  const userCalls = useMemo(
    () => agentCalls.filter((call) => call.agentId === user?.id),
    [agentCalls, user?.id]
  );

  const getKeywordList = (keywords: Record<string, boolean> | undefined) =>
    Object.entries(keywords ?? {})
      .filter(([, enabled]) => Boolean(enabled))
      .map(([keyword]) => keyword);

  const toggleExpand = (itemId: string) => {
    setExpandedTips((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const toggleCallExpand = (callId: string) => {
    setExpandedCalls((prev) =>
      prev.includes(callId) ? prev.filter((id) => id !== callId) : [...prev, callId]
    );
  };

  const clearSimulateTimer = () => {
    if (simulateTimerRef.current !== null) {
      window.clearInterval(simulateTimerRef.current);
      simulateTimerRef.current = null;
    }
  };

  useEffect(() => () => clearSimulateTimer(), []);

  const normalizeTurn = (turn: unknown): TranscriptTurn => {
    if (
      turn &&
      typeof turn === 'object' &&
      'speaker' in turn &&
      'text' in turn &&
      typeof (turn as { speaker: unknown; text: unknown }).speaker === 'string' &&
      typeof (turn as { speaker: unknown; text: unknown }).text === 'string'
    ) {
      const speaker = (turn as { speaker: string; text: string }).speaker;
      const text = (turn as { speaker: string; text: string }).text;
      const timestamp = (turn as { speaker: string; text: string; timestamp?: string }).timestamp;
      return { speaker, text, timestamp };
    }

    return { speaker: 'Unknown', text: String(turn) };
  };

  const handleSimulateCallEnd = async () => {
    if (isSimulating) {
      return;
    }

    if (!user?.id) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to record a simulated call.',
        variant: 'destructive',
      });
      return;
    }

    setIsSimulating(true);
    setSimulateStage(0);
    clearSimulateTimer();
    simulateTimerRef.current = window.setInterval(() => {
      setSimulateStage((currentStage) =>
        currentStage < simulateStages.length - 1 ? currentStage + 1 : currentStage
      );
    }, 900);

    try {
      const result = await callsApi.simulateCall();

      const keyMoves = Array.isArray(result.key_moves) ? result.key_moves : [];
      const rawTranscript = Array.isArray(result.transcript)
        ? result.transcript
        : [];
      const transcript = rawTranscript.map(normalizeTurn);
      const keywords = getKeywordList(result.keywords);
      const shouldCreateTip =
        result.sentiment_label === 'negative' ||
        result.sentiment_score < -0.3 ||
        result.is_resolved === false;

      addAgentCall({
        callId: result.call_id,
        agentId: user.id,
        summary: result.summary,
        sentimentScore: result.sentiment_score,
        sentimentLabel: result.sentiment_label,
        topics: result.topics,
        keyMoves,
        isResolved: result.is_resolved,
        keywords,
        transcript,
      });

      if (shouldCreateTip) {
        const tips: string[] = [];
        if (result.sentiment_score < -0.3) {
          tips.push('Acknowledge the customer concern faster and confirm empathy at the start.');
        }
        if (result.is_resolved === false) {
          tips.push('Close calls with explicit next steps and ownership handoff.');
        }
        if (keyMoves.length > 0) {
          tips.push(`Reinforce stronger use of key moves like "${keyMoves[0]}".`);
        }

        const reasonParts = [
          `${result.sentiment_label.toUpperCase()} sentiment (${result.sentiment_score.toFixed(2)})`,
          `Resolved: ${result.is_resolved ? 'Yes' : 'No'}`,
          `Topics: ${result.topics.join(', ') || 'No topics detected'}`,
        ];
        if (keywords.length > 0) {
          reasonParts.push(`Matched terms: ${keywords.join(', ')}`);
        }

        addAgentTip({
          callId: result.call_id,
          agentId: user.id,
          tips,
          reason: reasonParts.join(' • '),
        });
        addNotification(`New coaching tips available for your recent simulated call.`);
        toast({
          title: 'Call Ended',
          description: `Call recorded with ${result.sentiment_label} sentiment. Coaching tips available.`,
        });
      } else {
        toast({
          title: 'Call Ended',
          description: `Call recorded with ${result.sentiment_label} sentiment. Great job!`,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to simulate call',
        variant: 'destructive',
      });
    } finally {
      clearSimulateTimer();
      setIsSimulating(false);
      setSimulateStage(0);
    }
  };

  const renderTranscript = (transcript: TranscriptTurn[]) => (
    <div className="space-y-2">
      {transcript.map((turn, index) => {
        const isAgent = turn.speaker.toLowerCase() === 'agent';
        return (
          <div
            key={`${turn.speaker}-${index}-${turn.text.slice(0, 14)}`}
            className={`rounded-lg p-3 ${isAgent ? 'bg-primary/10 ml-4' : 'bg-muted mr-4'}`}
          >
            <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{turn.speaker}</span>
              {turn.timestamp ? <span>• {turn.timestamp}</span> : null}
            </div>
            <p className="text-sm">{turn.text}</p>
          </div>
        );
      })}
    </div>
  );

  const simulateAction = (
    <Button onClick={handleSimulateCallEnd} disabled={isSimulating} className="shrink-0">
      {isSimulating ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Phone className="h-4 w-4 mr-2" />
      )}
      {isSimulating ? 'Simulating...' : 'Simulate Call End'}
    </Button>
  );

  return (
    <div className={pageShellClassName()}>
      <PageHeader
        title={`Welcome back, ${user?.firstName || user?.email || 'Agent'}`}
        description="Your post-call coaching workspace—review calls, tips, and next steps."
        actions={simulateAction}
      />

      <div className="space-y-8">
        {isSimulating && (
          <Card className="p-4 border-primary/20 bg-primary/5">
            <div className="flex items-start gap-3">
              <Loader2 className="h-5 w-5 text-primary animate-spin mt-0.5" />
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Simulating call in progress</h3>
                    <p className="text-sm text-muted-foreground">
                      We&apos;re moving through the call pipeline so the page does not feel stuck.
                    </p>
                  </div>
                  <Badge variant="secondary">Working</Badge>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {simulateStages.map((stage, index) => {
                    const isActive = index === simulateStage;

                    return (
                      <div
                        key={stage}
                        className={`rounded-lg border p-3 ${
                          isActive
                            ? 'border-primary/40 bg-background shadow-sm'
                            : 'border-border/60 bg-background/70'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              isActive ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'
                            }`}
                          />
                          <span
                            className={`text-sm ${
                              isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            {stage}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>
        )}

        <section>
          <h3 className="text-lg font-semibold mb-4">Recent Calls</h3>
          {userCalls.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="No recent simulated calls"
              description="Run a simulated call to see summary, transcript, and coaching signals here."
              action={
                <Button variant="outline" onClick={handleSimulateCallEnd}>
                  Simulate Call End
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {userCalls.slice(0, 5).map((call) => {
                const isExpanded = expandedCalls.includes(call.callId);

                return (
                  <Card key={call.callId} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">Simulated</Badge>
                          <SentimentBadge sentiment={call.sentimentLabel} score={call.sentimentScore} />
                          <Badge variant={call.isResolved ? 'secondary' : 'destructive'}>
                            {call.isResolved ? 'Resolved' : 'Unresolved'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(call.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{call.summary}</p>
                        <div className="flex flex-wrap gap-2">
                          {call.topics.map((topic) => (
                            <Badge key={topic} variant="secondary">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <Button size="sm" variant="outline" onClick={() => toggleCallExpand(call.callId)}>
                        {isExpanded ? 'Hide details' : 'View details'}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        {call.keyMoves.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold mb-2">Key Moves</p>
                            <div className="flex flex-wrap gap-2">
                              {call.keyMoves.map((move) => (
                                <Badge key={move} variant="outline">
                                  {move}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <p className="text-sm font-semibold mb-2">Transcript</p>
                          {call.transcript.length > 0 ? (
                            renderTranscript(call.transcript)
                          ) : (
                            <p className="text-sm text-muted-foreground">No transcript available.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Coaching Tips</h3>
            <span className="text-xs text-muted-foreground">
              {userTips.length} {userTips.length === 1 ? 'tip' : 'tips'}
            </span>
          </div>

          {userTips.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title="No tips yet"
              description="Complete a call (or simulate one) to receive personalized coaching tips."
              action={<Button onClick={handleSimulateCallEnd}>Simulate Call End</Button>}
            />
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateAgentTip(tip.id, { dismissed: true })}
                      aria-label="Dismiss tip"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <ul className="space-y-2 mb-4">
                    {tip.tips.map((tipLine, index) => (
                      <li key={`${tip.id}-${index}`} className="flex items-start gap-2">
                        <span className="text-primary font-bold">{index + 1}.</span>
                        <span>{tipLine}</span>
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
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded mb-3">
                      {tip.reason}
                    </p>
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
        </section>
      </div>
    </div>
  );
}
