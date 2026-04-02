import type {
  SupervisorAlertRecord,
  SupervisorAlertRule,
  SupervisorCallDetail,
} from '@/lib/api';

export type SupervisorSentimentLabel = 'positive' | 'neutral' | 'negative';

export interface SupervisorAlertViewModel {
  id: string;
  callId: string | null;
  createdAt: string;
  ruleId: string;
  ruleLabel: string;
  severity: 'high' | 'medium' | 'low';
  status: 'open' | 'closed';
  issue: string;
}

export interface SupervisorCallSummaryViewModel {
  callId: string;
  summaryText: string;
  keyPhrases: string[];
  entities: string[];
  transcript: Array<{ speaker: string; text: string; timestamp?: string }>;
}

export interface SupervisorCallViewModel {
  id: string;
  agentId: string;
  agentName: string;
  startedAt: string;
  durationSec: number;
  sentimentScore: number;
  sentimentLabel: SupervisorSentimentLabel;
  topics: string[];
  resolved: boolean;
  csat: number | null;
  customerName: string;
  callSummary?: SupervisorCallSummaryViewModel;
}

export interface SupervisorAlertSettingsViewModel {
  thresholdRule: SupervisorAlertRule | null;
  duplicateThresholdRules: SupervisorAlertRule[];
  keywordRules: SupervisorAlertRule[];
  keywords: string[];
}

export function normalizeKeywordInput(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export function mapAlertRecordToViewModel(
  record: SupervisorAlertRecord,
): SupervisorAlertViewModel {
  return {
    id: record.id,
    callId: record.call_id,
    createdAt: record.created_at ?? '',
    ruleId: record.rule_id ?? record.id,
    ruleLabel: record.title,
    severity: record.severity,
    status: record.status,
    issue: record.description,
  };
}

export function mapCallDetailToViewModel(
  detail: SupervisorCallDetail,
): SupervisorCallViewModel {
  const topics = detail.topics ?? [];
  const transcript = (detail.transcript ?? []).map((turn) => ({
    speaker: turn.speaker,
    text: turn.text,
    timestamp: turn.timestamp ?? undefined,
  }));

  return {
    id: detail.id,
    agentId: detail.agent_id,
    agentName: detail.agent_name,
    startedAt: detail.started_at ?? '',
    durationSec: detail.duration_seconds ?? 0,
    sentimentScore: detail.sentiment_score ?? 0,
    sentimentLabel: detail.sentiment_label ?? 'neutral',
    topics,
    resolved: detail.is_resolved ?? false,
    csat: null,
    customerName: 'Customer',
    callSummary: detail.summary
      ? {
          callId: detail.id,
          summaryText: detail.summary,
          keyPhrases: topics.slice(0, 5),
          entities: [detail.agent_name],
          transcript,
        }
      : transcript.length > 0
        ? {
            callId: detail.id,
            summaryText: 'Transcript available for this call.',
            keyPhrases: topics.slice(0, 5),
            entities: [detail.agent_name],
            transcript,
          }
        : undefined,
  };
}

export function deriveAlertSettingsViewModel(
  rules: SupervisorAlertRule[],
): SupervisorAlertSettingsViewModel {
  const activeRules = rules.filter((rule) => rule.is_active);
  const thresholdRules = activeRules.filter((rule) => rule.type === 'sentiment_threshold');
  const keywordRules = activeRules.filter((rule) => rule.type === 'keyword_match');

  const [thresholdRule, ...duplicateThresholdRules] = thresholdRules;

  return {
    thresholdRule: thresholdRule ?? null,
    duplicateThresholdRules,
    keywordRules,
    keywords: keywordRules
      .map((rule) => normalizeKeywordInput(rule.keyword ?? ''))
      .filter((keyword): keyword is string => Boolean(keyword)),
  };
}
