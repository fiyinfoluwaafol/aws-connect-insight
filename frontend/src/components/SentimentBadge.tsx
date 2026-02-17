import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SentimentBadgeProps {
  sentiment: 'positive' | 'neutral' | 'negative';
  score?: number;
}

export function SentimentBadge({ sentiment, score }: SentimentBadgeProps) {
  const variants = {
    positive: 'bg-success/10 text-success hover:bg-success/20',
    neutral: 'bg-muted text-muted-foreground hover:bg-muted',
    negative: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  };

  return (
    <Badge variant="secondary" className={cn("font-medium", variants[sentiment])}>
      {sentiment}
      {score !== undefined && ` (${score > 0 ? '+' : ''}${score.toFixed(2)})`}
    </Badge>
  );
}
