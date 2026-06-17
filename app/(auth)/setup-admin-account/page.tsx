'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import Logo from '@/components/layout/Logo';

type SetupProfile = {
  name: string;
  email: string;
  loginId: string;
  role: string;
  setupExpiresAt: string | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatRoleLabel(value: string) {
  return String(value || 'Team Member')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function AccountDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-zinc-300">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {label}
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-zinc-100">{value}</p>
      </div>
    </div>
  );
}

function PasswordInput({
  id,
  label,
  value,
  visible,
  placeholder,
  onChange,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
        {label}
      </span>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          className="h-12 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 pr-12 text-sm font-medium text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-red-400 focus:ring-2 focus:ring-red-500/20"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}

function PasswordRule({ valid, label }: { valid: boolean; label: string }) {
  return (
    <li className={cx('flex items-center gap-2 text-xs', valid ? 'text-emerald-300' : 'text-zinc-500')}>
      <CheckCircle2 className={cx('h-3.5 w-3.5', valid ? 'text-emerald-400' : 'text-zinc-600')} />
      <span>{label}</span>
    </li>
  );
}

function SetupAdminAccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [profile, setProfile] = useState<SetupProfile | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  const setupExpiryLabel = useMemo(() => {
    if (!profile?.setupExpiresAt) {
      return '';
    }

    const date = new Date(profile.setupExpiresAt);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString();
  }, [profile?.setupExpiresAt]);

  const passwordRules = useMemo(
    () => ({
      length: password.length >= 8,
      number: /\d/.test(password),
      letter: /[A-Za-z]/.test(password),
      match: Boolean(password) && password === confirmPassword,
    }),
    [confirmPassword, password]
  );

  const passwordReady =
    passwordRules.length && passwordRules.number && passwordRules.letter && passwordRules.match;

  useEffect(() => {
    if (!token.trim()) {
      setError('Setup link is missing or invalid.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/auth/staff-setup?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
        });
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Invalid setup link');
        }

        if (!cancelled) {
          setProfile(payload.data as SetupProfile);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Invalid setup link');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit() {
    if (!token.trim()) {
      setError('Setup link is missing or invalid.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/staff-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to set password');
      }

      setSuccess('Password set successfully. You can now sign in with your login ID or email.');
      setPassword('');
      setConfirmPassword('');

      window.setTimeout(() => {
        router.push('/signin?redirect=/admin');
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="mx-auto grid min-h-screen w-full max-w-7xl px-4 py-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-8 lg:px-8">
        <section className="flex flex-col justify-between rounded-[28px] border border-white/10 bg-[#111116] p-5 shadow-[0_30px_90px_-60px_rgba(0,0,0,0.9)] sm:p-8 lg:my-6">
          <div>
            <Logo size="lg" href="/main" />
            <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-red-200">
              <ShieldCheck className="h-4 w-4" />
              Newsroom Access
            </div>
            <h1 className="mt-5 max-w-xl text-3xl font-black tracking-tight text-white sm:text-5xl">
              Create your staff password
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-zinc-400 sm:text-base">
              Complete this one-time setup to access the Lokswami admin desk with your login ID or email.
            </p>
          </div>

          <div className="mt-10 grid gap-3 text-sm text-zinc-300 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="font-semibold text-white">Private link</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">This page works only for the invited staff account.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="font-semibold text-white">Admin only</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">The password unlocks newsroom tools based on the assigned role.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <p className="font-semibold text-white">Expires soon</p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Ask an admin for a fresh link if this setup page expires.</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center py-6 lg:py-10">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#15151b] p-4 shadow-[0_30px_120px_-70px_rgba(220,38,38,0.4)] sm:p-6">
            <div className="rounded-[24px] border border-white/10 bg-[#0f0f14] p-4 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
                    Staff setup
                  </p>
                  <h2 className="mt-2 text-2xl font-black text-white">Secure your account</h2>
                </div>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-200">
                  <LockKeyhole className="h-5 w-5" />
                </div>
              </div>

              {loading ? (
                <div className="mt-8 flex items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03] py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-red-400" />
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  {error ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  {success ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-100">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
                      <span>{success}</span>
                    </div>
                  ) : null}

                  {profile ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <AccountDetail
                        icon={UserRound}
                        label="Name"
                        value={profile.name || 'Team Member'}
                      />
                      <AccountDetail icon={Mail} label="Email" value={profile.email} />
                      <AccountDetail
                        icon={KeyRound}
                        label="Login ID"
                        value={profile.loginId || profile.email}
                      />
                      <AccountDetail
                        icon={ShieldCheck}
                        label="Role"
                        value={formatRoleLabel(profile.role)}
                      />
                      {setupExpiryLabel ? (
                        <div className="sm:col-span-2">
                          <AccountDetail icon={Clock3} label="Link expires" value={setupExpiryLabel} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {profile ? (
                    <div className="space-y-4">
                      <PasswordInput
                        id="staff-password"
                        label="New password"
                        value={password}
                        visible={passwordVisible}
                        placeholder="Enter a strong password"
                        onChange={setPassword}
                        onToggle={() => setPasswordVisible((current) => !current)}
                      />

                      <PasswordInput
                        id="staff-confirm-password"
                        label="Confirm password"
                        value={confirmPassword}
                        visible={confirmPasswordVisible}
                        placeholder="Confirm your password"
                        onChange={setConfirmPassword}
                        onToggle={() => setConfirmPasswordVisible((current) => !current)}
                      />

                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                          Password checklist
                        </p>
                        <ul className="grid gap-2 sm:grid-cols-2">
                          <PasswordRule valid={passwordRules.length} label="At least 8 characters" />
                          <PasswordRule valid={passwordRules.letter} label="Includes a letter" />
                          <PasswordRule valid={passwordRules.number} label="Includes a number" />
                          <PasswordRule valid={passwordRules.match} label="Passwords match" />
                        </ul>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={submitting || !passwordReady}
                        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        <span>{submitting ? 'Saving password...' : 'Complete setup'}</span>
                        {!submitting ? <ArrowRight className="h-4 w-4" /> : null}
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm leading-6 text-zinc-300">
                      Ask a super admin to generate a fresh setup link from the Team page.
                    </div>
                  )}

                  <div className="flex flex-col gap-3 text-center text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between sm:text-left">
                    <span>Already configured?</span>
                    <Link
                      href="/signin?redirect=/admin"
                      className="inline-flex items-center justify-center gap-2 font-semibold text-red-300 transition hover:text-red-200"
                    >
                      Go to sign in
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SetupAdminAccountFallback() {
  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#15151b] p-8 shadow-[0_30px_120px_-70px_rgba(220,38,38,0.4)]">
          <div className="flex justify-center rounded-[24px] border border-white/10 bg-[#0f0f14] p-6">
            <Logo size="lg" href="/main" />
          </div>
          <div className="mt-6 flex items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03] py-12">
            <Loader2 className="h-6 w-6 animate-spin text-red-400" />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function SetupAdminAccountPage() {
  return (
    <Suspense fallback={<SetupAdminAccountFallback />}>
      <SetupAdminAccountContent />
    </Suspense>
  );
}
