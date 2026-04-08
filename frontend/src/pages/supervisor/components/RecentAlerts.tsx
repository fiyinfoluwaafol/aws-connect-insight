import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SentimentBadge } from '@/components/SentimentBadge';
import { AlertTriangle, ArrowUpRight, Users, Clock } from 'lucide-react';
import type { SupervisorAlertViewModel, SupervisorCallViewModel } from '@/lib/supervisor-alerts';

export interface RecentAlertsProps {
  alerts: SupervisorAlertViewModel[];
  callsById: Record<string, SupervisorCallViewModel>;
  onViewAll: () => void;
  onAlertClick: (alert: SupervisorAlertViewModel) => void;
}

export function RecentAlerts({ alerts, callsById, onViewAll, onAlertClick }: RecentAlertsProps) {
  return (
    <Card className="mt-8 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Recent Alerts</h3>
          <p className="text-sm text-muted-foreground">High-priority issues requiring attention</p>
        </div>
        <Button variant="outline" size="sm" onClick={onViewAll}>
          View All
          <ArrowUpRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No open alerts</p>
        ) : (
          alerts.map((alert) => {
            const call = alert.callId ? callsById[alert.callId] : undefined;
            return (
              <div
                key={alert.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card transition-colors cursor-pointer"
                onClick={() => onAlertClick(alert)}
              >
                <div className="flex items-start gap-4 flex-1">
                  <div
                    className={`p-2 rounded-lg ${
                      alert.severity === 'high'
                        ? 'bg-destructive/10'
                        : alert.severity === 'medium'
                          ? 'bg-warning/10'
                          : 'bg-muted'
                    }`}
                  >
                    <AlertTriangle
                      className={`h-5 w-5 ${
                        alert.severity === 'high'
                          ? 'text-destructive'
                          : alert.severity === 'medium'
                            ? 'text-warning'
                            : 'text-muted-foreground'
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{alert.ruleLabel}</h4>
                      <Badge variant="outline" className="text-xs">
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{alert.issue}</p>
                    {call && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {call.agentName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(call.startedAt).toLocaleDateString()}
                        </span>
                        <SentimentBadge sentiment={call.sentimentLabel} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
