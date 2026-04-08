import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertDetail } from '../AlertDetail';

describe('AlertDetail', () => {
  it('renders affected calls for recurring alerts', () => {
    render(
      <AlertDetail
        alert={{
          id: 'alert-1',
          type: 'recurring_keyword',
          callId: null,
          createdAt: '2026-04-02T12:00:00Z',
          ruleId: 'rule-1',
          ruleLabel: 'Recurring keyword detected',
          severity: 'high',
          status: 'open',
          issue: 'Keyword "refund" appeared across multiple calls.',
          matchedValue: 'refund',
          matchedCount: 2,
          windowDays: 7,
        }}
        relatedCalls={[
          {
            id: 'call-1',
            agentId: 'agent-1',
            agentName: 'Ada Lovelace',
            startedAt: '2026-04-02T12:00:00Z',
            durationSec: 240,
            sentimentScore: -0.3,
            sentimentLabel: 'negative',
            topics: ['refund'],
            resolved: false,
            csat: null,
            customerName: 'Customer',
            hasOpenAlert: false,
            openAlertId: null,
          },
          {
            id: 'call-2',
            agentId: 'agent-2',
            agentName: 'Grace Hopper',
            startedAt: '2026-04-01T12:00:00Z',
            durationSec: 180,
            sentimentScore: -0.2,
            sentimentLabel: 'negative',
            topics: ['refund'],
            resolved: true,
            csat: null,
            customerName: 'Customer',
            hasOpenAlert: false,
            openAlertId: null,
          },
        ]}
        onClose={vi.fn()}
        onOpenCall={vi.fn()}
        onCloseAlert={vi.fn()}
        onReopenAlert={vi.fn()}
        severityClassName={() => 'severity'}
      />
    );

    expect(screen.getByText('Affected Calls (2)')).toBeInTheDocument();
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.getByText(/Grace Hopper/)).toBeInTheDocument();
  });
});
