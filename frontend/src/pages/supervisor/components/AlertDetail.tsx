import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SentimentBadge } from '@/components/SentimentBadge';
import { AlertTriangle, CheckCircle, User, Clock } from 'lucide-react';
import type { SupervisorAlertViewModel, SupervisorCallViewModel } from '@/lib/supervisor-alerts';

export interface AlertDetailProps {
  alert: SupervisorAlertViewModel | null;
  relatedCalls: SupervisorCallViewModel[];
  isLoadingRelatedCalls?: boolean;
  onClose: () => void;
  onOpenCall: (callId: string) => void;
  onCloseAlert: (id: string) => void;
  onReopenAlert: (id: string) => void;
  severityClassName: (severity: string) => string;
}

export function AlertDetail({
  alert,
  relatedCalls,
  isLoadingRelatedCalls = false,
  onClose,
  onOpenCall,
  onCloseAlert,
  onReopenAlert,
  severityClassName,
}: AlertDetailProps) {
  const primaryCall = relatedCalls[0];
  const isRecurringAlert =
    alert?.type === 'recurring_topic' || alert?.type === 'recurring_keyword';

  return (
    <Sheet open={!!alert} onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alert Details
          </SheetTitle>
        </SheetHeader>
        {alert && (
          <div className="mt-6 space-y-6">
            <div className="flex items-center gap-2">
              <Badge className={severityClassName(alert.severity)} variant="secondary">
                {alert.severity} severity
              </Badge>
              <Badge variant={alert.status === 'open' ? 'default' : 'secondary'}>
                {alert.status}
              </Badge>
            </div>

            <div>
              <h4 className="font-semibold mb-1">{alert.ruleLabel}</h4>
              <p className="text-sm text-muted-foreground">{alert.issue}</p>
            </div>

            {!isRecurringAlert && primaryCall && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h5 className="text-sm font-medium">Call Information</h5>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {primaryCall.agentName}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {Math.floor(primaryCall.durationSec / 60)}m {primaryCall.durationSec % 60}s
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Sentiment:</span>
                  <SentimentBadge sentiment={primaryCall.sentimentLabel} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    onOpenCall(primaryCall.id);
                    onClose();
                  }}
                >
                  View Full Call Details
                </Button>
              </div>
            )}

            {isRecurringAlert && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h5 className="text-sm font-medium">
                  Affected Calls
                  {alert?.matchedCount ? ` (${alert.matchedCount})` : ''}
                </h5>
                {isLoadingRelatedCalls ? (
                  <p className="text-sm text-muted-foreground">Loading related calls...</p>
                ) : relatedCalls.length > 0 ? (
                  <div className="space-y-2">
                    {relatedCalls.map((call) => (
                      <Button
                        key={call.id}
                        variant="outline"
                        size="sm"
                        className="w-full justify-between"
                        onClick={() => {
                          onOpenCall(call.id);
                          onClose();
                        }}
                      >
                        <span className="truncate text-left">
                          {call.agentName} · {new Date(call.startedAt).toLocaleDateString()}
                        </span>
                        <SentimentBadge sentiment={call.sentimentLabel} />
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No contributing calls were found for this recurring alert.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              {alert.status === 'open' ? (
                <Button
                  className="flex-1"
                  onClick={() => onCloseAlert(alert.id)}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Close Alert
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onReopenAlert(alert.id)}
                >
                  Reopen Alert
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
