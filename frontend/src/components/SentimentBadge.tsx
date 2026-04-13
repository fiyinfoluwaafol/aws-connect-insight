import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SentimentBadgeProps {
  sentiment: 'positive' | 'neutral' | 'negative';
  score?: number;
}

const sentimentLabels: Record<SentimentBadgeProps['sentiment'], string> = {
  positive: 'Positive sentiment',
  neutral: 'Neutral sentiment',
  negative: 'Negative sentiment',
};

export function SentimentBadge({ sentiment, score }: SentimentBadgeProps) {
  const variants = {
    positive: 'bg-success/10 text-success hover:bg-success/20',
    neutral: 'bg-muted text-muted-foreground hover:bg-muted',
    negative: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  };

  const label =
    score !== undefined
      ? `${sentimentLabels[sentiment]}, score ${score > 0 ? '+' : ''}${score.toFixed(2)}`
      : sentimentLabels[sentiment];

  return (
    <Badge
      variant="secondary"
      className={cn("font-medium", variants[sentiment])}
      aria-label={label}
    >
      {sentiment}
      {score !== undefined && ` (${score > 0 ? '+' : ''}${score.toFixed(2)})`}
    </Badge>
  );
}
