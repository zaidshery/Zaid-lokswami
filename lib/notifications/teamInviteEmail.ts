import { formatUserRoleLabel, type AdminRole } from '@/lib/auth/roles';

const RESEND_API_URL = 'https://api.resend.com/emails';

type TeamInviteEmailInput = {
  to: string;
  name: string;
  role: string | AdminRole;
  setupLink: string;
};

export type TeamInviteEmailResult = {
  sent: boolean;
  skipped?: boolean;
  error?: string;
};

function clean(value: unknown, maxLength = 200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function getResendConfig() {
  const apiKey = clean(process.env.RESEND_API_KEY, 200);
  const from = clean(process.env.LEADERSHIP_REPORT_FROM_EMAIL || process.env.RESEND_FROM_EMAIL, 200);
  return { apiKey, from };
}

function buildEmailBody(input: TeamInviteEmailInput) {
  const safeName = clean(input.name, 120) || 'Team Member';
  const displayRole = formatUserRoleLabel(input.role as AdminRole) || 'Team Member';
  
  const text = [
    `Hi ${safeName},`,
    '',
    `You have been invited to join the Lokswami Newsroom as a ${displayRole}.`,
    '',
    'Please click the link below to securely set your password and access your account:',
    input.setupLink,
    '',
    'This setup link will expire soon. If it expires, please ask your administrator to generate a new one.',
    '',
    'Regards,',
    'Lokswami Administration',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:640px;margin:0 auto;padding:18px 14px;">
      <h2 style="margin:0 0 12px;font-size:22px;color:#111827;">Welcome to Lokswami</h2>
      <p style="margin:0 0 10px;">Hi <strong>${safeName}</strong>,</p>
      <p style="margin:0 0 10px;">You have been invited to join the Lokswami Newsroom as a <strong>${displayRole}</strong>.</p>
      <div style="margin:24px 0;">
        <a href="${input.setupLink}" style="display:inline-block;background-color:#E11D48;color:#FFFFFF;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">Set your password</a>
      </div>
      <p style="margin:0 0 10px;font-size:14px;color:#4B5563;">Or copy and paste this secure link into your browser:<br/>
      <a href="${input.setupLink}" style="color:#2563EB;">${input.setupLink}</a></p>
      <p style="margin:0 0 10px;font-size:14px;color:#4B5563;">This setup link will expire soon. If it expires, please ask your administrator to generate a new one.</p>
      <p style="margin:18px 0 0;">Regards,<br />Lokswami Administration</p>
    </div>
  `;

  return { text, html };
}

export async function sendTeamInviteEmail(
  input: TeamInviteEmailInput
): Promise<TeamInviteEmailResult> {
  const to = clean(input.to, 180).toLowerCase();
  if (!to) {
    return { sent: false, error: 'Missing recipient email' };
  }

  const { apiKey, from } = getResendConfig();
  if (!apiKey || !from) {
    return { sent: false, skipped: true, error: 'Email provider not configured' };
  }

  const body = buildEmailBody(input);

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Invitation: Join Lokswami Newsroom`,
        text: body.text,
        html: body.html,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorPayload = await response.text().catch(() => '');
      return {
        sent: false,
        error:
          errorPayload.slice(0, 200) ||
          `Email service returned status ${response.status}`,
      };
    }

    return { sent: true };
  } catch {
    return { sent: false, error: 'Email delivery failed' };
  }
}
