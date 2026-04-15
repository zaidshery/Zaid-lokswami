import { createElement, type ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewsPoll from '@/components/ui/NewsPoll';
import { useAppStore } from '@/lib/store/appStore';

vi.mock('framer-motion', () => ({
  motion: {
    section: ({ children, ...props }: ComponentProps<'section'>) => (
      createElement('section', props, children)
    ),
    div: ({ children, ...props }: ComponentProps<'div'>) => (
      createElement('div', props, children)
    ),
  },
}));

function buildResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('NewsPoll', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    useAppStore.setState({ language: 'en' });
  });

  it('stays hidden when there is no active poll', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockImplementation(() =>
        buildResponse({
          success: true,
          data: null,
        }) as ReturnType<typeof fetch>
      );

    const { container } = render(createElement(NewsPoll));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/poll/current',
        expect.objectContaining({ cache: 'no-store' })
      );
    });

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('submits a vote and shows live results', async () => {
    vi.spyOn(global, 'fetch')
      .mockImplementationOnce(() =>
        buildResponse({
          success: true,
          data: {
            id: 'poll-1',
            question: 'Should Lokswami launch this poll?',
            options: [
              { text: 'Yes', votes: 3, percentage: 60 },
              { text: 'No', votes: 2, percentage: 40 },
            ],
            totalVotes: 5,
            status: 'active',
            expiresAt: null,
            linkedArticleId: null,
            createdAt: '2026-04-15T08:00:00.000Z',
            updatedAt: '2026-04-15T08:00:00.000Z',
            isExpired: false,
          },
        }) as ReturnType<typeof fetch>
      )
      .mockImplementationOnce(() =>
        buildResponse({
          success: true,
          data: {
            hasVoted: false,
            selectedOptionIndex: null,
          },
        }) as ReturnType<typeof fetch>
      )
      .mockImplementationOnce(() =>
        buildResponse({
          success: true,
          data: {
            id: 'poll-1',
            question: 'Should Lokswami launch this poll?',
            options: [
              { text: 'Yes', votes: 4, percentage: 67 },
              { text: 'No', votes: 2, percentage: 33 },
            ],
            totalVotes: 6,
            status: 'active',
            expiresAt: null,
            linkedArticleId: null,
            createdAt: '2026-04-15T08:00:00.000Z',
            updatedAt: '2026-04-15T08:01:00.000Z',
            isExpired: false,
          },
        }) as ReturnType<typeof fetch>
      );

    render(createElement(NewsPoll));

    expect(await screen.findByText('Should Lokswami launch this poll?')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Yes'));
    fireEvent.click(screen.getByRole('button', { name: 'Vote Now' }));

    expect(await screen.findByText('Thanks for voting')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText(/Total votes:/)).toBeInTheDocument();
    expect(window.localStorage.getItem('lokswami_poll_vote:poll-1')).toContain(
      '"selectedOptionIndex":0'
    );
  });

  it('shows results immediately when the user already voted', async () => {
    vi.spyOn(global, 'fetch')
      .mockImplementationOnce(() =>
        buildResponse({
          success: true,
          data: {
            id: 'poll-1',
            question: 'Should Lokswami launch this poll?',
            options: [
              { text: 'Yes', votes: 4, percentage: 67 },
              { text: 'No', votes: 2, percentage: 33 },
            ],
            totalVotes: 6,
            status: 'active',
            expiresAt: null,
            linkedArticleId: null,
            createdAt: '2026-04-15T08:00:00.000Z',
            updatedAt: '2026-04-15T08:01:00.000Z',
            isExpired: false,
          },
        }) as ReturnType<typeof fetch>
      )
      .mockImplementationOnce(() =>
        buildResponse({
          success: true,
          data: {
            hasVoted: true,
            selectedOptionIndex: 1,
          },
        }) as ReturnType<typeof fetch>
      );

    render(createElement(NewsPoll));

    expect(await screen.findByText('Results')).toBeInTheDocument();
    expect(screen.getByText('Your choice')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('shows a retry fallback when the poll fails to load', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      buildResponse(
        {
          success: false,
          error: 'The poll could not be loaded right now.',
        },
        false,
        500
      ) as ReturnType<typeof fetch>
    );

    render(createElement(NewsPoll));

    expect(
      await screen.findByText('The poll could not be loaded right now.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
