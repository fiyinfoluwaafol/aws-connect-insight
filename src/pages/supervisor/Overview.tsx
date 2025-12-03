import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockData } from '@/lib/mock-data';
import { useAppStore } from '@/stores/app-store';
import { StatCard } from '@/components/StatCard';
import { SentimentBadge } from '@/components/SentimentBadge';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  AlertTriangle,
  Phone,
  Users,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export default function SupervisorOverview() {
  const navigate = useNavigate();
  const { alerts, setAlerts } = useAppStore();
  const [dateRange, setDateRange] = useState('14');

  // Initialize alerts from mock data if empty
  useEffect(() => {
    if (alerts.length === 0) {
      setAlerts(mockData.alerts);
    }
  }, [alerts.length, setAlerts]);

  const { calls, dailyMetrics, agents } = mockData;
  
  // Filter by date range
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));
  const filteredCalls = calls.filter(c => new Date(c.startedAt) >= cutoffDate);
  const filteredMetrics = dailyMetrics.filter(m => new Date(m.date) >= cutoffDate);

  // Calculate overview stats
  const avgSentiment = filteredCalls.reduce((sum, c) => sum + c.sentimentScore, 0) / filteredCalls.length;
  const negativePercent = (filteredCalls.filter(c => c.sentimentLabel === 'negative').length / filteredCalls.length) * 100;
  const openAlerts = alerts.filter(a => a.status === 'open').length;

  // Topic distribution
  const topicCounts: Record<string, number> = {};
  filteredCalls.forEach(call => {
    call.topics.forEach(topic => {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });
  });
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name: name.replace(/-/g, ' '), value }));

  // Sentiment distribution
  const sentimentDist = [
    { name: 'Positive', value: filteredCalls.filter(c => c.sentimentLabel === 'positive').length, color: 'hsl(var(--success))' },
    { name: 'Neutral', value: filteredCalls.filter(c => c.sentimentLabel === 'neutral').length, color: 'hsl(var(--muted-foreground))' },
    { name: 'Negative', value: filteredCalls.filter(c => c.sentimentLabel === 'negative').length, color: 'hsl(var(--destructive))' },
  ];

  // Agent performance
  const agentStats = agents.slice(0, 6).map(agent => {
    const agentCalls = filteredCalls.filter(c => c.agentId === agent.id);
    const avgSent = agentCalls.length > 0
      ? agentCalls.reduce((sum, c) => sum + c.sentimentScore, 0) / agentCalls.length
      : 0;
    return {
      name: agent.name.split(' ')[0],
      sentiment: parseFloat(avgSent.toFixed(2)),
      calls: agentCalls.length,
    };
  }).sort((a, b) => b.sentiment - a.sentiment);

  // Recent alerts
  const recentAlerts = alerts.filter(a => a.status === 'open').slice(0, 5);

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Date Range Selector */}
      <div className="flex justify-end mb-6">
        <Select value={dateRange} onValueChange={setDateRange}>
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

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Average Sentiment"
          value={avgSentiment.toFixed(2)}
          subtitle={`Across ${filteredCalls.length} calls`}
          icon={TrendingUp}
          variant={avgSentiment > 0.3 ? 'success' : avgSentiment < -0.2 ? 'destructive' : 'default'}
        />
        <StatCard
          title="Call Volume"
          value={filteredCalls.length}
          subtitle={`Last ${dateRange} days`}
          icon={Phone}
          variant="default"
        />
        <StatCard
          title="Negative Calls"
          value={`${negativePercent.toFixed(1)}%`}
          subtitle={`${filteredCalls.filter(c => c.sentimentLabel === 'negative').length} calls`}
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          title="Open Alerts"
          value={openAlerts}
          subtitle={`${alerts.length} total alerts`}
          icon={AlertTriangle}
          variant={openAlerts > 10 ? 'destructive' : 'warning'}
        />
      </div>

      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold">Sentiment Trend</h3>
                <p className="text-sm text-muted-foreground">Daily average sentiment scores</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={filteredMetrics}>
                <defs>
                  <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[-1, 1]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="avgSentiment"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#sentimentGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">Call Volume</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={filteredMetrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line type="monotone" dataKey="callCount" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ fill: 'hsl(var(--accent))' }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="topics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">Top Call Topics</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topTopics} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-6">Sentiment Distribution</h3>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={sentimentDist}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    dataKey="value"
                  >
                    {sentimentDist.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agents">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-6">Agent Performance</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={agentStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[-1, 1]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="sentiment" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Alerts */}
      <Card className="mt-8 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Recent Alerts</h3>
            <p className="text-sm text-muted-foreground">High-priority issues requiring attention</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/supervisor/alerts')}>
            View All
            <ArrowUpRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
        <div className="space-y-4">
          {recentAlerts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No open alerts</p>
          ) : (
            recentAlerts.map((alert) => {
              const call = calls.find((c) => c.id === alert.callId);
              return (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card/50 hover:bg-card transition-colors cursor-pointer"
                  onClick={() => navigate('/supervisor/alerts')}
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
    </div>
  );
}
