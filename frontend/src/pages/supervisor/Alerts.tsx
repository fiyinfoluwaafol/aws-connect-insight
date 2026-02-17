import { useState, useEffect } from 'react';
import { mockData, Call } from '@/lib/mock-data';
import { useAppStore } from '@/stores/app-store';
import { SentimentBadge } from '@/components/SentimentBadge';
import { CallDetailDrawer } from '@/components/CallDetailDrawer';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, User, Clock, Eye } from 'lucide-react';

export default function AlertsCenter() {
  const { alerts, setAlerts, updateAlert } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailAlert, setDetailAlert] = useState<typeof alerts[0] | null>(null);
  const [callDrawerOpen, setCallDrawerOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  // Initialize alerts from mock data if empty
  useEffect(() => {
    if (alerts.length === 0) {
      setAlerts(mockData.alerts);
    }
  }, [alerts.length, setAlerts]);

  const filteredAlerts = alerts.filter((alert) => {
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    return true;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredAlerts.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    }
  };

  const handleCloseSelected = () => {
    selectedIds.forEach((id) => {
      updateAlert(id, { status: 'closed' });
    });
    toast({
      title: 'Alerts Closed',
      description: `${selectedIds.length} alert(s) have been closed.`,
    });
    setSelectedIds([]);
  };

  const handleCloseAlert = (id: string) => {
    updateAlert(id, { status: 'closed' });
    toast({
      title: 'Alert Closed',
      description: 'The alert has been marked as closed.',
    });
    setDetailAlert(null);
  };

  const handleReopenAlert = (id: string) => {
    updateAlert(id, { status: 'open' });
    toast({
      title: 'Alert Reopened',
      description: 'The alert has been reopened.',
    });
  };

  const openCallDetail = (callId: string) => {
    const call = mockData.calls.find((c) => c.id === callId);
    if (call) {
      setSelectedCall(call);
      setCallDrawerOpen(true);
    }
  };

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-destructive/10 text-destructive';
      case 'medium':
        return 'bg-warning/10 text-warning';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold">Alerts Center</h2>
          <p className="text-sm text-muted-foreground">
            {alerts.filter((a) => a.status === 'open').length} open alerts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
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
            <Button variant="destructive" size="sm" onClick={handleCloseSelected}>
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
                    checked={selectedIds.length === filteredAlerts.length && filteredAlerts.length > 0}
                    onCheckedChange={handleSelectAll}
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
              {filteredAlerts.map((alert) => {
                const call = mockData.calls.find((c) => c.id === alert.callId);
                return (
                  <tr
                    key={alert.id}
                    className="border-b hover:bg-muted/50 cursor-pointer"
                    onClick={() => setDetailAlert(alert)}
                  >
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.includes(alert.id)}
                        onCheckedChange={(checked) => handleSelect(alert.id, checked as boolean)}
                      />
                    </td>
                    <td className="p-4">
                      <Badge className={severityColor(alert.severity)} variant="secondary">
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
                        onClick={() => openCallDetail(alert.callId)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredAlerts.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No alerts match your filters.
            </div>
          )}
        </div>
      </Card>

      {/* Alert Detail Sheet */}
      <Sheet open={!!detailAlert} onOpenChange={() => setDetailAlert(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alert Details
            </SheetTitle>
          </SheetHeader>
          {detailAlert && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-2">
                <Badge className={severityColor(detailAlert.severity)} variant="secondary">
                  {detailAlert.severity} severity
                </Badge>
                <Badge variant={detailAlert.status === 'open' ? 'default' : 'secondary'}>
                  {detailAlert.status}
                </Badge>
              </div>

              <div>
                <h4 className="font-semibold mb-1">{detailAlert.ruleLabel}</h4>
                <p className="text-sm text-muted-foreground">{detailAlert.issue}</p>
              </div>

              {(() => {
                const call = mockData.calls.find((c) => c.id === detailAlert.callId);
                if (!call) return null;
                return (
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
                        openCallDetail(call.id);
                        setDetailAlert(null);
                      }}
                    >
                      View Full Call Details
                    </Button>
                  </div>
                );
              })()}

              <div className="flex gap-2">
                {detailAlert.status === 'open' ? (
                  <Button
                    className="flex-1"
                    onClick={() => handleCloseAlert(detailAlert.id)}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Close Alert
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleReopenAlert(detailAlert.id)}
                  >
                    Reopen Alert
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Call Detail Drawer */}
      <CallDetailDrawer
        call={selectedCall}
        open={callDrawerOpen}
        onOpenChange={setCallDrawerOpen}
      />
    </div>
  );
}
