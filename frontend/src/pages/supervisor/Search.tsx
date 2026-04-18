import { useState, useEffect } from 'react';
import type { Call } from '@/lib/mock-data';
import { exportCSV } from '@/lib/export';
import { MockService, SearchResult } from '@/lib/mock-service';
import { callsApi, teamsApi, alertsApi, AgentInfo } from '@/lib/api';
import { CallDetailDrawer, CallDetailCall } from '@/components/CallDetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { PageSkeleton } from '@/components/PageSkeleton';
import { toast } from '@/hooks/use-toast';
import { pageShellClassName } from '@/lib/page-animation';
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
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);

  useEffect(() => {
    teamsApi.getMembers().then(res => {
      setAgents(res.members || []);
    }).catch(err => console.error('Failed to load agents:', err));
  }, []);

  const handleCreateAlert = async (callId: string) => {
    setIsCreatingAlert(true);
    try {
      const createdAlert = await alertsApi.createManualAlert({ call_id: callId });
      setSelectedCall((prev) =>
        prev && prev.id === callId
          ? { ...prev, hasOpenAlert: true, openAlertId: createdAlert.id } as Call
          : prev
      );
      toast({
        title: 'Alert Created',
        description: 'The call has been flagged for manual review.',
      });
    } catch (err) {
      console.error('Failed to create manual alert', err);
      toast({
        title: 'Error',
        description: 'Failed to flag call.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingAlert(false);
    }
  };

  const handleAgentToggle = (agentId: string) => {
    setSelectedAgentIds((prev) =>
      prev.includes(agentId) ? [] : [agentId]
    );
  };

  const clearAgentSelection = () => {
    setSelectedAgentIds([]);
  };

  const handleSearch = async (page = 1) => {
    setLoading(true);
    try {
      const agentIdParam = selectedAgentIds.length > 0 ? selectedAgentIds[0] : undefined;
      
      const data = await callsApi.searchCalls({
        q: keyword || undefined,
        agent_id: agentIdParam,
        sentiment_min: sentimentRange[0],
        sentiment_max: sentimentRange[1],
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        per_page: 20,
      });

      const mappedResult: SearchResult = {
        calls: data.calls.map((c) => ({
          id: c.id,
          agentId: c.agent_id,
          agentName: c.agent_name || 'Unknown',
          startedAt: c.started_at || new Date().toISOString(),
          durationSec: c.duration_seconds || 0,
          sentimentScore: c.sentiment_score || 0,
          sentimentLabel: (c.sentiment_label as 'positive' | 'neutral' | 'negative') || 'neutral',
          topics: c.topics || [],
          resolved: false,
          csat: null,
          customerName: 'Unknown Customer',
          summaryStr: c.summary,
        } as unknown as Call)),
        total: data.total,
        page: data.page,
        pageSize: data.per_page,
        totalPages: Math.ceil(data.total / data.per_page) || 1,
      };
      
      setResults(mappedResult);
    } catch (error) {
      console.error('Search error:', error);
      toast({
        title: 'Error',
        description: 'Failed to search calls.',
        variant: 'destructive',
      });
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

    exportCSV(data, `call-search-${new Date().toISOString().split('T')[0]}`);
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
    const extendedCall = call as Call & { summaryStr?: string };
    if (extendedCall.summaryStr) {
      return extendedCall.summaryStr;
    }
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
    .map((id) => agents.find((a) => a.id === id) ? `${agents.find((a) => a.id === id)?.first_name || ''} ${agents.find((a) => a.id === id)?.last_name || ''}`.trim() || agents.find((a) => a.id === id)?.email : undefined)
    .filter((n): n is string => Boolean(n));

  return (
    <div className={pageShellClassName()}>
      <PageHeader
        title="Search"
        description="Find calls by transcript keywords, agent, sentiment, and date range."
      />

      <SearchFilters
        keyword={keyword}
        selectedAgentIds={selectedAgentIds}
        selectedAgentNames={selectedAgentNames}
        agents={agents.map(a => ({
          id: a.id,
          name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email,
          team: 'Team',
          hireDate: new Date().toISOString(),
          status: 'active' as const
        }))}
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

      {loading && !results && (
        <div className="mt-6">
          <PageSkeleton variant="list" />
        </div>
      )}

      {results && (
        <div className="mt-6">
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
        </div>
      )}

      {!results && !loading && (
        <EmptyState
          icon={SearchIcon}
          title="Search calls"
          description="Use the filters above to search transcripts, agents, and topics. Results will appear here."
          className="mt-6"
        />
      )}

      <CallDetailDrawer
        call={selectedCall as CallDetailCall}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        canCreateAlert
        isCreatingAlert={isCreatingAlert}
        onCreateAlert={handleCreateAlert}
      />
    </div>
  );
}
