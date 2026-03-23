'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AlertCircle, Eye, EyeOff, Loader2, LogOut, Moon, Sun } from 'lucide-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import Logo from '@/components/layout/Logo';
import { armAdminSigninBanner } from '@/lib/auth/adminBanner';
import { COMPANY_INFO } from '@/lib/constants/company';
import { normalizeRedirectPath } from '@/lib/auth/redirect';
import { isAdminRole } from '@/lib/auth/roles';
import { useAppStore } from '@/lib/store/appStore';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  inactive: 'Your account is inactive. Contact an administrator.',
  OAuthError: 'Google sign-in failed. Please try again.',
  OAuthSignin: 'Google sign-in failed. Please try again.',
  OAuthCallback: 'Google sign-in failed. Please try again.',
  CredentialsSignin: 'Invalid admin ID or password.',
  no_admin_access: 'This account cannot access the admin panel.',
  Default: 'Sign-in failed. Please try again.',
};

const POST_AUTH_QUERY_PARAM = 'postAuth';
const ADMIN_BANNER_QUERY_PARAM = 'adminBanner';
const READER_FEATURES = [
  'Save articles',
  'AI news assistant',
  'Read e-paper',
];

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.33-1.54 3.9-5.5 3.9-3.31 0-6-2.76-6-6.2S8.69 5.6 12 5.6c1.88 0 3.13.8 3.85 1.48l2.63-2.58C16.87 2.97 14.69 2 12 2 6.93 2 2.82 6.48 2.82 12S6.93 22 12 22c5.19 0 8.61-3.65 8.61-8.8 0-.59-.06-1.02-.14-1.4H12Z"
      />
      <path
        fill="#34A853"
        d="M3.8 7.23 7 9.58C7.87 7.09 9.76 5.6 12 5.6c1.88 0 3.13.8 3.85 1.48l2.63-2.58C16.87 2.97 14.69 2 12 2 8.4 2 5.27 4.05 3.8 7.23Z"
      />
      <path
        fill="#FBBC05"
        d="M12 22c2.64 0 4.86-.87 6.48-2.37l-3-2.45c-.83.6-1.9 1.02-3.48 1.02-2.22 0-4.1-1.48-5-3.54l-3.1 2.39C5.34 19.85 8.45 22 12 22Z"
      />
      <path
        fill="#4285F4"
        d="M20.61 13.2c0-.6-.05-1.16-.14-1.69H12v3.9h4.84c-.21 1.08-.82 1.99-1.84 2.67l3 2.45c1.75-1.63 2.61-4.03 2.61-7.33Z"
      />
    </svg>
  );
}

function resolvePostSignInRedirect(value: string | null): string | null {
  const next = (value || '').trim();
  if (!next) {
    return null;
  }

  const normalizedPath = normalizeRedirectPath(next, '');
  if (normalizedPath) {
    if (normalizedPath === '/signin' || normalizedPath === '/login') {
      return '/main';
    }

    if (normalizedPath.startsWith('/signin?') || normalizedPath.startsWith('/login?')) {
      const nestedParams = new URLSearchParams(normalizedPath.split('?')[1] || '');
      return (
        resolvePostSignInRedirect(nestedParams.get('redirect')) ||
        resolvePostSignInRedirect(nestedParams.get('callbackUrl')) ||
        '/main'
      );
    }

    return normalizedPath;
  }

  if (!/^https?:\/\//i.test(next) || typeof window === 'undefined') {
    return null;
  }

  try {
    const parsedUrl = new URL(next);
    if (parsedUrl.origin !== window.location.origin) {
      return null;
    }

    return resolvePostSignInRedirect(`${parsedUrl.pathname}${parsedUrl.search}`);
  } catch {
    return null;
  }
}

function resolveAuthError(errorKey: string | null): string {
  if (!errorKey) {
    return '';
  }

  return AUTH_ERROR_MESSAGES[errorKey] || AUTH_ERROR_MESSAGES.Default;
}

