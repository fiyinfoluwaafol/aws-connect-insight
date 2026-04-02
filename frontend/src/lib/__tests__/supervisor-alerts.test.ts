import { describe, expect, it } from 'vitest';
import {
  deriveAlertSettingsViewModel,
  mapAlertRecordToViewModel,
  mapCallDetailToViewModel,
  normalizeKeywordInput,
} from '../supervisor-alerts';

describe('supervisor alerts adapters', () => {
  it('maps backend alert records into the existing alert view model', () => {
    expect(
      mapAlertRecordToViewModel({
        id: 'alert-1',
        rule_id: 'rule-1',
        type: 'sentiment_threshold',
        severity: 'high',
        status: 'open',
        is_read: false,
        call_id: 'call-1',
        matched_value: null,
        matched_count: null,
        window_days: null,
        title: 'Negative sentiment threshold breached',
        description: 'Call sentiment score -0.70 fell below the configured threshold.',
        created_at: '2026-04-02T12:00:00Z',
        updated_at: '2026-04-02T12:00:00Z',
      })
    ).toEqual({
      id: 'alert-1',
      callId: 'call-1',
      createdAt: '2026-04-02T12:00:00Z',
      ruleId: 'rule-1',
      ruleLabel: 'Negative sentiment threshold breached',
      severity: 'high',
      status: 'open',
      issue: 'Call sentiment score -0.70 fell below the configured threshold.',
    });
  });

  it('maps backend call detail into the drawer-friendly call shape', () => {
    expect(
      mapCallDetailToViewModel({
        id: 'call-1',
        agent_id: 'agent-1',
        agent_name: 'Ada Lovelace',
        started_at: '2026-04-02T12:00:00Z',
        duration_seconds: 240,
        sentiment_score: -0.3,
        sentiment_label: 'negative',
        is_resolved: false,
        topics: ['refund'],
        summary: 'Customer requested a refund.',
        transcript: [{ speaker: 'Customer', text: 'I want a refund.', timestamp: null }],
      })
    ).toMatchObject({
      id: 'call-1',
      agentId: 'agent-1',
      agentName: 'Ada Lovelace',
      startedAt: '2026-04-02T12:00:00Z',
      durationSec: 240,
      sentimentScore: -0.3,
      sentimentLabel: 'negative',
      topics: ['refund'],
      resolved: false,
      customerName: 'Customer',
      callSummary: {
        summaryText: 'Customer requested a refund.',
        keyPhrases: ['refund'],
      },
    });
  });

  it('derives canonical threshold and active keywords from rules', () => {
    const derived = deriveAlertSettingsViewModel([
      {
        id: 'rule-new',
        type: 'sentiment_threshold',
        severity: 'high',
        is_active: true,
        team_id: 'team-1',
        supervisor_id: 'sup-1',
        sentiment_below: -0.4,
        keyword: null,
        topic: null,
        min_occurrences: null,
        window_days: null,
        created_at: '2026-04-02T12:00:00Z',
        updated_at: '2026-04-02T12:00:00Z',
      },
      {
        id: 'rule-old',
        type: 'sentiment_threshold',
        severity: 'high',
        is_active: true,
        team_id: 'team-1',
        supervisor_id: 'sup-1',
        sentiment_below: -0.6,
        keyword: null,
        topic: null,
        min_occurrences: null,
        window_days: null,
        created_at: '2026-04-01T12:00:00Z',
        updated_at: '2026-04-01T12:00:00Z',
      },
      {
        id: 'keyword-1',
        type: 'keyword_match',
        severity: 'high',
        is_active: true,
        team_id: 'team-1',
        supervisor_id: 'sup-1',
        sentiment_below: null,
        keyword: 'refund',
        topic: null,
        min_occurrences: null,
        window_days: null,
        created_at: '2026-04-02T12:00:00Z',
        updated_at: '2026-04-02T12:00:00Z',
      },
      {
        id: 'ignored-recurring',
        type: 'recurring_keyword',
        severity: 'medium',
        is_active: true,
        team_id: 'team-1',
        supervisor_id: 'sup-1',
        sentiment_below: null,
        keyword: 'chargeback',
        topic: null,
        min_occurrences: 3,
        window_days: 7,
        created_at: '2026-04-02T12:00:00Z',
        updated_at: '2026-04-02T12:00:00Z',
      },
    ]);

    expect(derived.thresholdRule?.id).toBe('rule-new');
    expect(derived.duplicateThresholdRules.map((rule) => rule.id)).toEqual(['rule-old']);
    expect(derived.keywords).toEqual(['refund']);
  });

  it('normalizes keyword input', () => {
    expect(normalizeKeywordInput(' Refund ')).toBe('refund');
    expect(normalizeKeywordInput('   ')).toBeNull();
  });
});
