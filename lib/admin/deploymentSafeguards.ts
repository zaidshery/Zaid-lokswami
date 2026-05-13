import 'server-only';

import {
  buildOcrRuntimeSummary,
  buildUploadRuntimeSummary,
} from '@/lib/admin/operationalDiagnostics';

export type DeploymentSafeguardStatus = 'healthy' | 'watch' | 'critical';

export type DeploymentSafeguardCheck = {
  id: string;
  label: string;
  status: DeploymentSafeguardStatus;
  summary: string;
  detail: string;
  href?: string;
};

export type DeploymentSafeguardCommand = {
  id: string;
  label: string;
  command: string;
  description: string;
};

export type DeploymentSafeguardsSnapshot = {
  summary: {
    healthy: number;
    watch: number;
    critical: number;
  };
  checks: DeploymentSafeguardCheck[];
  commands: DeploymentSafeguardCommand[];
  docs: Array<{
    label: string;
    path: string;
  }>;
};

function trim(value: string | undefined) {
  return String(value || '').trim();
}

function safeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function buildDatabaseCheck(): DeploymentSafeguardCheck {
  const configured = Boolean(trim(process.env.MONGODB_URI));
  return {
    id: 'database',
    label: 'Database',
    status: configured ? 'healthy' : 'critical',
    summary: configured
      ? 'MongoDB connection string is configured.'
      : 'MongoDB connection string is missing.',
    detail: configured
      ? 'Database-backed workflows, analytics, and audit history can use the primary store.'
      : 'Set MONGODB_URI before relying on production content, analytics, reporting, or governance history.',
    href: '/admin/operations-diagnostics',
  };
}

function buildAuthSecretCheck(): DeploymentSafeguardCheck {
  const configured = Boolean(
    trim(process.env.NEXTAUTH_SECRET) || trim(process.env.AUTH_SECRET) || trim(process.env.JWT_SECRET)
  );
  return {
    id: 'auth-secret',
    label: 'Auth Secret',
    status: configured ? 'healthy' : 'critical',
    summary: configured
      ? 'Authentication secret is configured.'
      : 'Authentication secret is missing.',
    detail: configured
      ? 'Session signing and protected admin access can use a stable secret.'
      : 'Set NEXTAUTH_SECRET, AUTH_SECRET, or JWT_SECRET before production login is trusted.',
    href: '/admin/settings',
  };
}

function buildSiteOriginCheck(): DeploymentSafeguardCheck {
  const nextAuthUrl = trim(process.env.NEXTAUTH_URL);
  const publicSiteUrl = trim(process.env.NEXT_PUBLIC_SITE_URL);
  const nextAuthOrigin = safeOrigin(nextAuthUrl);
  const publicOrigin = safeOrigin(publicSiteUrl);

  const bothConfigured = Boolean(nextAuthOrigin && publicOrigin);
  const originsMatch = bothConfigured && nextAuthOrigin === publicOrigin;

  const status: DeploymentSafeguardStatus = !bothConfigured
    ? 'critical'
    : originsMatch
      ? 'healthy'
      : 'critical';

  return {
    id: 'site-origin',
    label: 'Site Origin',
    status,
    summary:
      status === 'healthy'
        ? 'NEXTAUTH_URL and NEXT_PUBLIC_SITE_URL match.'
        : 'Site origin variables need alignment.',
    detail:
      status === 'healthy'
        ? `Both site origins point to ${nextAuthOrigin}.`
        : !bothConfigured
          ? 'Set both NEXTAUTH_URL and NEXT_PUBLIC_SITE_URL to the final production domain.'
          : `NEXTAUTH_URL resolves to ${nextAuthOrigin}, but NEXT_PUBLIC_SITE_URL resolves to ${publicOrigin}. Keep them on the same final domain.`,
    href: '/admin/settings',
  };
}

function buildUploadCheck(): DeploymentSafeguardCheck {
  const uploadRuntime = buildUploadRuntimeSummary();
  return {
    id: 'uploads',
    label: 'Media Uploads',
    status: uploadRuntime.status === 'inactive' ? 'watch' : uploadRuntime.status,
    summary: uploadRuntime.summary,
    detail: uploadRuntime.detail,
    href: '/admin/operations-diagnostics',
  };
}