function isAdminOnlyTarget(path: string) {
  return path === '/admin' || path.startsWith('/admin/');
}

function buildPostAuthCallbackUrl(redirectTo: string, shouldShowAdminBanner: boolean) {
  const params = new URLSearchParams({
    [POST_AUTH_QUERY_PARAM]: '1',
    redirect: redirectTo,
  });

  if (shouldShowAdminBanner) {
    params.set(ADMIN_BANNER_QUERY_PARAM, '1');
  }

  return `/signin?${params.toString()}`;
}

function buildSignInRoute(redirectTo: string) {
  const params = new URLSearchParams();
  if (redirectTo) {
    params.set('redirect', redirectTo);
  }

  const query = params.toString();
  return query ? `/signin?${query}` : '/signin';
}

const formContainerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const formItemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.28,
      ease: 'easeOut',
    },
  },
};

function ThemeToggleButton({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useAppStore();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 ${className}`}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function FeaturePill({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-sm text-zinc-300 ${className}`}
    >
      {children}
    </div>
  );
}

function AuthFormContent({
  errorMessage,
  isSigningIn,
  isCredentialSigningIn,
  showGoogleSignIn,
  showAdminCredentialsLogin,
  adminLoginId,
  adminPassword,
  isAdminPasswordVisible,
  onAdminLoginIdChange,
  onAdminPasswordChange,
  onToggleAdminPasswordVisibility,
  onGoogleSignIn,
  onAdminCredentialsSignIn,
}: {
  errorMessage: string;
  isSigningIn: boolean;
  isCredentialSigningIn: boolean;
  showGoogleSignIn: boolean;
  showAdminCredentialsLogin: boolean;
  adminLoginId: string;
  adminPassword: string;
  isAdminPasswordVisible: boolean;
  onAdminLoginIdChange: (value: string) => void;
  onAdminPasswordChange: (value: string) => void;
  onToggleAdminPasswordVisibility: () => void;
  onGoogleSignIn: () => Promise<void>;
  onAdminCredentialsSignIn: () => Promise<void>;
}) {
  const forgotPasswordHref = `mailto:${COMPANY_INFO.contact.email}?subject=${encodeURIComponent(
    'Lokswami admin password help'
  )}&body=${encodeURIComponent(
    `Hello Lokswami team,\n\nI need help accessing the admin account.${
      adminLoginId.trim() ? `\n\nAdmin ID or email: ${adminLoginId.trim()}` : ''
    }\n\nPlease assist me with password reset or login support.\n`
  )}`;

  return (
    <motion.div
      variants={formContainerVariants}
      initial="hidden"
      animate="show"
      className="w-full"
    >
      <motion.div variants={formItemVariants}>
        <h1 className="text-center text-2xl font-black text-zinc-900 dark:text-zinc-100">
          {showAdminCredentialsLogin ? 'Admin Sign In' : 'Welcome to Lokswami'}
        </h1>
      </motion.div>

      <motion.div variants={formItemVariants}>
        <p className="mb-6 mt-1 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {showAdminCredentialsLogin && showGoogleSignIn
            ? 'Continue with Google or use your admin ID and password to access the control panel.'
            : showAdminCredentialsLogin
              ? 'Use your admin ID and password to access the control panel.'
            : 'Sign in to continue to your account.'}
        </p>
      </motion.div>

      {errorMessage ? (
        <motion.div
          variants={formItemVariants}
          className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
          <span>{errorMessage}</span>
        </motion.div>
      ) : null}

      {showGoogleSignIn ? (
        <motion.div variants={formItemVariants}>
          <motion.button
            type="button"
            onClick={() => void onGoogleSignIn()}
            disabled={isSigningIn || isCredentialSigningIn}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#dadce0] bg-white px-4 text-sm font-semibold text-[#3c4043] shadow-sm transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningIn ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <GoogleGlyph />
            )}
            <span>{isSigningIn ? 'Redirecting to Google...' : 'Continue with Google'}</span>
          </motion.button>
        </motion.div>
      ) : null}

      {showAdminCredentialsLogin ? (
        <motion.div variants={formItemVariants} className="my-5 flex items-center gap-3">
          <span className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            or use admin credentials
          </span>
          <span className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
        </motion.div>
      ) : showGoogleSignIn ? (
        <motion.div variants={formItemVariants} className="my-5 flex items-center gap-3">
          <span className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            or
          </span>
          <span className="flex-1 border-t border-zinc-200 dark:border-zinc-700" />
        </motion.div>
      ) : null}

      {showAdminCredentialsLogin ? (
        <motion.div
          variants={formItemVariants}
          className="mb-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Admin ID or email
              </span>
              <input
                type="text"
                value={adminLoginId}
                onChange={(event) => onAdminLoginIdChange(event.target.value)}
                autoComplete="username"
                className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                placeholder="admin"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Password
              </span>
              <div className="relative">
                <input
                  type={isAdminPasswordVisible ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(event) => onAdminPasswordChange(event.target.value)}
                  autoComplete="current-password"
                  className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 pr-12 text-sm text-zinc-900 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={onToggleAdminPasswordVisibility}
                  className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
                  aria-label={isAdminPasswordVisible ? 'Hide password' : 'Show password'}
                  aria-pressed={isAdminPasswordVisible}
                >
                  {isAdminPasswordVisible ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </label>

            <motion.button
              type="button"
              onClick={() => void onAdminCredentialsSignIn()}
              disabled={isCredentialSigningIn || isSigningIn}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#e63946] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d62839] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCredentialSigningIn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              <span>{isCredentialSigningIn ? 'Signing in...' : 'Sign in as Admin'}</span>
            </motion.button>

            <div className="flex items-center justify-between gap-3 text-xs">
              <a
                href={forgotPasswordHref}
                className="font-medium text-red-600 transition hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
              >
                Forgot password?
              </a>
              <Link
                href="/main/contact"
                className="text-zinc-500 underline transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Contact support
              </Link>
            </div>
          </div>
        </motion.div>
      ) : null}

      <motion.div variants={formItemVariants}>
        <motion.div whileHover={{ scale: 1.01 }}>
          <Link
            href="/main"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border-2 border-[#e63946] bg-transparent px-4 text-sm font-semibold text-[#e63946] transition hover:bg-[#e63946] hover:text-white"
          >
            Continue as guest
          </Link>
        </motion.div>
      </motion.div>

      <motion.p
        variants={formItemVariants}
        className="mt-6 text-center text-xs text-zinc-400"
      >
        By signing in you agree to the{' '}
        <Link href="/main/privacy" className="text-zinc-600 underline dark:text-zinc-300">
          Privacy Policy
        </Link>
        .
      </motion.p>
    </motion.div>
  );
}

