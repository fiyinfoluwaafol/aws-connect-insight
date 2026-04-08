import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/lib/api';
import {
  deriveAlertSettingsViewModel,
  normalizeKeywordInput,
} from '@/lib/supervisor-alerts';
import { useAppStore } from '@/stores/app-store';
import { resetAndReseed } from '@/lib/seed';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import {
  Settings as SettingsIcon,
  Bell,
  Database,
  Mail,
  Trash2,
  Plus,
  X,
  RefreshCw,
} from 'lucide-react';

export default function Settings() {
  const queryClient = useQueryClient();
  const { settings, updateSettings, sentEmails } = useAppStore();
  const [newKeyword, setNewKeyword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [sentimentThreshold, setSentimentThreshold] = useState(-0.5);

  const { data: rulesResponse, isLoading: rulesLoading } = useQuery({
    queryKey: ['alerts', 'rules'],
    queryFn: () => alertsApi.listRules(),
    staleTime: 30 * 1000,
    retry: 1,
  });

  const settingsView = useMemo(
    () => deriveAlertSettingsViewModel(rulesResponse?.rules ?? []),
    [rulesResponse]
  );

  useEffect(() => {
    const backendThreshold = settingsView.thresholdRule?.sentiment_below;
    if (backendThreshold !== null && backendThreshold !== undefined) {
      setSentimentThreshold(backendThreshold);
    } else {
      setSentimentThreshold(-0.5);
    }
  }, [settingsView.thresholdRule?.id, settingsView.thresholdRule?.sentiment_below]);

  const saveThresholdMutation = useMutation({
    mutationFn: async (value: number) => {
      const canonicalRule = settingsView.thresholdRule;
      if (canonicalRule) {
        await alertsApi.updateRule(canonicalRule.id, {
          severity: 'high',
          is_active: true,
          sentiment_below: value,
        });
      } else {
        await alertsApi.createRule({
          type: 'sentiment_threshold',
          severity: 'high',
          sentiment_below: value,
          is_active: true,
        });
      }

      await Promise.all(
        settingsView.duplicateThresholdRules.map((rule) =>
          alertsApi.updateRule(rule.id, { is_active: false })
        )
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] });
      toast({
        title: 'Threshold Updated',
        description: 'The supervisor sentiment alert threshold has been saved.',
      });
    },
  });

  const createKeywordMutation = useMutation({
    mutationFn: (keyword: string) =>
      alertsApi.createRule({
        type: 'keyword_match',
        severity: 'high',
        keyword,
        is_active: true,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] });
    },
  });

  const deactivateKeywordMutation = useMutation({
    mutationFn: async (keyword: string) => {
      const matchingRules = settingsView.keywordRules.filter((rule) => rule.keyword === keyword);
      await Promise.all(
        matchingRules.map((rule) =>
          alertsApi.updateRule(rule.id, { is_active: false })
        )
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] });
    },
  });

  const handleThresholdCommit = async (value: number) => {
    setSentimentThreshold(value);
    await saveThresholdMutation.mutateAsync(value);
  };

  const handleAddKeyword = async () => {
    const normalizedKeyword = normalizeKeywordInput(newKeyword);
    if (!normalizedKeyword) return;

    if (settingsView.keywords.includes(normalizedKeyword)) {
      toast({
        title: 'Keyword Exists',
        description: 'This keyword is already in the list.',
        variant: 'destructive',
      });
      return;
    }

    await createKeywordMutation.mutateAsync(normalizedKeyword);
    setNewKeyword('');
    toast({
      title: 'Keyword Added',
      description: `"${normalizedKeyword}" has been added to alert keywords.`,
    });
  };

  const handleRemoveKeyword = async (keyword: string) => {
    await deactivateKeywordMutation.mutateAsync(keyword);
    toast({
      title: 'Keyword Removed',
      description: `"${keyword}" has been removed from alert keywords.`,
    });
  };

  const handleResetDemo = async () => {
    setResetLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    resetAndReseed();
    setResetLoading(false);

    toast({
      title: 'Demo Reset Complete',
      description: 'Local demo data has been cleared and refreshed. Backend alert rules were not changed.',
    });
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          Settings
        </h2>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Bell className="h-4 w-4" />
              Alert Thresholds
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">
                  Sentiment Threshold: {sentimentThreshold.toFixed(1)}
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Calls with sentiment below this value will trigger alerts.
                </p>
                <Slider
                  min={-1}
                  max={1}
                  step={0.1}
                  value={[sentimentThreshold]}
                  onValueChange={(value) => setSentimentThreshold(value[0])}
                  onValueCommit={(value) => void handleThresholdCommit(value[0])}
                />
              </div>
              <Separator />
              <div>
                <Label className="mb-2 block">Alert Keywords</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Calls containing these keywords will trigger alerts.
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {settingsView.keywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {keyword}
                      <button
                        onClick={() => void handleRemoveKeyword(keyword)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add keyword..."
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && void handleAddKeyword()}
                  />
                  <Button onClick={() => void handleAddKeyword()} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {rulesLoading && (
                  <p className="text-xs text-muted-foreground mt-2">Loading alert rules...</p>
                )}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Database className="h-4 w-4" />
              Data Retention
            </h3>
            <div className="space-y-2">
              <Label>Retention Period</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Calls older than this will be hidden from the interface.
              </p>
              <Select
                value={settings.dataRetentionDays.toString()}
                onValueChange={(value) =>
                  updateSettings({ dataRetentionDays: parseInt(value, 10) })
                }
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Mail className="h-4 w-4" />
              Email Outbox (Mock)
            </h3>
            {sentEmails.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No emails have been sent yet.
              </p>
            ) : (
              <ScrollArea className="h-48">
                <div className="space-y-3">
                  {sentEmails.map((email) => (
                    <div key={email.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{email.to}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(email.sentAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{email.subject}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {email.body}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>

          <Card className="p-6 border-destructive/50">
            <h3 className="font-semibold flex items-center gap-2 mb-4 text-destructive">
              <Trash2 className="h-4 w-4" />
              Reset Demo Data
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Clear local persisted state used for demo-only features such as briefs, notes,
              notifications, and local preferences. Backend alert rules are not reset here.
            </p>
            <Button
              variant="destructive"
              onClick={handleResetDemo}
              disabled={resetLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${resetLoading ? 'animate-spin' : ''}`} />
              {resetLoading ? 'Resetting...' : 'Reset Demo'}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
