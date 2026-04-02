import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { mockData } from '@/lib/mock-data';
import { dashboardApi } from '@/lib/api';
import { useAppStore } from '@/stores/app-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OverviewStats } from './components/OverviewStats';
import { SentimentTrendChart } from './components/SentimentTrendChart';
import { CallVolumeChart } from './components/CallVolumeChart';
import { TopicDistribution } from './components/TopicDistribution';
import { AgentPerformance } from './components/AgentPerformance';
import { RecentAlerts } from './components/RecentAlerts';

type DateRangeOption = '7' | '14' | '30';

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </Card>
        ))}
      </div>
      {/* Chart skeleton */}
      <Card className="p-6">
        <Skeleton className="h-6 w-40 mb-4" />
        <Skeleton className="h-[300px] w-full" />
      </Card>
    </div>
  );
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
  const { alerts, setAlerts } = useAppStore();
  const [dateRange, setDateRange] = useState<DateRangeOption>('14');

  // Fetch dashboard data from API
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

  // Initialize alerts from mock data if empty (alerts are managed separately)
  useEffect(() => {
    if (alerts.length === 0) {
      setAlerts(mockData.alerts);
    }
  }, [alerts.length, setAlerts]);

  // Computed values from alerts (not from API)
  const openAlerts = useMemo(
    () => alerts.filter((a) => a.status === 'open').length,
    [alerts]
  );

  const recentAlerts = useMemo(
    () => alerts.filter((a) => a.status === 'open').slice(0, 5),
    [alerts]
  );

  // Call lookup for alert details (still using mock for now)
  const callsById = useMemo(
    () => Object.fromEntries(mockData.calls.map((c) => [c.id, c])),
    []
  );

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex justify-end mb-6">
        <Select
          value={dateRange}
          onValueChange={(v) => setDateRange(v as DateRangeOption)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError && <ErrorState error={error as Error} onRetry={() => refetch()} />}

      {isLoading ? (
        <OverviewSkeleton />
      ) : dashboardData ? (
        <>
          <OverviewStats
            avgSentiment={dashboardData.avgSentiment}
            filteredCallCount={dashboardData.totalCalls}
            dateRange={dateRange}
            negativePercent={dashboardData.negativePercent}
            negativeCallCount={dashboardData.negativeCallCount}
            openAlerts={openAlerts}
            totalAlerts={alerts.length}
          />

          <Tabs defaultValue="trends" className="space-y-6">
            <TabsList>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="topics">Topics</TabsTrigger>
              <TabsTrigger value="agents">Agents</TabsTrigger>
            </TabsList>

            <TabsContent value="trends" className="space-y-6">
              <SentimentTrendChart data={dashboardData.dailyMetrics} />
              <CallVolumeChart data={dashboardData.dailyMetrics} />
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

      <RecentAlerts
        alerts={recentAlerts}
        callsById={callsById}
        onViewAll={() => navigate('/supervisor/alerts')}
        onAlertClick={() => navigate('/supervisor/alerts')}
      />
    </div>
  );
}
