import { useState } from 'react';
import { useAppStore } from '@/stores/app-store';
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
  Link,
  Mail,
  Trash2,
  Plus,
  X,
  RefreshCw,
} from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings, sentEmails, resetAll } = useAppStore();
  const [newKeyword, setNewKeyword] = useState('');
  const [testSlackLoading, setTestSlackLoading] = useState(false);

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) return;
    if (settings.keywords.includes(newKeyword.trim().toLowerCase())) {
      toast({
        title: 'Keyword Exists',
        description: 'This keyword is already in the list.',
        variant: 'destructive',
      });
      return;
    }
    updateSettings({
      keywords: [...settings.keywords, newKeyword.trim().toLowerCase()],
    });
    setNewKeyword('');
    toast({
      title: 'Keyword Added',
      description: `"${newKeyword}" has been added to alert keywords.`,
    });
  };

  const handleRemoveKeyword = (keyword: string) => {
    updateSettings({
      keywords: settings.keywords.filter((k) => k !== keyword),
    });
    toast({
      title: 'Keyword Removed',
      description: `"${keyword}" has been removed from alert keywords.`,
    });
  };

  const handleTestSlack = async () => {
    if (!settings.slackWebhook) {
      toast({
        title: 'No Webhook URL',
        description: 'Please enter a Slack webhook URL first.',
        variant: 'destructive',
      });
      return;
    }
    setTestSlackLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setTestSlackLoading(false);
    toast({
      title: 'Test Ping Sent',
      description: 'A test message was sent to your Slack channel (mocked).',
    });
  };

  const handleResetDemo = () => {
    resetAll();
    toast({
      title: 'Demo Reset',
      description: 'All persisted data has been cleared. Refresh to re-seed.',
    });
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5" />
          Settings
        </h2>

        <div className="space-y-6">
          {/* Alert Thresholds */}
          <Card className="p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Bell className="h-4 w-4" />
              Alert Thresholds
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">
                  Sentiment Threshold: {settings.sentimentThreshold.toFixed(1)}
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Calls with sentiment below this value will trigger alerts.
                </p>
                <Slider
                  min={-1}
                  max={0}
                  step={0.1}
                  value={[settings.sentimentThreshold]}
                  onValueChange={(value) =>
                    updateSettings({ sentimentThreshold: value[0] })
                  }
                />
              </div>
              <Separator />
              <div>
                <Label className="mb-2 block">Alert Keywords</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Calls containing these keywords will trigger alerts.
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {settings.keywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {keyword}
                      <button
                        onClick={() => handleRemoveKeyword(keyword)}
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
                    onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
                  />
                  <Button onClick={handleAddKeyword} size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Data Retention */}
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
                  updateSettings({ dataRetentionDays: parseInt(value) })
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

          {/* Integrations */}
          <Card className="p-6">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <Link className="h-4 w-4" />
              Integrations
            </h3>
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Slack Webhook URL</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://hooks.slack.com/services/..."
                    value={settings.slackWebhook}
                    onChange={(e) =>
                      updateSettings({ slackWebhook: e.target.value })
                    }
                  />
                  <Button
                    variant="outline"
                    onClick={handleTestSlack}
                    disabled={testSlackLoading}
                  >
                    {testSlackLoading ? 'Sending...' : 'Test Ping'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Email Outbox */}
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

          {/* Reset Demo */}
          <Card className="p-6 border-destructive/50">
            <h3 className="font-semibold flex items-center gap-2 mb-4 text-destructive">
              <Trash2 className="h-4 w-4" />
              Reset Demo Data
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Clear all persisted state (alerts, briefs, notes, settings) and
              reload with fresh data. This action cannot be undone.
            </p>
            <Button variant="destructive" onClick={handleResetDemo}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset Demo
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
