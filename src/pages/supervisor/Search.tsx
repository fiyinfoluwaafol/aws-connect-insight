import { useState } from 'react';
import { mockData, Call } from '@/lib/mock-data';
import { MockService, SearchResult } from '@/lib/mock-service';
import { SentimentBadge } from '@/components/SentimentBadge';
import { CallDetailDrawer } from '@/components/CallDetailDrawer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Search, Download, Clock, User, Loader2 } from 'lucide-react';

export default function CallSearch() {
  const [keyword, setKeyword] = useState('');
  const [agentId, setAgentId] = useState<string>('all');
  const [sentimentRange, setSentimentRange] = useState<[number, number]>([-1, 1]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSearch = async (page = 1) => {
    setLoading(true);
    try {
      const result = await MockService.searchCalls({
        keyword: keyword || undefined,
        agentId: agentId !== 'all' ? agentId : undefined,
        sentimentMin: sentimentRange[0],
        sentimentMax: sentimentRange[1],
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: 20,
      });
      setResults(result);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!results || results.calls.length === 0) return;

    const data = results.calls.map((call) => ({
      id: call.id,
      agent: call.agentName,
      customer: call.customerName,
      date: new Date(call.startedAt).toLocaleDateString(),
      duration: `${Math.floor(call.durationSec / 60)}:${(call.durationSec % 60).toString().padStart(2, '0')}`,
      sentiment: call.sentimentScore.toFixed(2),
      sentimentLabel: call.sentimentLabel,
      topics: call.topics.join('; '),
      resolved: call.resolved ? 'Yes' : 'No',
    }));

    MockService.exportCSV(data, `call-search-${new Date().toISOString().split('T')[0]}`);
    toast({
      title: 'Export Complete',
      description: `${data.length} calls exported to CSV.`,
    });
  };

  const highlightKeyword = (text: string) => {
    if (!keyword) return text;
    const regex = new RegExp(`(${keyword})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={i} className="bg-warning/30 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getSnippet = (call: Call): string => {
    const summary = MockService.getSummary(call.id);
    if (summary?.transcript) {
      for (const turn of summary.transcript) {
        if (keyword && turn.text.toLowerCase().includes(keyword.toLowerCase())) {
          return turn.text;
        }
      }
      return summary.transcript[0]?.text || '';
    }
    return '';
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Search Filters */}
      <Card className="p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Search Calls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Keyword</Label>
            <Input
              placeholder="Search transcripts, topics..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="space-y-2">
            <Label>Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {mockData.agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>
              Sentiment Range: [{sentimentRange[0].toFixed(1)}, {sentimentRange[1].toFixed(1)}]
            </Label>
            <Slider
              min={-1}
              max={1}
              step={0.1}
              value={sentimentRange}
              onValueChange={(value) => setSentimentRange(value as [number, number])}
              className="py-4"
            />
          </div>
          <div className="space-y-2">
            <Label>From Date</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>To Date</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => handleSearch()} disabled={loading} className="flex-1">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Search
            </Button>
            {results && results.calls.length > 0 && (
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Results */}
      {results && (
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
                  onClick={() => handleSearch(results.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={results.page >= results.totalPages}
                  onClick={() => handleSearch(results.page + 1)}
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
                    onClick={() => {
                      setSelectedCall(call);
                      setDrawerOpen(true);
                    }}
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
      )}

      {/* Empty state */}
      {!results && !loading && (
        <Card className="p-12 text-center">
          <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Search Calls</h3>
          <p className="text-muted-foreground">
            Use the filters above to search through call transcripts, agents, and topics.
          </p>
        </Card>
      )}

      <CallDetailDrawer
        call={selectedCall}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
