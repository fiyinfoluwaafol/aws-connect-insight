import { useState, useEffect } from 'react';
import { agentApi, PerformanceResponse } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Phone, Users, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function AgentPerformance() {
  const [performance, setPerformance] = useState<PerformanceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPerformance = async () => {
      try {
        setLoading(true);
        const data = await agentApi.getPerformance();
        setPerformance(data);
      } catch (error) {
        console.error('Failed to load performance data:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load performance data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadPerformance();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!performance) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center py-12 text-muted-foreground">
          <p>No performance data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <h2 className="text-xl font-semibold mb-6">Your Performance</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6 text-center">
          <Phone className="h-8 w-8 mx-auto mb-2 text-primary" />
          <p className="text-3xl font-bold">{performance.total_calls}</p>
          <p className="text-sm text-muted-foreground">Calls This Week</p>
        </Card>
        <Card className="p-6 text-center">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 text-success" />
          <p className="text-3xl font-bold">{performance.avg_sentiment.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">Avg Sentiment</p>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Team Percentile</span>
          </div>
          <p className="text-3xl font-bold mb-2">{performance.percentile}%</p>
          <Progress value={performance.percentile} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">
            You're outperforming {performance.percentile}% of your team
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sentiment Trend Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Weekly Sentiment Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performance.weekly_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="day"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                domain={[-1, 1]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [value.toFixed(2), 'Sentiment']}
              />
              <Line
                type="monotone"
                dataKey="sentiment"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Call Volume Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Weekly Call Volume</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performance.weekly_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="day"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [value, 'Calls']}
              />
              <Bar
                dataKey="calls"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Comparison Section */}
      <Card className="p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Team Comparison</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Your Average Sentiment</span>
              <span className="font-medium">{performance.avg_sentiment.toFixed(2)}</span>
            </div>
            <Progress
              value={(performance.avg_sentiment + 1) * 50}
              className="h-2"
            />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Team 25th Percentile</span>
              <span className="text-muted-foreground">-0.15</span>
            </div>
            <Progress value={42.5} className="h-2 opacity-50" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Team 50th Percentile</span>
              <span className="text-muted-foreground">0.20</span>
            </div>
            <Progress value={60} className="h-2 opacity-50" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">Team 75th Percentile</span>
              <span className="text-muted-foreground">0.45</span>
            </div>
            <Progress value={72.5} className="h-2 opacity-50" />
          </div>
        </div>
      </Card>
    </div>
  );
}
