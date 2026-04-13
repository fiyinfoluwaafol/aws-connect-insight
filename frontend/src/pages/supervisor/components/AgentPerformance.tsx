import { Card } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface AgentPerformanceDatum {
  name: string;
  sentiment: number;
  calls: number;
}

export interface AgentPerformanceProps {
  data: AgentPerformanceDatum[];
}

export function AgentPerformance({ data }: AgentPerformanceProps) {
  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold">Agent Performance</h3>
        <p className="text-sm text-muted-foreground">
          Average sentiment by agent for the selected period (top agents by volume)
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
        <span>Avg. sentiment (-1 to 1)</span>
      </div>
      <div className="h-[350px] w-full min-w-0" role="img" aria-label="Agent performance bar chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[-1, 1]} />
            <Tooltip
              formatter={(value: number) => [value.toFixed(2), 'Avg. sentiment']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar
              dataKey="sentiment"
              name="Avg. sentiment"
              fill="hsl(var(--primary))"
              radius={[8, 8, 0, 0]}
              isAnimationActive
              animationDuration={800}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
