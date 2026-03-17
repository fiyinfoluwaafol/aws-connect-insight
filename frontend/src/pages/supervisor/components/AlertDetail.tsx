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
import type { Alert, Call } from '@/lib/mock-data';

export interface AlertDetailProps {
  alert: Alert | null;
  call: Call | undefined;
  onClose: () => void;
  onOpenCall: (callId: string) => void;
  onCloseAlert: (id: string) => void;
  onReopenAlert: (id: string) => void;
  severityClassName: (severity: string) => string;
}

export function AlertDetail({
  alert,
  call,
  onClose,
  onOpenCall,
  onCloseAlert,
  onReopenAlert,
  severityClassName,
}: AlertDetailProps) {
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

            {call && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h5 className="text-sm font-medium">Call Information</h5>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {call.agentName}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {Math.floor(call.durationSec / 60)}m {call.durationSec % 60}s
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Sentiment:</span>
                  <SentimentBadge sentiment={call.sentimentLabel} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    onOpenCall(call.id);
                    onClose();
                  }}
                >
                  View Full Call Details
                </Button>
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
