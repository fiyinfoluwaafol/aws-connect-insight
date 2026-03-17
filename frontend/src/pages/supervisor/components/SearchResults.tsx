import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SentimentBadge } from '@/components/SentimentBadge';
import { User, Clock } from 'lucide-react';
import type { Call } from '@/lib/mock-data';
import type { SearchResult } from '@/lib/mock-service';

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

export function SearchResults({
  results,
  onPageChange,
  onSelectCall,
  getSnippet,
  highlightKeyword,
  formatDuration,
}: SearchResultsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
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
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No calls match your search criteria.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {results.calls.map((call) => {
            const snippet = getSnippet(call);
            return (
              <Card
                key={call.id}
                className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => onSelectCall(call)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <SentimentBadge sentiment={call.sentimentLabel} />
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {call.agentName}
                      </span>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
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
                    <p className="text-lg font-semibold">{call.sentimentScore.toFixed(2)}</p>
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
