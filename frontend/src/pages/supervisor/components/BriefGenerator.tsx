import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Loader2 } from 'lucide-react';

export interface BriefGeneratorProps {
  selectedDate: string;
  generating: boolean;
  maxDate: string;
  onDateChange: (value: string) => void;
  onGenerate: () => void;
}

export function BriefGenerator({
  selectedDate,
  generating,
  maxDate,
  onDateChange,
  onGenerate,
}: BriefGeneratorProps) {
  return (
    <Card className="p-6 mb-8 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Generate daily brief</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Create a snapshot of team performance, issues, and coaching opportunities for a specific day.
        </p>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2 flex-1 min-w-0">
          <Label htmlFor="brief-date">Select date</Label>
          <Input
            id="brief-date"
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            max={maxDate}
          />
        </div>
        <Button
          className="sm:shrink-0"
          onClick={onGenerate}
          disabled={generating}
          aria-busy={generating}
        >
          {generating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          {generating ? 'Generating…' : 'Generate brief'}
        </Button>
      </div>
    </Card>
  );
}
