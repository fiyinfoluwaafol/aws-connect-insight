import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CallDetailDrawer } from '../CallDetailDrawer';

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
  callSummary: {
    callId: 'call-1',
    summaryText: 'Customer requested a refund.',
    keyPhrases: ['refund'],
    entities: ['Ada Lovelace'],
    transcript: [{ speaker: 'Customer', text: 'I want a refund.' }],
  },
};

describe('CallDetailDrawer', () => {
  it('shows manual alert action when creation is enabled and the call has no open alert', () => {
    render(
      <CallDetailDrawer
        call={{ ...baseCall, hasOpenAlert: false, openAlertId: null }}
        open
        onOpenChange={vi.fn()}
        canCreateAlert
        onCreateAlert={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByRole('button', { name: 'Create Alert' })).toBeInTheDocument();
  });

  it('hides manual alert action when the call already has an open alert', () => {
    render(
      <CallDetailDrawer
        call={{ ...baseCall, hasOpenAlert: true, openAlertId: 'alert-1' }}
        open
        onOpenChange={vi.fn()}
        canCreateAlert
        onCreateAlert={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.queryByRole('button', { name: 'Create Alert' })).not.toBeInTheDocument();
  });
});
