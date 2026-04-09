import { useState, useEffect } from 'react';
import { Call, CallSummary } from '@/lib/mock-data';
import { MockService } from '@/lib/mock-service';
import { callsApi, SupervisorCallDetail } from '@/lib/api';
import { useAppStore } from '@/stores/app-store';
import { useAuthStore } from '@/stores/auth-store';
import { SentimentBadge } from './SentimentBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Clock,
  User,
  CheckCircle,
  XCircle,
  Star,
  AlertTriangle,
  MessageSquare,
  Send,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export type CallDetailCall = Call & {
  hasOpenAlert?: boolean;
  openAlertId?: string | null;
  callSummary?: {
    callId: string;
    summaryText: string;
    keyPhrases: string[];
    entities: string[];
    transcript: Array<{ speaker: string; text: string; timestamp?: string }>;
  };
};

interface CallDetailDrawerProps {
  call: CallDetailCall | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canCreateAlert?: boolean;
  isCreatingAlert?: boolean;
  onCreateAlert?: (callId: string) => Promise<void>;
}

export function CallDetailDrawer({
  call,
  open,
  onOpenChange,
  canCreateAlert = false,
  isCreatingAlert = false,
  onCreateAlert,
}: CallDetailDrawerProps) {
  const [newNote, setNewNote] = useState('');
  const [liveCallDetail, setLiveCallDetail] = useState<SupervisorCallDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (call && open) {
      setLoadingDetail(true);
      callsApi.getCallById(call.id).then(res => {
        setLiveCallDetail(res);
      }).catch(err => {
        console.error('Failed to fetch call details', err);
      }).finally(() => setLoadingDetail(false));
    } else {
      setLiveCallDetail(null);
    }
  }, [call, open]);

  const { user } = useAuthStore();
  const { exemplarCallIds, toggleExemplar, callNotes, addNote } = useAppStore();

  if (!call) return null;

  let summaryText = '';
  let transcript = [] as Array<{ speaker: string; text: string; timestamp?: string }>;
  let topics: string[] = [];
  let keywords: string[] = [];
  let isResolved = call?.resolved || false;
  
  if (liveCallDetail) {
    summaryText = liveCallDetail.summary || '';
    transcript = liveCallDetail.transcript || [];
    topics = liveCallDetail.topics || [];
    keywords = liveCallDetail.keywords || [];
    isResolved = liveCallDetail.is_resolved ?? isResolved;
  } else if (call) {
    const backupSummary = call.callSummary ?? MockService.getSummary(call.id);
    summaryText = backupSummary?.summaryText || (call as Call & { summaryStr?: string })?.summaryStr || '';
    transcript = backupSummary?.transcript || [];
    topics = call.topics || [];
  }
  const isExemplar = exemplarCallIds.includes(call.id);
  const notes = callNotes.filter((n) => n.callId === call.id);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleExemplar = () => {
    toggleExemplar(call.id);
    toast({
      title: isExemplar ? 'Removed from Exemplars' : 'Added to Exemplars',
      description: isExemplar
        ? 'This call is no longer marked as an exemplar.'
        : 'This call has been added to the exemplar library.',
    });
  };

  const handleCreateAlert = async () => {
    if (!onCreateAlert) return;
    await onCreateAlert(call.id);
  };

  const handleAddNote = () => {
    if (!newNote.trim() || !user) return;
    addNote({
      callId: call.id,
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`.trim() || user.email,
      text: newNote.trim(),
    });
    setNewNote('');
    toast({
      title: 'Note Added',
      description: 'Your note has been saved.',
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Call Details
            <SentimentBadge sentiment={call.sentimentLabel} />
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-6">
            {/* Call Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Agent</p>
                <p className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {call.agentName}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">{'Customer'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {formatDuration(call.durationSec)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">
                  {new Date(call.startedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Sentiment Score</p>
                <p className="font-medium">{call.sentimentScore.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Resolution</p>
                <p className="font-medium flex items-center gap-2">
                  {isResolved ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-success" />
                      Resolved
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-destructive" />
                      Unresolved
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Topics */}
            <div>
              <p className="text-sm text-muted-foreground mb-2">Topics</p>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <Badge key={topic} variant="secondary">
                    {topic.replace(/-/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-2">AI Summary</h4>
              <p className="text-sm text-muted-foreground">{loadingDetail ? 'Loading summary...' : (summaryText || 'Summary not available.')}</p>
              {keywords.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1">Key Phrases</p>
                  <div className="flex flex-wrap gap-1">
                    {keywords.map((phrase) => (
                      <Badge key={phrase} variant="outline" className="text-xs">
                        {phrase}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Transcript */}
            {transcript && transcript.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3">Transcript</h4>
                <div className="space-y-3">
                  {transcript.map((turn, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        turn.speaker === 'Agent'
                          ? 'bg-primary/10 ml-4'
                          : 'bg-muted mr-4'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">{turn.speaker}</span>
                        {turn.timestamp && (
                          <span className="text-xs text-muted-foreground">
                            {turn.timestamp}
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{turn.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Notes
              </h4>
              <div className="space-y-2 mb-3">
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{note.userName}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(note.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm">{note.text}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                />
                <Button size="icon" onClick={handleAddNote} disabled={!newNote.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <Button
                variant={isExemplar ? 'secondary' : 'outline'}
                size="sm"
                onClick={handleToggleExemplar}
              >
                <Star className={`h-4 w-4 mr-2 ${isExemplar ? 'fill-current' : ''}`} />
                {isExemplar ? 'Remove Exemplar' : 'Mark as Exemplar'}
              </Button>
              {canCreateAlert && !liveCallDetail?.has_open_alert && !call?.hasOpenAlert && onCreateAlert && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCreateAlert()}
                  disabled={isCreatingAlert}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  {isCreatingAlert ? 'Creating Alert...' : 'Create Alert'}
                </Button>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
