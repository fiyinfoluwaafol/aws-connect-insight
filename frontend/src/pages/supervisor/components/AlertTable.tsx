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
import { Eye } from 'lucide-react';
import type { SupervisorAlertViewModel, SupervisorCallViewModel } from '@/lib/supervisor-alerts';

export interface AlertTableProps {
  alerts: SupervisorAlertViewModel[];
  callsById: Record<string, SupervisorCallViewModel>;
  statusFilter: string;
  severityFilter: string;
  selectedIds: string[];
  openAlertsCount: number;
  onStatusFilterChange: (value: string) => void;
  onSeverityFilterChange: (value: string) => void;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onOpenDetail: (alert: SupervisorAlertViewModel) => void;
  onOpenCall: (callId: string) => void;
  onCloseSelected: () => void;
  severityClassName: (severity: string) => string;
}

export function AlertTable({
  alerts,
  callsById,
  statusFilter,
  severityFilter,
  selectedIds,
  openAlertsCount,
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

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Alerts Center</h2>
          <p className="text-sm text-muted-foreground">{openAlertsCount} open alerts</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={onSeverityFilterChange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={onCloseSelected}>
              Close Selected ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b">
              <tr className="text-left">
                <th className="p-4 w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={onSelectAll}
                  />
                </th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Severity</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Rule</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Issue</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Agent</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Created</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Status</th>
                <th className="p-4 text-sm font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => {
                const call = alert.callId ? callsById[alert.callId] : undefined;
                return (
                  <tr
                    key={alert.id}
                    className="border-b hover:bg-muted/50 cursor-pointer"
                    onClick={() => onOpenDetail(alert)}
                  >
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(alert.id)}
                        onCheckedChange={(checked) => onSelectRow(alert.id, checked as boolean)}
                      />
                    </td>
                    <td className="p-4">
                      <Badge className={severityClassName(alert.severity)} variant="secondary">
                        {alert.severity}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className="font-medium">{alert.ruleLabel}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-muted-foreground">{alert.issue}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm">{call?.agentName || 'Unknown'}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-muted-foreground">
                        {new Date(alert.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <Badge variant={alert.status === 'open' ? 'default' : 'secondary'}>
                        {alert.status}
                      </Badge>
                    </td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => alert.callId && onOpenCall(alert.callId)}
                        disabled={!alert.callId}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {alerts.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No alerts match your filters.
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
