import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import {
  alertsApi,
  callsApi,
  type SupervisorAlertRecord,
  type SupervisorAlertRule,
  type SupervisorCallDetail,
} from '../api';
import { server } from '@/test/mocks/server';

describe('alerts api client', () => {
  it('lists alerts with query params', async () => {
    server.use(
      http.get('http://localhost:8000/api/alerts', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('status')).toBe('open');
        expect(url.searchParams.get('per_page')).toBe('5');

        return HttpResponse.json({
          alerts: [
            {
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
              description: 'A tracked alert fired.',
              created_at: '2026-04-02T12:00:00Z',
              updated_at: '2026-04-02T12:00:00Z',
            } satisfies SupervisorAlertRecord,
          ],
          total: 1,
          page: 1,
          per_page: 5,
        });
      })
    );

    const response = await alertsApi.listAlerts({ status: 'open', per_page: 5 });
    expect(response.total).toBe(1);
    expect(response.alerts[0].id).toBe('alert-1');
  });

  it('creates and updates rules and fetches call detail', async () => {
    server.use(
      http.post('http://localhost:8000/api/alerts/rules', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toMatchObject({
          type: 'keyword_match',
          severity: 'high',
          keyword: 'refund',
        });

        return HttpResponse.json(
          {
            id: 'rule-1',
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
          } satisfies SupervisorAlertRule,
          { status: 201 }
        );
      }),
      http.patch('http://localhost:8000/api/alerts/rules/rule-1', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toMatchObject({ is_active: false });

        return HttpResponse.json({
          id: 'rule-1',
          type: 'keyword_match',
          severity: 'high',
          is_active: false,
          team_id: 'team-1',
          supervisor_id: 'sup-1',
          sentiment_below: null,
          keyword: 'refund',
          topic: null,
          min_occurrences: null,
          window_days: null,
          created_at: '2026-04-02T12:00:00Z',
          updated_at: '2026-04-02T12:01:00Z',
        } satisfies SupervisorAlertRule);
      }),
      http.get('http://localhost:8000/api/calls/call-1', () =>
        HttpResponse.json({
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
          transcript: [{ speaker: 'Customer', text: 'I need a refund.' }],
        } satisfies SupervisorCallDetail)
      )
    );

    const createdRule = await alertsApi.createRule({
      type: 'keyword_match',
      severity: 'high',
      keyword: 'refund',
      is_active: true,
    });
    expect(createdRule.id).toBe('rule-1');

    const updatedRule = await alertsApi.updateRule('rule-1', { is_active: false });
    expect(updatedRule.is_active).toBe(false);

    const call = await callsApi.getCallById('call-1');
    expect(call.agent_name).toBe('Ada Lovelace');
  });
});
