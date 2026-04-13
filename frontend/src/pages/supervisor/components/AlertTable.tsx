import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Eye } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { SupervisorAlertViewModel, SupervisorCallViewModel } from '@/lib/supervisor-alerts';
import { cn } from '@/lib/utils';

export interface AlertTableProps {
  alerts: SupervisorAlertViewModel[];
  callsById: Record<string, SupervisorCallViewModel>;
  statusFilter: string;
  severityFilter: string;
  selectedIds: string[];
  onStatusFilterChange: (value: string) => void;
  onSeverityFilterChange: (value: string) => void;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onOpenDetail: (alert: SupervisorAlertViewModel) => void;
  onOpenCall: (callId: string) => void;
  onCloseSelected: () => void;
  severityClassName: (severity: string) => string;
}

function SeverityDot({ severity }: { severity: string }) {
  const color =
    severity === 'high'
      ? 'bg-destructive'
      : severity === 'medium'
        ? 'bg-warning'
        : 'bg-muted-foreground';
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', color)} aria-hidden />;
}

export function AlertTable({
  alerts,
  callsById,
  statusFilter,
  severityFilter,
  selectedIds,
  onStatusFilterChange,
  onSeverityFilterChange,
  onSelectAll,
  onSelectRow,
  onOpenDetail,
  onOpenCall,
  onCloseSelected,
  severityClassName,
}: AlertTableProps) {
  const allSelected = selectedIds.length === alerts.length && alerts.length > 0;

  const openRow = (alert: SupervisorAlertViewModel) => {
    onOpenDetail(alert);
  };

  const rowKeyHandlers =
    (alert: SupervisorAlertViewModel) => (e: KeyboardEvent<HTMLTableRowElement | HTMLDivElement>) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      // Only activate the row when focus is on the row itself, not nested controls (checkbox, actions).
      if (e.target !== e.currentTarget) return;
      e.preventDefault();
      openRow(alert);
    };

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-end mb-6">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto sm:ml-auto">
          <div className="flex flex-col gap-1">
            <label htmlFor="alert-status-filter" className="text-xs text-muted-foreground sr-only">
              Filter by status
            </label>
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger id="alert-status-filter" className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="alert-severity-filter" className="text-xs text-muted-foreground sr-only">
              Filter by severity
            </label>
            <Select value={severityFilter} onValueChange={onSeverityFilterChange}>
              <SelectTrigger id="alert-severity-filter" className="w-36">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={onCloseSelected}>
              Close Selected ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* Desktop / tablet */}
      <Card className="hidden md:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onSelectAll}
                  aria-label="Select all alerts"
                />
              </TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Rule</TableHead>
              <TableHead>Issue</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert) => {
              const call = alert.callId ? callsById[alert.callId] : undefined;
              return (
                <TableRow
                  key={alert.id}
                  tabIndex={0}
                  className="cursor-pointer"
                  onClick={() => openRow(alert)}
                  onKeyDown={rowKeyHandlers(alert)}
                  aria-label={`Open alert ${alert.ruleLabel}`}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(alert.id)}
                      onCheckedChange={(checked) => onSelectRow(alert.id, checked as boolean)}
                      aria-label={`Select alert ${alert.ruleLabel}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <SeverityDot severity={alert.severity} />
                      <Badge className={severityClassName(alert.severity)} variant="secondary">
                        {alert.severity}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{alert.ruleLabel}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground line-clamp-2">{alert.issue}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {call?.agentName ||
                        (alert.type === 'recurring_topic' || alert.type === 'recurring_keyword'
                          ? `${alert.matchedCount ?? 0} affected calls`
                          : alert.type === 'manual'
                            ? 'Manual review'
                            : 'Unknown')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={alert.status === 'open' ? 'default' : 'secondary'}>
                      {alert.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`View alert ${alert.ruleLabel}`}
                      onClick={() => {
                        if (alert.callId) {
                          onOpenCall(alert.callId);
                          return;
                        }
                        onOpenDetail(alert);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {alerts.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No alerts match your filters.</div>
        )}
      </Card>

      {/* Mobile stacked cards */}
      <div className="md:hidden space-y-3">
        {alerts.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No alerts match your filters.</Card>
        ) : (
          alerts.map((alert) => {
            const call = alert.callId ? callsById[alert.callId] : undefined;
            return (
              <Card
                key={alert.id}
                role="button"
                tabIndex={0}
                className="p-4 cursor-pointer transition-colors hover:bg-muted/50"
                onClick={() => openRow(alert)}
                onKeyDown={rowKeyHandlers(alert)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityDot severity={alert.severity} />
                      <Badge className={severityClassName(alert.severity)} variant="secondary">
                        {alert.severity}
                      </Badge>
                      <Badge variant={alert.status === 'open' ? 'default' : 'secondary'}>
                        {alert.status}
                      </Badge>
                    </div>
                    <p className="font-medium">{alert.ruleLabel}</p>
                    <p className="text-sm text-muted-foreground line-clamp-3">{alert.issue}</p>
                    <p className="text-xs text-muted-foreground">
                      {call?.agentName ||
                        (alert.type === 'recurring_topic' || alert.type === 'recurring_keyword'
                          ? `${alert.matchedCount ?? 0} affected calls`
                          : alert.type === 'manual'
                            ? 'Manual review'
                            : 'Unknown')}{' '}
                      · {new Date(alert.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(alert.id)}
                      onCheckedChange={(checked) => onSelectRow(alert.id, checked as boolean)}
                      aria-label={`Select alert ${alert.ruleLabel}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      aria-label={`View alert ${alert.ruleLabel}`}
                      onClick={() => {
                        if (alert.callId) {
                          onOpenCall(alert.callId);
                          return;
                        }
                        onOpenDetail(alert);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </>
  );
}
