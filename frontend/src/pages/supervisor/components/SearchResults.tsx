import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { SentimentBadge } from '@/components/SentimentBadge';
import { EmptyState } from '@/components/EmptyState';
import { User, Clock, Search } from 'lucide-react';
import type { Call } from '@/lib/mock-data';
import type { SearchResult } from '@/lib/mock-service';
import { cn } from '@/lib/utils';

export interface SearchResultsProps {
  results: SearchResult;
  keyword: string;
  loading: boolean;
  onPageChange: (page: number) => void;
  onSelectCall: (call: Call) => void;
  getSnippet: (call: Call) => string;
  highlightKeyword: (text: string) => React.ReactNode;
  formatDuration: (seconds: number) => string;
}

function sentimentAccentClass(sentiment: Call['sentimentLabel']) {
  switch (sentiment) {
    case 'positive':
      return 'border-l-success';
    case 'negative':
      return 'border-l-destructive';
    default:
      return 'border-l-muted-foreground/60';
  }
}

function SearchResultSkeleton() {
  return (
    <Card className="p-4 border-l-4 border-l-muted">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-3 w-full max-w-lg" />
          <Skeleton className="h-3 w-2/3 max-w-md" />
        </div>
        <Skeleton className="h-8 w-12 shrink-0" />
      </div>
    </Card>
  );
}

export function SearchResults({
  results,
  loading,
  onPageChange,
  onSelectCall,
  getSnippet,
  highlightKeyword,
  formatDuration,
}: SearchResultsProps) {
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading search results">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <SearchResultSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Found {results.total} calls (page {results.page} of {results.totalPages})
        </p>
        {results.totalPages > 1 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={results.page <= 1}
              onClick={() => onPageChange(results.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={results.page >= results.totalPages}
              onClick={() => onPageChange(results.page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {results.calls.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching calls"
          description="Try broadening your keywords, adjusting the sentiment range, or changing the date filters."
        />
      ) : (
        <div className="space-y-3">
          {results.calls.map((call) => {
            const snippet = getSnippet(call);
            return (
              <Card
                key={call.id}
                className={cn(
                  'p-4 pl-5 border-l-4 shadow-sm transition-colors hover:bg-muted/50 cursor-pointer',
                  sentimentAccentClass(call.sentimentLabel)
                )}
                onClick={() => onSelectCall(call)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectCall(call);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Open call from ${call.agentName}, sentiment ${call.sentimentLabel}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                      <SentimentBadge sentiment={call.sentimentLabel} />
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3 shrink-0" aria-hidden />
                        {call.agentName}
                      </span>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" aria-hidden />
                        {formatDuration(call.durationSec)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(call.startedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {call.topics.map((topic) => (
                        <Badge key={topic} variant="secondary" className="text-xs">
                          {highlightKeyword(topic.replace(/-/g, ' '))}
                        </Badge>
                      ))}
                    </div>
                    {snippet && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {highlightKeyword(snippet)}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={cn(
                        'text-lg font-semibold',
                        call.sentimentLabel === 'negative' && 'text-destructive',
                        call.sentimentLabel === 'positive' && 'text-success'
                      )}
                    >
                      {call.sentimentScore.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">sentiment</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