function buildPaidAiCheck(): DeploymentSafeguardCheck {
  return {
    id: 'paid-ai',
    label: 'Paid AI APIs',
    status: 'healthy',
    summary: 'Paid AI APIs are disabled.',
    detail: 'OpenAI and Gemini keys are not required; runtime uses local/manual fallbacks.',
    href: '/admin/operations-diagnostics',
  };
}

function buildOcrCheck(): DeploymentSafeguardCheck {
  const ocrRuntime = buildOcrRuntimeSummary();
  return {
    id: 'ocr',
    label: 'OCR Assist',
    status: ocrRuntime.status === 'inactive' ? 'watch' : ocrRuntime.status,
    summary: ocrRuntime.summary,
    detail: ocrRuntime.detail,
    href: '/admin/operations-diagnostics',
  };
}

function buildReportAutomationCheck(): DeploymentSafeguardCheck {
  const cronSecretConfigured = Boolean(trim(process.env.LEADERSHIP_REPORT_CRON_SECRET));
  const resendConfigured = Boolean(trim(process.env.RESEND_API_KEY));
  const reportFromConfigured = Boolean(
    trim(process.env.LEADERSHIP_REPORT_FROM_EMAIL) || trim(process.env.RESEND_FROM_EMAIL)
  );

  const status: DeploymentSafeguardStatus = cronSecretConfigured
    ? resendConfigured && reportFromConfigured
      ? 'healthy'
      : 'watch'
    : 'critical';

  return {
    id: 'report-automation',
    label: 'Report Automation',
    status,
    summary:
      status === 'healthy'
        ? 'Cron protection and email delivery are ready.'
        : status === 'watch'
          ? 'Cron protection is ready, but email delivery is only partially configured.'
          : 'Leadership report cron protection is missing.',
    detail:
      status === 'healthy'
        ? 'Leadership briefings can run safely and send email summaries when scheduled.'
        : status === 'watch'
          ? 'LEADERSHIP_REPORT_CRON_SECRET is set, but email mode still needs RESEND_API_KEY and a from-address if you plan to send report emails.'
          : 'Set LEADERSHIP_REPORT_CRON_SECRET before enabling automatic due-run execution in production.',
    href: '/admin/settings',
  };
}

export function getDeploymentSafeguardsSnapshot(): DeploymentSafeguardsSnapshot {
  const checks = [
    buildDatabaseCheck(),
    buildAuthSecretCheck(),
    buildSiteOriginCheck(),
    buildUploadCheck(),
    buildPaidAiCheck(),
    buildOcrCheck(),
    buildReportAutomationCheck(),
  ];

  return {
    summary: {
      healthy: checks.filter((check) => check.status === 'healthy').length,
      watch: checks.filter((check) => check.status === 'watch').length,
      critical: checks.filter((check) => check.status === 'critical').length,
    },
    checks,
    commands: [
      {
        id: 'verify-prod-env',
        label: 'Verify Production Env',
        command: 'npm run verify:prod-env',
        description: 'Validate deploy-critical environment variables before build or restart.',
      },
      {
        id: 'verify-deploy',
        label: 'Verify Live Deploy',
        command: 'npm run verify:deploy -- https://your-domain.com',
        description: 'Run smoke, TTS, and admin runtime checks against the live domain.',
      },
      {
        id: 'test-admin-runtime',
        label: 'Check Admin Boundaries',
        command: 'npm run test:admin-runtime -- https://your-domain.com',
        description: 'Confirm guest/admin boundaries and sensitive admin runtime protections stay intact.',
      },
    ],
    docs: [
      { label: 'Hostinger Deploy Guide', path: '/HOSTINGER_DEPLOY.md' },
      { label: 'Deploy Smoke Checklist', path: '/DEPLOY_SMOKE_CHECKLIST.md' },
      { label: 'Admin Runtime Checklist', path: '/ADMIN_RUNTIME_CHECKLIST.md' },
    ],
  };
}
