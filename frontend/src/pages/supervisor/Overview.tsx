import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockData } from '@/lib/mock-data';
import { useAppStore } from '@/stores/app-store';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OverviewStats } from './components/OverviewStats';
import { SentimentTrendChart } from './components/SentimentTrendChart';
import { CallVolumeChart } from './components/CallVolumeChart';
import { TopicDistribution } from './components/TopicDistribution';
import { AgentPerformance } from './components/AgentPerformance';
import { RecentAlerts } from './components/RecentAlerts';

export default function SupervisorOverview() {
  const navigate = useNavigate();
  const { alerts, setAlerts } = useAppStore();
  const [dateRange, setDateRange] = useState<'7' | '14' | '30'>('14');

  useEffect(() => {
    if (alerts.length === 0) {
      setAlerts(mockData.alerts);
    }
  }, [alerts.length, setAlerts]);

  const { calls, dailyMetrics, agents } = mockData;

  const cutoffDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(dateRange));
    return d;
  }, [dateRange]);

  const filteredCalls = useMemo(
    () => calls.filter((c) => new Date(c.startedAt) >= cutoffDate),
    [calls, cutoffDate]
  );

  const filteredMetrics = useMemo(
    () => dailyMetrics.filter((m) => new Date(m.date) >= cutoffDate),
    [dailyMetrics, cutoffDate]
  );

  const avgSentiment = useMemo(
    () =>
      filteredCalls.length > 0
        ? filteredCalls.reduce((sum, c) => sum + c.sentimentScore, 0) / filteredCalls.length
        : 0,
    [filteredCalls]
  );

  const negativeCallCount = useMemo(
    () => filteredCalls.filter((c) => c.sentimentLabel === 'negative').length,
    [filteredCalls]
  );

  const negativePercent = useMemo(
    () =>
      filteredCalls.length > 0 ? (negativeCallCount / filteredCalls.length) * 100 : 0,
    [filteredCalls.length, negativeCallCount]
  );

  const openAlerts = useMemo(
    () => alerts.filter((a) => a.status === 'open').length,
    [alerts]
  );

  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCalls.forEach((call) => {
      call.topics.forEach((topic) => {
        counts[topic] = (counts[topic] || 0) + 1;
      });
    });
    return counts;
  }, [filteredCalls]);

  const topTopics = useMemo(
    () =>
      Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, value]) => ({ name: name.replace(/-/g, ' '), value })),
    [topicCounts]
  );

  const sentimentDist = useMemo(
    () => [
      {
        name: 'Positive' as const,
        value: filteredCalls.filter((c) => c.sentimentLabel === 'positive').length,
        color: 'hsl(var(--success))',
      },
      {
        name: 'Neutral' as const,
        value: filteredCalls.filter((c) => c.sentimentLabel === 'neutral').length,
        color: 'hsl(var(--muted-foreground))',
      },
      {
        name: 'Negative' as const,
        value: filteredCalls.filter((c) => c.sentimentLabel === 'negative').length,
        color: 'hsl(var(--destructive))',
      },
    ],
    [filteredCalls]
  );

  const agentStats = useMemo(
    () =>
      agents
        .slice(0, 6)
        .map((agent) => {
          const agentCalls = filteredCalls.filter((c) => c.agentId === agent.id);
          const avgSent =
            agentCalls.length > 0
              ? agentCalls.reduce((sum, c) => sum + c.sentimentScore, 0) / agentCalls.length
              : 0;
          return {
            name: agent.name.split(' ')[0],
            sentiment: parseFloat(avgSent.toFixed(2)),
            calls: agentCalls.length,
          };
        })
        .sort((a, b) => b.sentiment - a.sentiment),
    [agents, filteredCalls]
  );

  const recentAlerts = useMemo(
    () => alerts.filter((a) => a.status === 'open').slice(0, 5),
    [alerts]
  );

  const callsById = useMemo(
    () => Object.fromEntries(calls.map((c) => [c.id, c])),
    [calls]
  );

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex justify-end mb-6">
        <Select value={dateRange} onValueChange={(v) => setDateRange(v as '7' | '14' | '30')}>
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

      <OverviewStats
        avgSentiment={avgSentiment}
        filteredCallCount={filteredCalls.length}
        dateRange={dateRange}
        negativePercent={negativePercent}
        negativeCallCount={negativeCallCount}
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
          <SentimentTrendChart data={filteredMetrics} />
          <CallVolumeChart data={filteredMetrics} />
        </TabsContent>

        <TabsContent value="topics" className="space-y-6">
          <TopicDistribution topTopics={topTopics} sentimentDist={sentimentDist} />
        </TabsContent>

        <TabsContent value="agents">
          <AgentPerformance data={agentStats} />
        </TabsContent>
      </Tabs>

      <RecentAlerts
        alerts={recentAlerts}
        callsById={callsById}
        onViewAll={() => navigate('/supervisor/alerts')}
        onAlertClick={() => navigate('/supervisor/alerts')}
      />
    </div>
  );
}
