import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { SentimentBadge } from '@/components/SentimentBadge';
import { AlertTriangle, CheckCircle, User, Clock } from 'lucide-react';
import type { SupervisorAlertViewModel, SupervisorCallViewModel } from '@/lib/supervisor-alerts';

const MIN_RELATED_CALLS_SKELETON_MS = 250;
const RELATED_CALLS_CROSSFADE_MS = 650;
const LOADED_RELATED_CALLS_CLASSNAME =
  'space-y-3 col-start-1 row-start-1 animate-in fade-in-0 duration-700 ease-out';
const CROSSFADE_SKELETON_CLASSNAME =
  'space-y-3 col-start-1 row-start-1 animate-out fade-out-0 duration-500 ease-out';

type LoadingTransitionPhase = 'loading' | 'crossfading' | 'loaded';

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
  const relatedCallsLoadingPhase = useLoadingTransitionPhase(
    isLoadingRelatedCalls,
    MIN_RELATED_CALLS_SKELETON_MS,
    RELATED_CALLS_CROSSFADE_MS
  );
  const showRelatedCallsSkeleton = relatedCallsLoadingPhase !== 'loaded';
  const showRelatedCallsContent = relatedCallsLoadingPhase !== 'loading';
  const isCrossfadingRelatedCalls = relatedCallsLoadingPhase === 'crossfading';
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

            {!isRecurringAlert && (showRelatedCallsSkeleton || primaryCall) && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="grid">
                  {showRelatedCallsSkeleton ? (
                    <CallInformationSkeleton
                      key="call-information-skeleton"
                      className={
                        isCrossfadingRelatedCalls
                          ? CROSSFADE_SKELETON_CLASSNAME
                          : undefined
                      }
                      ariaHidden={showRelatedCallsContent}
                    />
                  ) : null}
                  {showRelatedCallsContent && primaryCall ? (
                    <CallInformationContent
                      key="call-information-content"
                      call={primaryCall}
                      onOpenCall={onOpenCall}
                      onClose={onClose}
                      className={LOADED_RELATED_CALLS_CLASSNAME}
                    />
                  ) : null}
                </div>
              </div>
            )}

            {isRecurringAlert && (
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="grid">
                  {showRelatedCallsSkeleton ? (
                    <AffectedCallsSkeleton
                      key="affected-calls-skeleton"
                      className={
                        isCrossfadingRelatedCalls
                          ? CROSSFADE_SKELETON_CLASSNAME
                          : undefined
                      }
                      ariaHidden={showRelatedCallsContent}
                    />
                  ) : null}
                  {showRelatedCallsContent ? (
                    <AffectedCallsContent
                      key="affected-calls-content"
                      alert={alert}
                      relatedCalls={relatedCalls}
                      onOpenCall={onOpenCall}
                      onClose={onClose}
                      className={LOADED_RELATED_CALLS_CLASSNAME}
                    />
                  ) : null}
                </div>
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

function CallInformationSkeleton({
  className = 'space-y-3 col-start-1 row-start-1',
  ariaHidden = false,
}: {
  className?: string;
  ariaHidden?: boolean;
}) {
  return (
    <div
      className={className}
      role={ariaHidden ? undefined : 'status'}
      aria-label={ariaHidden ? undefined : 'Loading call information'}
      aria-hidden={ariaHidden || undefined}
    >
      <Skeleton className="h-4 w-28" />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

function CallInformationContent({
  call,
  onOpenCall,
  onClose,
  className,
}: {
  call: SupervisorCallViewModel;
  onOpenCall: (callId: string) => void;
  onClose: () => void;
  className: string;
}) {
  return (
    <div className={className}>
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
  );
}

function AffectedCallsSkeleton({
  className = 'space-y-3 col-start-1 row-start-1',
  ariaHidden = false,
}: {
  className?: string;
  ariaHidden?: boolean;
}) {
  return (
    <div
      className={className}
      role={ariaHidden ? undefined : 'status'}
      aria-label={ariaHidden ? undefined : 'Loading affected calls'}
      aria-hidden={ariaHidden || undefined}
    >
      <Skeleton className="h-4 w-32" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3"
          >
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function AffectedCallsContent({
  alert,
  relatedCalls,
  onOpenCall,
  onClose,
  className,
}: {
  alert: SupervisorAlertViewModel;
  relatedCalls: SupervisorCallViewModel[];
  onOpenCall: (callId: string) => void;
  onClose: () => void;
  className: string;
}) {
  return (
    <div className={className}>
      <h5 className="text-sm font-medium">
        Affected Calls
        {alert.matchedCount ? ` (${alert.matchedCount})` : ''}
      </h5>
      {relatedCalls.length > 0 ? (
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
  );
}

function useLoadingTransitionPhase(
  isLoading: boolean,
  minimumMs: number,
  crossfadeMs: number
) {
  const [phase, setPhase] = useState<LoadingTransitionPhase>(
    isLoading ? 'loading' : 'loaded'
  );

  useEffect(() => {
    if (isLoading) {
      setPhase('loading');
      return undefined;
    }

    if (phase === 'loaded') {
      return undefined;
    }

    if (phase === 'crossfading') {
      const crossfadeTimeout = window.setTimeout(() => {
        setPhase('loaded');
      }, crossfadeMs);

      return () => window.clearTimeout(crossfadeTimeout);
    }

    const minimumTimeout = window.setTimeout(() => {
      setPhase('crossfading');
    }, minimumMs);

    return () => window.clearTimeout(minimumTimeout);
  }, [crossfadeMs, isLoading, minimumMs, phase]);

  return phase;
}
