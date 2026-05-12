import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  CmsWorkflowActivityTimeline,
  formatWorkflowActivityActionLabel,
} from '@/components/admin/CmsWorkflowActivityTimeline';

describe('CMS workflow activity timeline', () => {
  it('formats activity action labels', () => {
    expect(formatWorkflowActivityActionLabel('mark_ready_for_approval')).toBe(
      'Mark Ready For Approval'
    );
    expect(formatWorkflowActivityActionLabel(undefined)).toBe('Activity');
  });

  it('renders shared activity metadata consistently', () => {
    render(
      <CmsWorkflowActivityTimeline
        items={[
          {
            id: 'activity-1',
            action: 'publish',
            message: 'Article published.',
            createdAt: '2026-05-12T10:00:00.000Z',
            source: 'derived',
            fromStatus: 'approved',
            toStatus: 'published',
            actor: {
              name: 'Desk Admin',
              role: 'admin',
            },
          },
        ]}
        emptyMessage="No activity yet."
        fallbackMessage="Activity recorded."
        formatTimestamp={() => 'May 12, 2026'}
        formatActorRole={(role) => `Role: ${role}`}
      />
    );

    expect(screen.getByText('Publish')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Derived')).toBeInTheDocument();
    expect(screen.getByText('Article published.')).toBeInTheDocument();
    expect(screen.getByText('Desk Admin')).toBeInTheDocument();
    expect(screen.getByText('Role: admin')).toBeInTheDocument();
    expect(screen.getByText('Approved -> Published')).toBeInTheDocument();
    expect(screen.getByText('May 12, 2026')).toBeInTheDocument();
  });

  it('renders empty and loading states', () => {
    const refresh = vi.fn();
    const { rerender } = render(
      <CmsWorkflowActivityTimeline
        items={[]}
        emptyMessage="No timeline yet."
        fallbackMessage="Activity recorded."
        formatTimestamp={() => 'Now'}
        onRefresh={refresh}
      />
    );

    expect(screen.getByText('No timeline yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();

    rerender(
      <CmsWorkflowActivityTimeline
        items={[]}
        isLoading
        emptyMessage="No timeline yet."
        fallbackMessage="Activity recorded."
        formatTimestamp={() => 'Now'}
        onRefresh={refresh}
      />
    );

    expect(screen.getByText('Loading activity...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refreshing...' })).toBeDisabled();
  });
});
