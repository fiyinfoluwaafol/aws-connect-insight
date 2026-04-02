import { useMemo, useState } from 'react';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { alertsApi, callsApi, type SupervisorAlertSeverity, type SupervisorAlertStatus } from '@/lib/api';
import {
  mapAlertRecordToViewModel,
  mapCallDetailToViewModel,
  type SupervisorAlertViewModel,
  type SupervisorCallViewModel,
} from '@/lib/supervisor-alerts';
import { CallDetailDrawer } from '@/components/CallDetailDrawer';
import { toast } from '@/hooks/use-toast';
import { AlertTable } from './components/AlertTable';
import { AlertDetail } from './components/AlertDetail';

export default function AlertsCenter() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailAlert, setDetailAlert] = useState<SupervisorAlertViewModel | null>(null);
  const [callDrawerOpen, setCallDrawerOpen] = useState(false);
  const [selectedCall, setSelectedCall] = useState<SupervisorCallViewModel | null>(null);

  const {
    data: alertsResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['alerts', 'list', statusFilter, severityFilter],
    queryFn: () =>
      alertsApi.listAlerts({
        status:
          statusFilter === 'all'
            ? undefined
            : (statusFilter as SupervisorAlertStatus),
        severity:
          severityFilter === 'all'
            ? undefined
            : (severityFilter as SupervisorAlertSeverity),
        page: 1,
        per_page: 100,
    }),
    staleTime: 30 * 1000,
    refetchInterval: 10 * 1000,
    retry: 1,
  });

  const { data: openAlertsResponse } = useQuery({
    queryKey: ['alerts', 'open-count'],
    queryFn: () => alertsApi.listAlerts({ status: 'open', page: 1, per_page: 1 }),
    staleTime: 30 * 1000,
    refetchInterval: 10 * 1000,
    retry: 1,
  });

  const alerts = useMemo(
    () => (alertsResponse?.alerts ?? []).map(mapAlertRecordToViewModel),
    [alertsResponse]
  );

  const callIds = useMemo(
    () =>
      Array.from(
        new Set(
          alerts
            .map((alert) => alert.callId)
            .filter((callId): callId is string => Boolean(callId))
        )
      ),
    [alerts]
  );

  const callQueries = useQueries({
    queries: callIds.map((callId) => ({
      queryKey: ['calls', 'detail', callId],
      queryFn: () => callsApi.getCallById(callId),
      staleTime: 30 * 1000,
      retry: 1,
    })),
  });

  const callsById = useMemo(
    () =>
      Object.fromEntries(
        callQueries
          .filter((query) => query.data)
          .map((query) => {
            const call = mapCallDetailToViewModel(query.data!);
            return [call.id, call];
          })
      ),
    [callQueries]
  );

  const updateAlertMutation = useMutation({
    mutationFn: ({ alertId, patch }: { alertId: string; patch: { status?: 'open' | 'closed'; is_read?: boolean } }) =>
      alertsApi.updateAlert(alertId, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });

  const openAlertsCount = openAlertsResponse?.total ?? 0;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(alerts.map((alert) => alert.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    }
  };

  const handleCloseSelected = async () => {
    await Promise.all(
      selectedIds.map((id) =>
        updateAlertMutation.mutateAsync({ alertId: id, patch: { status: 'closed' } })
      )
    );

    toast({
      title: 'Alerts Closed',
      description: `${selectedIds.length} alert(s) have been closed.`,
    });
    setSelectedIds([]);
    if (detailAlert && selectedIds.includes(detailAlert.id)) {
      setDetailAlert(null);
    }
  };

  const handleCloseAlert = async (id: string) => {
    await updateAlertMutation.mutateAsync({ alertId: id, patch: { status: 'closed' } });
    toast({
      title: 'Alert Closed',
      description: 'The alert has been marked as closed.',
    });
    setDetailAlert((prev) => (prev && prev.id === id ? { ...prev, status: 'closed' } : prev));
  };

  const handleReopenAlert = async (id: string) => {
    await updateAlertMutation.mutateAsync({ alertId: id, patch: { status: 'open' } });
    toast({
      title: 'Alert Reopened',
      description: 'The alert has been reopened.',
    });
    setDetailAlert((prev) => (prev && prev.id === id ? { ...prev, status: 'open' } : prev));
  };

  const openCallDetail = (callId: string) => {
    const call = callsById[callId];
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

  const detailCall = detailAlert?.callId ? callsById[detailAlert.callId] : undefined;

  return (
    <div className="container mx-auto px-6 py-8">
      {isError && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load alerts.
        </div>
      )}

      <AlertTable
        alerts={alerts}
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
        onCloseSelected={() => void handleCloseSelected()}
        severityClassName={severityColor}
      />

      {isLoading && (
        <div className="mt-4 text-sm text-muted-foreground">Loading alerts...</div>
      )}

      <AlertDetail
        alert={detailAlert}
        call={detailCall}
        onClose={() => setDetailAlert(null)}
        onOpenCall={openCallDetail}
        onCloseAlert={(id) => void handleCloseAlert(id)}
        onReopenAlert={(id) => void handleReopenAlert(id)}
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
