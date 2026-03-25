import { useState } from 'react';
import { mockData } from '@/lib/mock-data';
import type { Call } from '@/lib/mock-data';
import { MockService, SearchResult } from '@/lib/mock-service';
import { CallDetailDrawer } from '@/components/CallDetailDrawer';
import { Card } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Search as SearchIcon } from 'lucide-react';
import { SearchFilters } from './components/SearchFilters';
import { SearchResults } from './components/SearchResults';

export default function CallSearch() {
  const [keyword, setKeyword] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [sentimentRange, setSentimentRange] = useState<[number, number]>([-1, 1]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleAgentToggle = (agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId)
        ? prev.filter((id) => id !== agentId)
        : [...prev, agentId]
    );
  };

  const clearAgentSelection = () => {
    setSelectedAgentIds([]);
  };

  const handleSearch = async (page = 1) => {
    setLoading(true);
    try {
      const result = await MockService.searchCalls({
        keyword: keyword || undefined,
        agentIds: selectedAgentIds.length > 0 ? selectedAgentIds : undefined,
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

  const selectedAgentNames = selectedAgentIds
    .map((id) => mockData.agents.find((a) => a.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  return (
    <div className="container mx-auto px-6 py-8">
      <SearchFilters
        keyword={keyword}
        selectedAgentIds={selectedAgentIds}
        selectedAgentNames={selectedAgentNames}
        agents={mockData.agents}
        sentimentRange={sentimentRange}
        dateFrom={dateFrom}
        dateTo={dateTo}
        loading={loading}
        canExport={!!(results && results.calls.length > 0)}
        onKeywordChange={setKeyword}
        onAgentToggle={handleAgentToggle}
        onClearAgents={clearAgentSelection}
        onSentimentRangeChange={setSentimentRange}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onSearch={() => handleSearch()}
        onExportCSV={handleExportCSV}
      />

      {results && (
        <SearchResults
          results={results}
          keyword={keyword}
          loading={loading}
          onPageChange={handleSearch}
          onSelectCall={(call) => {
            setSelectedCall(call);
            setDrawerOpen(true);
          }}
          getSnippet={getSnippet}
          highlightKeyword={highlightKeyword}
          formatDuration={formatDuration}
        />
      )}

      {!results && !loading && (
        <Card className="p-12 text-center">
          <SearchIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
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
