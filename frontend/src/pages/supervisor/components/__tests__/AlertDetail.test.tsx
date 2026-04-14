import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { AlertDetail } from '../AlertDetail';

describe('AlertDetail', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const baseAlert = {
    id: 'alert-1',
    type: 'recurring_keyword' as const,
    callId: null,
    createdAt: '2026-04-02T12:00:00Z',
    ruleId: 'rule-1',
    ruleLabel: 'Recurring keyword detected',
    severity: 'high' as const,
    status: 'open' as const,
    issue: 'Keyword "refund" appeared across multiple calls.',
    matchedValue: 'refund',
    matchedCount: 2,
    windowDays: 7,
  };

  const baseProps = {
    onClose: vi.fn(),
    onOpenCall: vi.fn(),
    onCloseAlert: vi.fn(),
    onReopenAlert: vi.fn(),
    severityClassName: () => 'severity',
  };

  const baseCall = {
    id: 'call-1',
    agentId: 'agent-1',
    agentName: 'Ada Lovelace',
    startedAt: '2026-04-02T12:00:00Z',
    durationSec: 240,
    sentimentScore: -0.3,
    sentimentLabel: 'negative' as const,
    topics: ['refund'],
    resolved: false,
    csat: null,
    customerName: 'Customer',
    hasOpenAlert: false,
    openAlertId: null,
  };

  it('renders affected calls for recurring alerts', () => {
    render(
      <AlertDetail
        alert={baseAlert}
        relatedCalls={[
          baseCall,
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
        {...baseProps}
      />
    );

    expect(screen.getByText('Affected Calls (2)')).toBeInTheDocument();
    expect(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    expect(screen.getByText(/Grace Hopper/)).toBeInTheDocument();
  });

  it('renders a skeleton while recurring alert calls load', () => {
    render(
      <AlertDetail
        alert={baseAlert}
        relatedCalls={[]}
        isLoadingRelatedCalls
        {...baseProps}
      />
    );

    expect(screen.getByRole('status', { name: 'Loading affected calls' })).toBeInTheDocument();
    expect(screen.queryByText('Affected Calls (2)')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading related calls...')).not.toBeInTheDocument();
  });

  it('renders a skeleton while single alert call information loads', () => {
    render(
      <AlertDetail
        alert={{
          ...baseAlert,
          type: 'sentiment_threshold',
          callId: 'call-1',
          ruleLabel: 'Negative sentiment threshold breached',
          issue: 'Call sentiment score fell below the configured threshold.',
          matchedCount: null,
          windowDays: null,
        }}
        relatedCalls={[]}
        isLoadingRelatedCalls
        {...baseProps}
      />
    );

    expect(screen.getByRole('status', { name: 'Loading call information' })).toBeInTheDocument();
    expect(screen.queryByText('Call Information')).not.toBeInTheDocument();
  });

  it('keeps the skeleton visible briefly after calls finish loading', () => {
    vi.useFakeTimers();

    const { rerender } = render(
      <AlertDetail
        alert={baseAlert}
        relatedCalls={[]}
        isLoadingRelatedCalls
        {...baseProps}
      />
    );

    rerender(
      <AlertDetail
        alert={baseAlert}
        relatedCalls={[baseCall]}
        isLoadingRelatedCalls={false}
        {...baseProps}
      />
    );

    expect(screen.getByRole('status', { name: 'Loading affected calls' })).toBeInTheDocument();
    expect(screen.queryByText('Affected Calls (2)')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByText('Affected Calls (2)')).toBeInTheDocument();
  });
});
