import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('Google analytics integration', () => {
  it('validates public tag IDs and defers third-party analytics until after interaction readiness', () => {
    const layout = read('app/layout.tsx');
    expect(layout).toContain('NEXT_PUBLIC_GTM_ID');
    expect(layout).toContain('NEXT_PUBLIC_GA4_MEASUREMENT_ID');
    expect(layout).toContain('/^GTM-[A-Z0-9]+$/');
    expect(layout).toContain('/^G-[A-Z0-9]+$/');
    expect(layout).toContain('strategy="afterInteractive"');
    expect(layout).not.toMatch(/lokswami-google-tag-manager" strategy="beforeInteractive"/);
  });

  it('does not forward the internal pseudonymous session ID to Google', () => {
    const tracker = read('lib/analytics/trackClient.ts');
    expect(tracker).not.toContain('lokswami_session_id');
    expect(tracker).toContain("window.gtag('event'");
  });

  it('sets Consent Mode v2 defaults before loading GTM and exposes a persistent choice UI', () => {
    const layout = read('app/layout.tsx');
    const consent = read('components/analytics/AnalyticsConsent.tsx');
    const consentDefaultsIndex = layout.indexOf('lokswami-google-consent-defaults');
    const tagManagerIndex = layout.indexOf('lokswami-google-tag-manager');

    expect(consentDefaultsIndex).toBeGreaterThan(-1);
    expect(tagManagerIndex).toBeGreaterThan(consentDefaultsIndex);
    expect(layout).toContain("analytics_storage: analyticsConsent");
    expect(layout).toContain("ad_user_data: 'denied'");
    expect(layout).toContain("ad_personalization: 'denied'");
    expect(consent).toContain('lokswami_google_analytics_consent_v1');
    expect(consent).toContain("gtag('consent', 'update'");
    expect(consent).toContain('Reject optional analytics');
    expect(consent).toContain('Allow analytics');
    expect(consent).toContain('Cookie settings');
  });
});