function AuthenticatedNotice({
  errorMessage,
  primaryHref,
  primaryLabel,
  onSwitchAccount,
  isSwitchingAccount,
  name,
  email,
}: {
  errorMessage: string;
  primaryHref: string;
  primaryLabel: string;
  onSwitchAccount: () => Promise<void>;
  isSwitchingAccount: boolean;
  name: string;
  email: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-600/30 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-200">
          Signed in account
        </p>
        <p className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">{name}</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{email}</p>
        <p className="mt-3">{errorMessage}</p>
      </div>

      <Link
        href={primaryHref}
        className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-primary-600 px-4 text-sm font-semibold text-white transition hover:bg-primary-700"
      >
        {primaryLabel}
      </Link>

      <button
        type="button"
        onClick={() => void onSwitchAccount()}
        disabled={isSwitchingAccount}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
      >
        {isSwitchingAccount ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        <span>{isSwitchingAccount ? 'Signing out...' : 'Use another account'}</span>
      </button>
    </div>
  );
}

function SignInPageContent({
  adminCredentialsEnabled,
  adminGoogleEnabled,
}: {
  adminCredentialsEnabled: boolean;
  adminGoogleEnabled: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCredentialSigningIn, setIsCredentialSigningIn] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [adminLoginId, setAdminLoginId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminPasswordVisible, setIsAdminPasswordVisible] = useState(false);
  const hasHandledPostAuthMount = useRef(false);
  const hasHandledSessionRedirect = useRef(false);
  const redirectParam = searchParams.get('redirect');
  const callbackUrlParam = searchParams.get('callbackUrl');
  const errorKey = searchParams.get('error');
  const isPostAuth = searchParams.get(POST_AUTH_QUERY_PARAM) === '1';
  const shouldShowAdminBanner = searchParams.get(ADMIN_BANNER_QUERY_PARAM) === '1';

  const redirectTo = useMemo(
    () =>
      resolvePostSignInRedirect(redirectParam) ||
      resolvePostSignInRedirect(callbackUrlParam) ||
      '/main',
    [callbackUrlParam, redirectParam]
  );
  const isAdminTarget = isAdminOnlyTarget(redirectTo);
  const showAdminCredentialsLogin = adminCredentialsEnabled && isAdminTarget;
  const showGoogleSignIn = !isAdminTarget || adminGoogleEnabled;
  const isAdminSession =
    isAdminRole(session?.user?.role) && session?.user?.isActive !== false;
  const callbackUrl = useMemo(
    () =>
      buildPostAuthCallbackUrl(redirectTo, !redirectParam && !callbackUrlParam),
    [callbackUrlParam, redirectParam, redirectTo]
  );

  useEffect(() => {
    if (!isPostAuth || hasHandledPostAuthMount.current) {
      return;
    }

    hasHandledPostAuthMount.current = true;

    if (shouldShowAdminBanner) {
      armAdminSigninBanner();
    }

    router.replace(redirectTo);
    router.refresh();
  }, [isPostAuth, redirectTo, router, shouldShowAdminBanner]);

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated') {
      if (!isPostAuth) {
        hasHandledSessionRedirect.current = false;
      }
      return;
    }

    if (errorKey === 'inactive' || errorKey === 'no_admin_access') {
      return;
    }

    if (hasHandledSessionRedirect.current) {
      return;
    }

    hasHandledSessionRedirect.current = true;

    if (isAdminSession && isAdminTarget) {
      router.replace('/admin');
      router.refresh();
      return;
    }

    if (isAdminTarget) {
      router.replace('/signin?error=no_admin_access');
      router.refresh();
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  }, [errorKey, isAdminSession, isAdminTarget, isPostAuth, redirectTo, router, status]);

  useEffect(() => {
    if (status === 'authenticated' && (errorKey === 'inactive' || errorKey === 'no_admin_access')) {
      setErrorMessage(resolveAuthError(errorKey));
      return;
    }

    if (status === 'authenticated') {
      return;
    }

    setErrorMessage(resolveAuthError(errorKey));
  }, [errorKey, status]);

  async function handleGoogleSignIn(): Promise<void> {
    setErrorMessage('');
    setIsSigningIn(true);

    try {
      const result = await signIn('google', {
        redirect: false,
        redirectTo: callbackUrl,
      });

      if (result?.error) {
        setErrorMessage(resolveAuthError(result.error));
        setIsSigningIn(false);
        return;
      }

      if (result?.url) {
        window.location.assign(result.url);
        return;
      }

      setErrorMessage(AUTH_ERROR_MESSAGES.Default);
      setIsSigningIn(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : AUTH_ERROR_MESSAGES.Default;
      setErrorMessage(message);
      setIsSigningIn(false);
    }
  }

  async function handleAdminCredentialsSignIn(): Promise<void> {
    if (!adminLoginId.trim() || !adminPassword) {
      setErrorMessage('Enter your admin ID and password.');
      return;
    }

    setErrorMessage('');
    setIsCredentialSigningIn(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        loginId: adminLoginId.trim(),
        password: adminPassword,
        redirectTo: callbackUrl,
      });

      if (result?.error) {
        setErrorMessage(resolveAuthError(result.error));
        setIsCredentialSigningIn(false);
        return;
      }

      if (result?.url) {
        window.location.assign(result.url);
        return;
      }

      setErrorMessage(AUTH_ERROR_MESSAGES.Default);
      setIsCredentialSigningIn(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : AUTH_ERROR_MESSAGES.Default;
      setErrorMessage(message);
      setIsCredentialSigningIn(false);
    }
  }

  async function handleSwitchAccount() {
    setIsSwitchingAccount(true);

    try {
      await signOut({ redirect: false });
    } catch {
      // Ignore client sign-out errors and force the route transition anyway.
    }

    router.replace(buildSignInRoute(redirectTo));
    router.refresh();
    setIsSwitchingAccount(false);
  }

  const signedInName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split('@')[0]?.trim() ||
    'Lokswami User';
  const signedInEmail = session?.user?.email?.trim() || '';
  const shouldShowAuthenticatedNotice =
    status === 'authenticated' &&
    signedInEmail &&
    (errorKey === 'inactive' || errorKey === 'no_admin_access');

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#09090b_0%,#18181b_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(230,57,70,0.2),transparent_32%)]" />

      <div className="lg:hidden">
        <ThemeToggleButton className="fixed right-4 top-4 z-50" />

        <div className="relative flex min-h-screen flex-col px-4 py-10 md:px-8 md:py-14">
          <div className="mx-auto w-full max-w-4xl">
            <div className="text-center">
              <div className="inline-flex">
                <Logo size="lg" href="/main" />
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {READER_FEATURES.map((feature) => (
                  <div
                    key={feature}
                    className="rounded-full border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs text-zinc-300"
                  >
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="w-full md:hidden">
              <motion.section
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="mx-auto w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-8 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
              >
                {shouldShowAuthenticatedNotice ? (
                  <AuthenticatedNotice
                    errorMessage={errorMessage}
                    primaryHref="/main"
                    primaryLabel="Go to main site"
                    onSwitchAccount={handleSwitchAccount}
                    isSwitchingAccount={isSwitchingAccount}
                    name={signedInName}
                    email={signedInEmail}
                  />
                ) : (
                  <AuthFormContent
                    errorMessage={errorMessage}
                    isSigningIn={isSigningIn}
                    isCredentialSigningIn={isCredentialSigningIn}
                    showGoogleSignIn={showGoogleSignIn}
                    showAdminCredentialsLogin={showAdminCredentialsLogin}
                    adminLoginId={adminLoginId}
                    adminPassword={adminPassword}
                    isAdminPasswordVisible={isAdminPasswordVisible}
                    onAdminLoginIdChange={setAdminLoginId}
                    onAdminPasswordChange={setAdminPassword}
                    onToggleAdminPasswordVisibility={() =>
                      setIsAdminPasswordVisible((current) => !current)
                    }
                    onGoogleSignIn={handleGoogleSignIn}
                    onAdminCredentialsSignIn={handleAdminCredentialsSignIn}
                  />
                )}
              </motion.section>
            </div>

            <div className="hidden w-full md:block lg:hidden">
              <motion.section
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="mx-auto w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-10 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
              >
                {shouldShowAuthenticatedNotice ? (
                  <AuthenticatedNotice
                    errorMessage={errorMessage}
                    primaryHref="/main"
                    primaryLabel="Go to main site"
                    onSwitchAccount={handleSwitchAccount}
                    isSwitchingAccount={isSwitchingAccount}
                    name={signedInName}
                    email={signedInEmail}
                  />
                ) : (
                  <AuthFormContent
                    errorMessage={errorMessage}
                    isSigningIn={isSigningIn}
                    isCredentialSigningIn={isCredentialSigningIn}
                    showGoogleSignIn={showGoogleSignIn}
                    showAdminCredentialsLogin={showAdminCredentialsLogin}
                    adminLoginId={adminLoginId}
                    adminPassword={adminPassword}
                    isAdminPasswordVisible={isAdminPasswordVisible}
                    onAdminLoginIdChange={setAdminLoginId}
                    onAdminPasswordChange={setAdminPassword}
                    onToggleAdminPasswordVisibility={() =>
                      setIsAdminPasswordVisible((current) => !current)
                    }
                    onGoogleSignIn={handleGoogleSignIn}
                    onAdminCredentialsSignIn={handleAdminCredentialsSignIn}
                  />
                )}
              </motion.section>
            </div>
          </div>
        </div>
      </div>

      <div className="relative hidden min-h-screen lg:grid lg:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative flex flex-col items-center justify-center bg-zinc-950 p-12"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(230,57,70,0.25),transparent_38%)]" />

          <div className="relative z-10 flex flex-col items-center text-center">
            <Logo size="lg" href="/main" />

            <div className="mt-8 flex flex-col items-center gap-3">
              {READER_FEATURES.map((feature) => (
                <FeaturePill key={feature}>{feature}</FeaturePill>
              ))}
            </div>
          </div>

          <p className="absolute bottom-8 text-xs text-zinc-600">
            India&apos;s fastest Hindi news platform
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="relative flex items-center justify-center bg-white p-12 dark:bg-zinc-950"
        >
          <ThemeToggleButton className="absolute right-4 top-4" />

          <div className="mx-auto w-full max-w-sm">
            {shouldShowAuthenticatedNotice ? (
              <AuthenticatedNotice
                errorMessage={errorMessage}
                primaryHref="/main"
                primaryLabel="Go to main site"
                onSwitchAccount={handleSwitchAccount}
                isSwitchingAccount={isSwitchingAccount}
                name={signedInName}
                email={signedInEmail}
              />
            ) : (
              <AuthFormContent
                errorMessage={errorMessage}
                isSigningIn={isSigningIn}
                isCredentialSigningIn={isCredentialSigningIn}
                showGoogleSignIn={showGoogleSignIn}
                showAdminCredentialsLogin={showAdminCredentialsLogin}
                adminLoginId={adminLoginId}
                adminPassword={adminPassword}
                isAdminPasswordVisible={isAdminPasswordVisible}
                onAdminLoginIdChange={setAdminLoginId}
                onAdminPasswordChange={setAdminPassword}
                onToggleAdminPasswordVisibility={() =>
                  setIsAdminPasswordVisible((current) => !current)
                }
                onGoogleSignIn={handleGoogleSignIn}
                onAdminCredentialsSignIn={handleAdminCredentialsSignIn}
              />
            )}
          </div>
        </motion.section>
      </div>
    </main>
  );
}

function SignInPageFallback() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#09090b_0%,#18181b_100%)] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(230,57,70,0.2),transparent_32%)]" />

      <div className="relative z-10 mx-auto w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-2xl">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#e63946]" />
        <p className="mt-3 text-sm font-medium text-zinc-300">
          Preparing sign-in...
        </p>
      </div>
    </main>
  );
}

export default function SignInPage({
  adminCredentialsEnabled,
  adminGoogleEnabled,
}: {
  adminCredentialsEnabled: boolean;
  adminGoogleEnabled: boolean;
}) {
  return (
    <Suspense fallback={<SignInPageFallback />}>
      <SignInPageContent
        adminCredentialsEnabled={adminCredentialsEnabled}
        adminGoogleEnabled={adminGoogleEnabled}
      />
    </Suspense>
  );
}
