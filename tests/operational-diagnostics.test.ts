import { afterEach, describe, expect, it } from 'vitest';
import {
  buildOcrRuntimeSummary,
  buildUploadRuntimeSummary,
} from '@/lib/admin/operationalDiagnostics';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('operational diagnostics helpers', () => {
  it('flags upload runtime as critical when DigitalOcean Spaces env is missing', () => {
    delete process.env.DIGITALOCEAN_SPACES_ACCESS_KEY;
    delete process.env.DIGITALOCEAN_SPACES_SECRET_KEY;
    delete process.env.DIGITALOCEAN_SPACES_BUCKET;
    delete process.env.DIGITALOCEAN_SPACES_REGION;

    const summary = buildUploadRuntimeSummary();

    expect(summary.status).toBe('critical');
    expect(summary.signals[0]?.value).toContain('not ready');
  });

  it('marks upload runtime healthy when DigitalOcean Spaces env is complete', () => {
    process.env.DIGITALOCEAN_SPACES_ACCESS_KEY = 'access-key';
    process.env.DIGITALOCEAN_SPACES_SECRET_KEY = 'secret-key';
    process.env.DIGITALOCEAN_SPACES_BUCKET = 'lokswami-storage-2026';
    process.env.DIGITALOCEAN_SPACES_REGION = 'sgp1';
    process.env.DIGITALOCEAN_SPACES_CDN_BASE_URL =
      'https://lokswami-storage-2026.sgp1.cdn.digitaloceanspaces.com';

    const summary = buildUploadRuntimeSummary();

    expect(summary.status).toBe('healthy');
    expect(summary.signals[0]?.value).toContain('DigitalOcean Spaces ready');
  });

  it('flags OCR runtime as critical when remote fallback is enabled without a provider', () => {
    process.env.NEXT_PUBLIC_EPAPER_LOCAL_OCR_ONLY = 'false';
    process.env.NEXT_PUBLIC_EPAPER_REMOTE_OCR_FALLBACK = 'true';
    delete process.env.OCR_CUSTOM_API_URL;
    delete process.env.OCR_CUSTOM_API_KEY;
    delete process.env.OCR_SPACE_API_KEY;

    const summary = buildOcrRuntimeSummary();

    expect(summary.status).toBe('critical');
    expect(summary.signals.some((signal) => signal.label === 'Remote OCR' && signal.tone === 'critical')).toBe(true);
  });
});
