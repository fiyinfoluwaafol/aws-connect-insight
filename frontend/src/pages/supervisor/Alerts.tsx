import { useState, useEffect, useMemo } from 'react';
import { mockData } from '@/lib/mock-data';
import type { Call } from '@/lib/mock-data';
import { useAppStore } from '@/stores/app-store';
import { CallDetailDrawer } from '@/components/CallDetailDrawer';
import { toast } from '@/hooks/use-toast';
import { AlertTable } from './components/AlertTable';
import { AlertDetail } from './components/AlertDetail';

export default function AlertsCenter() {
  const { alerts, setAlerts, updateAlert } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailAlert, setDetailAlert] = useState<(typeof alerts)[0] | null>(null);
  const [callDrawerOpen, setCallDrawerOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  useEffect(() => {
    if (alerts.length === 0) {
      setAlerts(mockData.alerts);
    }
  }, [alerts.length, setAlerts]);

  const filteredAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
        if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
        return true;
      }),
    [alerts, statusFilter, severityFilter]
  );

  const callsById = useMemo(
    () => Object.fromEntries(mockData.calls.map((c) => [c.id, c])),
    []
  );

  const openAlertsCount = useMemo(
    () => alerts.filter((a) => a.status === 'open').length,
    [alerts]
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredAlerts.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
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

  const detailCall = detailAlert ? callsById[detailAlert.callId] : undefined;

  return (
    <div className="container mx-auto px-6 py-8">
      <AlertTable
        alerts={filteredAlerts}
        callsById={callsById}
        statusFilter={statusFilter}
        severityFilter={severityFilter}
        selectedIds={selectedIds}
        openAlertsCount={openAlertsCount}
        onStatusFilterChange={setStatusFilter}
        onSeverityFilterChange={setSeverityFilter}
        onSelectAll={handleSelectAll}
        onSelectRow={handleSelect}
        onOpenDetail={setDetailAlert}
        onOpenCall={openCallDetail}
        onCloseSelected={handleCloseSelected}
        severityClassName={severityColor}
      />

      <AlertDetail
        alert={detailAlert}
        call={detailCall}
        onClose={() => setDetailAlert(null)}
        onOpenCall={openCallDetail}
        onCloseAlert={handleCloseAlert}
        onReopenAlert={handleReopenAlert}
        severityClassName={severityColor}
      />

      <CallDetailDrawer
        call={selectedCall}
        open={callDrawerOpen}
        onOpenChange={setCallDrawerOpen}
      />
    </div>
  );
}
