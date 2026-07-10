import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- This validator is also a CommonJS CLI.
const { validateProductionEnv } = require('../scripts/validate-production-env.js') as {
  validateProductionEnv: (env: Record<string, string>) => {
    ok: boolean;
    errors: string[];
    warnings: string[];
    infos: string[];
  };
};

function buildBaseEnv(overrides: Record<string, string> = {}) {
  return {
    MONGODB_URI: 'mongodb+srv://user:pass@example.mongodb.net/lokswami',
    NEXTAUTH_SECRET: '12345678901234567890123456789012',
    NEXTAUTH_URL: 'https://lokswami.com',
    NEXT_PUBLIC_SITE_URL: 'https://lokswami.com',
    EPAPER_FORCE_STORAGE: '1',
    DIGITALOCEAN_SPACES_ACCESS_KEY: 'access',
    DIGITALOCEAN_SPACES_SECRET_KEY: 'secret',
    DIGITALOCEAN_SPACES_BUCKET: 'lokswami-storage-2026',
    DIGITALOCEAN_SPACES_REGION: 'sgp1',
    DIGITALOCEAN_SPACES_CDN_BASE_URL:
      'https://lokswami-storage-2026.sgp1.cdn.digitaloceanspaces.com',
    ...overrides,
  };
}

describe('production environment validation', () => {
  it('requires a cron secret for e-paper and e-magazine background conversion', () => {
    const result = validateProductionEnv(buildBaseEnv());

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Missing required env: ADMIN_CRON_SECRET or CRON_SECRET. Hostinger cron needs this to run E-paper/E-magazine PDF conversion jobs.'
    );
  });

  it('passes when production upload and cron env are complete', () => {
    const result = validateProductionEnv(
      buildBaseEnv({
        ADMIN_CRON_SECRET: 'cron-secret',
      })
    );

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
