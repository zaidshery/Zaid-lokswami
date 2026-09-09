import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsConsent, {
  GOOGLE_ANALYTICS_CONSENT_KEY,
} from '@/components/analytics/AnalyticsConsent';

vi.mock('next/navigation', () => ({
  usePathname: () => '/main',
}));

vi.mock('@/lib/store/appStore', () => ({
  useAppStore: () => ({ language: 'en' }),
}));

describe('AnalyticsConsent', () => {
  const gtag = vi.fn();

  beforeEach(() => {
    window.history.replaceState({}, '', '/main');
    window.localStorage.clear();
    Object.defineProperty(window, 'gtag', {
      configurable: true,
      writable: true,
      value: gtag,
    });
    gtag.mockClear();
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, 'gtag');
  });

  it('defaults to a clear choice and allows consent to be withdrawn or granted later', async () => {
    render(<AnalyticsConsent />);

    expect(await screen.findByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reject optional analytics' }));

    expect(window.localStorage.getItem(GOOGLE_ANALYTICS_CONSENT_KEY)).toBe('denied');
    expect(gtag).toHaveBeenCalledWith('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });

    const settingsButton = await screen.findByRole('button', {
      name: 'Change cookie settings',
    });
    fireEvent.click(settingsButton);
    fireEvent.click(screen.getByRole('button', { name: 'Allow analytics' }));

    await waitFor(() => {
      expect(window.localStorage.getItem(GOOGLE_ANALYTICS_CONSENT_KEY)).toBe('granted');
    });
    expect(gtag).toHaveBeenCalledWith('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    expect(gtag).toHaveBeenCalledWith('event', 'analytics_consent_update', {
      consent_state: 'granted',
    });
    expect(gtag).not.toHaveBeenCalledWith('event', 'page_view', expect.anything());
  });
});
