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
    <Card className="p-6 mb-8">
      <h2 className="text-lg font-semibold mb-4">Generate Daily Brief</h2>
      <div className="flex items-end gap-4">
        <div className="space-y-2">
          <Label>Select Date</Label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            max={maxDate}
          />
        </div>
        <Button onClick={onGenerate} disabled={generating}>
          {generating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          {generating ? 'Generating...' : 'Generate Brief'}
        </Button>
      </div>
    </Card>
  );
}
