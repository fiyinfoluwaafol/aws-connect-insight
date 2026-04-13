import { StatCard } from '@/components/StatCard';
import { TrendingUp, AlertTriangle, Phone } from 'lucide-react';

export type DateRangeOption = '7' | '14' | '30';

export interface StatTrend {
  value: number;
  label: string;
  format: 'percent' | 'points';
}

export interface OverviewStatsProps {
  avgSentiment: number;
  filteredCallCount: number;
  dateRange: DateRangeOption;
  negativePercent: number;
  negativeCallCount: number;
  openAlerts: number;
  totalAlerts: number;
  sentimentTrend?: StatTrend;
  negativeTrend?: StatTrend;
}

export function OverviewStats({
  avgSentiment,
  filteredCallCount,
  dateRange,
  negativePercent,
  negativeCallCount,
  openAlerts,
  totalAlerts,
  sentimentTrend,
  negativeTrend,
}: OverviewStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        title="Average Sentiment"
        value={avgSentiment.toFixed(2)}
        subtitle={`Across ${filteredCallCount} calls`}
        icon={TrendingUp}
        variant={avgSentiment > 0.3 ? 'success' : avgSentiment < -0.2 ? 'destructive' : 'default'}
        trend={sentimentTrend}
        emphasis
      />
      <StatCard
        title="Call Volume"
        value={filteredCallCount}
        subtitle={`Last ${dateRange} days`}
        icon={Phone}
        variant="default"
      />
      <StatCard
        title="Negative Calls"
        value={`${negativePercent.toFixed(1)}%`}
        subtitle={`${negativeCallCount} calls`}
        icon={AlertTriangle}
        variant="warning"
        trend={negativeTrend}
        trendPolarity="lower_is_better"
      />
      <StatCard
        title="Open Alerts"
        value={openAlerts}
        subtitle={`${totalAlerts} total alerts`}
        icon={AlertTriangle}
        variant={openAlerts > 10 ? 'destructive' : 'warning'}
        emphasis
      />
    </div>
  );
}
