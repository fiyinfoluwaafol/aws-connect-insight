import { Card } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DailyMetric } from '@/lib/api';

export interface SentimentTrendChartProps {
  data: DailyMetric[];
}

export function SentimentTrendChart({ data }: SentimentTrendChartProps) {
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Sentiment Trend</h3>
          <p className="text-sm text-muted-foreground">
            Daily average sentiment scores across the selected period
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
          <span>Avg. sentiment</span>
        </div>
      </div>
      <div className="h-[280px] w-full min-w-0" role="img" aria-label="Sentiment trend area chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              tickFormatter={(date) =>
                new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
            />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[-1, 1]} />
            <Tooltip
              labelFormatter={(label) =>
                new Date(String(label)).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })
              }
              formatter={(value: number) => [value.toFixed(2), 'Avg. sentiment']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Area
              type="monotone"
              dataKey="avgSentiment"
              name="Avg. sentiment"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#sentimentGradient)"
              isAnimationActive
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
