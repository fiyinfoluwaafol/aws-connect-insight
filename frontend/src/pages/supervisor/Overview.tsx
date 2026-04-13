import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { alertsApi, callsApi, dashboardApi, type DailyMetric } from '@/lib/api';
import { mapAlertRecordToViewModel, mapCallDetailToViewModel } from '@/lib/supervisor-alerts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { PageSkeleton } from '@/components/PageSkeleton';
import { pageShellClassName } from '@/lib/page-animation';
import { OverviewStats, type StatTrend } from './components/OverviewStats';
import { SentimentTrendChart } from './components/SentimentTrendChart';
import { CallVolumeChart } from './components/CallVolumeChart';
import { TopicDistribution } from './components/TopicDistribution';
import { AgentPerformance } from './components/AgentPerformance';
import { RecentAlerts } from './components/RecentAlerts';

type DateRangeOption = '7' | '14' | '30';

function computeHalfOverHalfTrend(
  daily: DailyMetric[],
  key: 'avgSentiment' | 'negativePercent'
): StatTrend | undefined {
  if (daily.length < 2) return undefined;
  const mid = Math.floor(daily.length / 2);
  const first = daily.slice(0, mid);
  const second = daily.slice(mid);
  const mean = (arr: DailyMetric[], k: typeof key) =>
    arr.reduce((s, m) => s + m[k], 0) / arr.length;
  const delta = mean(second, key) - mean(first, key);
  if (key === 'avgSentiment') {
    return { value: delta, label: 'vs prior period', format: 'points' };
  }
  return { value: delta, label: 'vs prior period', format: 'percent' };
}

interface ErrorStateProps {
  error: Error;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Failed to load dashboard data</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{error.message}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export default function SupervisorOverview() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRangeOption>('14');

  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'trends', dateRange],
    queryFn: () => dashboardApi.getTrendsTransformed(parseInt(dateRange)),
    staleTime: 30 * 1000,
    retry: 1,
  });

  const {
    data: recentAlertsResponse,
    isLoading: isRecentAlertsLoading,
    isError: isRecentAlertsError,
    error: recentAlertsError,
    refetch: refetchRecentAlerts,
  } = useQuery({
    queryKey: ['alerts', 'recent-open'],
    queryFn: () => alertsApi.listAlerts({ status: 'open', page: 1, per_page: 5 }),
    staleTime: 30 * 1000,
    refetchInterval: 10 * 1000,
    retry: 1,
  });

  const {
    data: totalAlertsResponse,
    isLoading: isTotalAlertsLoading,
    isError: isTotalAlertsError,
    error: totalAlertsError,
    refetch: refetchTotalAlerts,
  } = useQuery({
    queryKey: ['alerts', 'total-count'],
    queryFn: () => alertsApi.listAlerts({ page: 1, per_page: 1 }),
    staleTime: 30 * 1000,
    refetchInterval: 10 * 1000,
    retry: 1,
  });

  const recentAlerts = useMemo(
    () => (recentAlertsResponse?.alerts ?? []).map(mapAlertRecordToViewModel),
    [recentAlertsResponse]
  );

  const callIds = useMemo(
    () =>
      Array.from(
        new Set(
          recentAlerts
            .map((alert) => alert.callId)
            .filter((callId): callId is string => Boolean(callId))
        )
      ),
    [recentAlerts]
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

  const alertsError = (recentAlertsError || totalAlertsError) as Error | null;
  const alertsRefetch = () => {
    void refetchRecentAlerts();
    void refetchTotalAlerts();
  };
  const openAlerts = recentAlertsResponse?.total ?? 0;
  const totalAlerts = totalAlertsResponse?.total ?? 0;
  const alertsLoading = isRecentAlertsLoading || isTotalAlertsLoading;
  const alertsFailed = isRecentAlertsError || isTotalAlertsError;

  const sentimentTrend = useMemo(
    () =>
      dashboardData?.dailyMetrics
        ? computeHalfOverHalfTrend(dashboardData.dailyMetrics, 'avgSentiment')
        : undefined,
    [dashboardData?.dailyMetrics]
  );

  const negativeTrend = useMemo(
    () =>
      dashboardData?.dailyMetrics
        ? computeHalfOverHalfTrend(dashboardData.dailyMetrics, 'negativePercent')
        : undefined,
    [dashboardData?.dailyMetrics]
  );

  const dateRangeActions = (
    <div className="flex flex-col gap-1.5 sm:items-end">
      <span id="overview-range-label" className="text-xs font-medium text-muted-foreground">
        Reporting period
      </span>
      <Select
        value={dateRange}
        onValueChange={(v) => setDateRange(v as DateRangeOption)}
      >
        <SelectTrigger className="w-40" aria-labelledby="overview-range-label">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="14">Last 14 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className={pageShellClassName()}>
      <PageHeader
        title="Overview"
        description="Real-time insights across your team"
        actions={dateRangeActions}
      />

      {(isError || alertsFailed) && (
        <ErrorState
          error={(error as Error) || alertsError || new Error('Failed to load alert data')}
          onRetry={() => {
            void refetch();
            alertsRefetch();
          }}
        />
      )}

      {isLoading || alertsLoading ? (
        <div className="space-y-6">
          <PageSkeleton variant="stats" />
          <PageSkeleton variant="chart" />
        </div>
      ) : dashboardData ? (
        <>
          <OverviewStats
            avgSentiment={dashboardData.avgSentiment}
            filteredCallCount={dashboardData.totalCalls}
            dateRange={dateRange}
            negativePercent={dashboardData.negativePercent}
            negativeCallCount={dashboardData.negativeCallCount}
            openAlerts={openAlerts}
            totalAlerts={totalAlerts}
            sentimentTrend={sentimentTrend}
            negativeTrend={negativeTrend}
          />

          <Separator className="mb-6" />

          <Tabs defaultValue="trends" className="space-y-6">
            <TabsList>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="topics">Topics</TabsTrigger>
              <TabsTrigger value="agents">Agents</TabsTrigger>
            </TabsList>

            <TabsContent value="trends" className="space-y-6">
              <SentimentTrendChart data={dashboardData.dailyMetrics} />
              <CallVolumeChart data={dashboardData.dailyMetrics} />
              <div className="pt-2">
                <h2 className="text-sm font-medium text-muted-foreground mb-4">
                  Recent activity
                </h2>
                <RecentAlerts
                  alerts={recentAlerts}
                  callsById={callsById}
                  onViewAll={() => navigate('/supervisor/alerts')}
                  onAlertClick={() => navigate('/supervisor/alerts')}
                />
              </div>
            </TabsContent>

            <TabsContent value="topics" className="space-y-6">
              <TopicDistribution
                topTopics={dashboardData.topTopics}
                sentimentDist={dashboardData.sentimentDist}
              />
            </TabsContent>

            <TabsContent value="agents">
              <AgentPerformance data={dashboardData.agentStats} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
