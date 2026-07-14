import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAdminSessionMock = vi.fn();
const redirectMock = vi.fn((target: string) => {
  throw new Error(`redirect:${target}`);
});

vi.mock('@/lib/auth/admin', () => ({
  getAdminSession: getAdminSessionMock,
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('@/app/(admin)/admin/settings/DeploymentSafeguardsPanel', () => ({
  default: () => null,
}));

vi.mock('@/app/(admin)/admin/settings/LeadershipReportsSettingsPanel', () => ({
  default: () => null,
}));

vi.mock('@/app/(admin)/admin/settings/TtsSettingsPanel', () => ({
  default: () => null,
}));

const ADMIN_SESSION = {
  id: 'admin-1',
  email: 'desk@example.com',
  name: 'Desk',
  role: 'admin' as const,
};

const SUPER_ADMIN_SESSION = {
  id: 'super-1',
  email: 'boss@example.com',
  name: 'Boss',
  role: 'super_admin' as const,
};

describe('Super Admin page boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects a normal admin away from platform Settings and Business Value', async () => {
    getAdminSessionMock.mockResolvedValue(ADMIN_SESSION);
    const { default: SettingsPage } = await import('@/app/(admin)/admin/settings/page');
    const { default: BusinessValueLayout } = await import(
      '@/app/(admin)/admin/analytics/business-value/layout'
    );

    await expect(SettingsPage()).rejects.toThrow('redirect:/admin');
    await expect(
      BusinessValueLayout({ children: null as ReactNode })
    ).rejects.toThrow('redirect:/admin');
  });

  it('renders both protected surfaces for a Super Admin', async () => {
    getAdminSessionMock.mockResolvedValue(SUPER_ADMIN_SESSION);
    const { default: SettingsPage } = await import('@/app/(admin)/admin/settings/page');
    const { default: BusinessValueLayout } = await import(
      '@/app/(admin)/admin/analytics/business-value/layout'
    );

    await expect(SettingsPage()).resolves.toBeTruthy();
    await expect(
      BusinessValueLayout({ children: <span>Business Value</span> })
    ).resolves.toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
