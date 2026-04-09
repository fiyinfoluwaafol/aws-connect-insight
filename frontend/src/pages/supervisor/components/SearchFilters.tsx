import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Search, Download, ChevronDown, Loader2 } from 'lucide-react';
import type { Agent } from '@/lib/mock-data';

export interface SearchFiltersProps {
  keyword: string;
  selectedAgentIds: string[];
  selectedAgentNames: string[];
  agents: Agent[];
  sentimentRange: [number, number];
  dateFrom: string;
  dateTo: string;
  loading: boolean;
  canExport: boolean;
  onKeywordChange: (value: string) => void;
  onAgentToggle: (agentId: string) => void;
  onClearAgents: () => void;
  onSentimentRangeChange: (value: [number, number]) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSearch: () => void;
  onExportCSV: () => void;
}

export function SearchFilters({
  keyword,
  selectedAgentIds,
  selectedAgentNames,
  agents,
  sentimentRange,
  dateFrom,
  dateTo,
  loading,
  canExport,
  onKeywordChange,
  onAgentToggle,
  onClearAgents,
  onSentimentRangeChange,
  onDateFromChange,
  onDateToChange,
  onSearch,
  onExportCSV,
}: SearchFiltersProps) {
  return (
    <Card className="p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Search Calls</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Keyword</Label>
          <Input
            placeholder="Search transcripts, topics..."
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
        </div>
        <div className="space-y-2">
          <Label>Agent</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between font-normal"
              >
                {selectedAgentIds.length === 0 ? (
                  <span className="text-muted-foreground">Select agent...</span>
                ) : (
                  <span className="truncate">
                    {selectedAgentNames[0]}
                  </span>
                )}
                <ChevronDown className="h-4 w-4 ml-2 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <div className="p-2 border-b">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Select Agent</span>
                  {selectedAgentIds.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 text-xs"
                      onClick={onClearAgents}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {agents.map((agent) => (
                  <label
                    key={agent.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedAgentIds.includes(agent.id)}
                      onCheckedChange={() => onAgentToggle(agent.id)}
                    />
                    <span className="text-sm">{agent.name}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {agent.team}
                    </Badge>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
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
            onValueChange={(value) => onSentimentRangeChange(value as [number, number])}
            className="py-4"
          />
        </div>
        <div className="space-y-2">
          <Label>From Date</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>To Date</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={onSearch} disabled={loading} className="flex-1">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Search
          </Button>
          {canExport && (
            <Button variant="outline" onClick={onExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
