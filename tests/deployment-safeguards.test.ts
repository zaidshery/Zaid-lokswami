import { afterEach, describe, expect, it } from 'vitest';
import { getDeploymentSafeguardsSnapshot } from '@/lib/admin/deploymentSafeguards';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getDeploymentSafeguardsSnapshot', () => {
  it('marks core runtime as critical when deploy-critical env is missing', () => {
    delete process.env.MONGODB_URI;
    delete process.env.NEXTAUTH_SECRET;
    delete process.env.AUTH_SECRET;
    delete process.env.JWT_SECRET;
    delete process.env.NEXTAUTH_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.LEADERSHIP_REPORT_CRON_SECRET;

    const snapshot = getDeploymentSafeguardsSnapshot();

    expect(snapshot.summary.critical).toBeGreaterThan(0);
    expect(snapshot.checks.some((check) => check.id === 'database' && check.status === 'critical')).toBe(true);
    expect(snapshot.checks.some((check) => check.id === 'auth-secret' && check.status === 'critical')).toBe(true);
    expect(snapshot.checks.some((check) => check.id === 'site-origin' && check.status === 'critical')).toBe(true);
    expect(snapshot.checks.some((check) => check.id === 'report-automation' && check.status === 'critical')).toBe(true);
  });

  it('marks deploy readiness healthy when core env is aligned', () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/lokswami';
    process.env.NEXTAUTH_SECRET = 'secret';
    process.env.NEXTAUTH_URL = 'https://lokswami.com';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://lokswami.com';
    process.env.DIGITALOCEAN_SPACES_ACCESS_KEY = 'access-key';
    process.env.DIGITALOCEAN_SPACES_SECRET_KEY = 'secret-key';
    process.env.DIGITALOCEAN_SPACES_BUCKET = 'lokswami-storage-2026';
    process.env.DIGITALOCEAN_SPACES_REGION = 'sgp1';
    process.env.DIGITALOCEAN_SPACES_CDN_BASE_URL =
      'https://lokswami-storage-2026.sgp1.cdn.digitaloceanspaces.com';
    process.env.GEMINI_API_KEY = 'gemini';
    process.env.LEADERSHIP_REPORT_CRON_SECRET = 'cron-secret';
    process.env.RESEND_API_KEY = 'resend';
    process.env.LEADERSHIP_REPORT_FROM_EMAIL = 'reports@lokswami.com';
    process.env.NEXT_PUBLIC_EPAPER_REMOTE_OCR_FALLBACK = 'true';
    process.env.OCR_SPACE_API_KEY = 'ocr-space-key';

    const snapshot = getDeploymentSafeguardsSnapshot();

    expect(snapshot.checks.some((check) => check.id === 'database' && check.status === 'healthy')).toBe(true);
    expect(snapshot.checks.some((check) => check.id === 'auth-secret' && check.status === 'healthy')).toBe(true);
    expect(snapshot.checks.some((check) => check.id === 'site-origin' && check.status === 'healthy')).toBe(true);
    expect(snapshot.checks.some((check) => check.id === 'uploads' && check.status === 'healthy')).toBe(true);
    expect(snapshot.checks.some((check) => check.id === 'ocr' && check.status === 'healthy')).toBe(true);
    expect(snapshot.checks.some((check) => check.id === 'report-automation' && check.status === 'healthy')).toBe(true);
  });
});
