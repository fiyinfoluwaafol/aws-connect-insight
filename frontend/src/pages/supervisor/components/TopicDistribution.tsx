import { Card } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export interface TopicDatum {
  name: string;
  value: number;
}

export interface SentimentDatum {
  name: 'Positive' | 'Neutral' | 'Negative';
  value: number;
  color: string;
}

export interface TopicDistributionProps {
  topTopics: TopicDatum[];
  sentimentDist: SentimentDatum[];
}

export function TopicDistribution({ topTopics, sentimentDist }: TopicDistributionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold">Top Call Topics</h3>
          <p className="text-sm text-muted-foreground">
            Most frequent topics surfaced from transcripts in this period
          </p>
        </div>
        <div className="h-[350px] w-full min-w-0" role="img" aria-label="Top topics horizontal bar chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topTopics} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                type="category"
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={120}
              />
              <Tooltip
                formatter={(value: number) => [value, 'Calls']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend formatter={() => 'Call count'} />
              <Bar
                dataKey="value"
                name="Calls"
                fill="hsl(var(--primary))"
                radius={[0, 8, 8, 0]}
                isAnimationActive
                animationDuration={800}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold">Sentiment Distribution</h3>
          <p className="text-sm text-muted-foreground">
            Share of calls by automated sentiment classification
          </p>
        </div>
        <div className="h-[350px] w-full min-w-0" role="img" aria-label="Sentiment distribution pie chart">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sentimentDist}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                dataKey="value"
                isAnimationActive
                animationDuration={800}
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
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
