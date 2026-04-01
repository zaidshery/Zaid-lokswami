import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import AuthSync from '@/components/providers/AuthSync';
import AuthSessionProvider from '@/components/providers/SessionProvider';
import InstallAppPrompt from '@/components/ui/InstallAppPrompt';

const THEME_INIT_SCRIPT = `
(() => {
  const STORAGE_KEY = 'lokswami-storage';
  const root = document.documentElement;
  const getSystemTheme = () =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

  const applyTheme = (theme) => {
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      applyTheme(getSystemTheme());
      return;
    }
    const parsed = JSON.parse(raw);
    const storedTheme = parsed?.state?.theme;
    if (storedTheme === 'dark' || storedTheme === 'light') {
      applyTheme(storedTheme);
      return;
    }
    applyTheme(getSystemTheme());
  } catch {
    applyTheme(getSystemTheme());
  }
})();
`;
const ASSET_RECOVERY_SCRIPT = `
(() => {
  const STORAGE_KEY = 'lokswami-asset-recovery';
  const CACHE_BUST_PARAM = '__asset_recovery';
  const RECOVERY_WINDOW_MS = 10 * 60 * 1000;
  const MAX_ATTEMPTS = 1;
  const chunkErrorPattern =
    /ChunkLoadError|Loading chunk [0-9]+ failed|CSS_CHUNK_LOAD_FAILED|Failed to fetch dynamically imported module/i;
  let recoveryInFlight = false;

  const readState = () => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { attempts: 0, timestamp: 0 };
      }

      const parsed = JSON.parse(raw);
      const attempts = Number(parsed?.attempts) || 0;
      const timestamp = Number(parsed?.timestamp) || 0;

      if (!timestamp || Date.now() - timestamp > RECOVERY_WINDOW_MS) {
        window.sessionStorage.removeItem(STORAGE_KEY);
        return { attempts: 0, timestamp: 0 };
      }

      return { attempts, timestamp };
    } catch {
      return { attempts: 0, timestamp: 0 };
    }
  };

  const writeState = (attempts) => {
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          attempts,
          timestamp: Date.now(),
          path: window.location.pathname,
        })
      );
    } catch {}
  };

  const clearState = () => {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const clearOriginCaches = async () => {
    if (!('caches' in window)) {
      return;
    }

    const cacheKeys = await window.caches.keys();
    await Promise.allSettled(cacheKeys.map((key) => window.caches.delete(key)));
  };

  const unregisterServiceWorkers = async () => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.allSettled(
      registrations.map((registration) => registration.unregister())
    );
  };

  const cleanupRecoveryParam = () => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has(CACHE_BUST_PARAM)) {
        return;
      }

      url.searchParams.delete(CACHE_BUST_PARAM);
      const cleanUrl = \`\${url.pathname}\${url.search}\${url.hash}\` || '/';
      window.history.replaceState(window.history.state, '', cleanUrl);
    } catch {}
  };

  const buildRecoveryUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set(CACHE_BUST_PARAM, String(Date.now()));
    return url.toString();
  };

  const recoverFromStaleAssets = () => {
    const state = readState();
    if (recoveryInFlight || state.attempts >= MAX_ATTEMPTS) {
      return;
    }

    recoveryInFlight = true;
    writeState(state.attempts + 1);
    const nextUrl = buildRecoveryUrl();

    Promise.allSettled([unregisterServiceWorkers(), clearOriginCaches()]).finally(() => {
      window.location.replace(nextUrl);
    });
  };

  window.addEventListener(
    'load',
    () => {
      try {
        const url = new URL(window.location.href);
        if (!url.searchParams.has(CACHE_BUST_PARAM)) {
          return;
        }

        clearState();
        cleanupRecoveryParam();
      } catch {}
    },
    { once: true }
  );

  window.addEventListener(
    'error',
    (event) => {
      const target = event.target;

      if (target instanceof HTMLScriptElement || target instanceof HTMLLinkElement) {
        const assetUrl = target.src || target.href || '';
        if (assetUrl.includes('/_next/static/')) {
          recoverFromStaleAssets();
          return;
        }
      }

      const message = String(event.message || '');
      if (chunkErrorPattern.test(message)) {
        recoverFromStaleAssets();
      }
    },
    true
  );

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = String(reason?.message || reason || '');
    if (chunkErrorPattern.test(message)) {
      recoverFromStaleAssets();
    }
  });
})();
`;
const googleTagManagerId = process.env.NEXT_PUBLIC_GTM_ID?.trim() || '';

export const metadata: Metadata = {
  title: 'Lokswami - \u092d\u093e\u0930\u0924 \u0915\u093e \u0938\u092c\u0938\u0947 \u0935\u093f\u0936\u094d\u0935\u0938\u0928\u0940\u092f \u0938\u092e\u093e\u091a\u093e\u0930 \u092a\u094d\u0932\u0947\u091f\u092b\u0949\u0930\u094d\u092e',
  applicationName: 'Lokswami',
  description:
    '\u0924\u093e\u091c\u093c\u093e \u0916\u092c\u0930\u0947\u0902, \u0935\u0940\u0921\u093f\u092f\u094b, \u0908-\u092a\u0947\u092a\u0930 \u0914\u0930 \u092c\u0939\u0941\u0924 \u0915\u0941\u091b\u0964 India\'s most trusted digital news platform with latest news, videos, and e-paper.',
  keywords:
    'Hindi news, \u092d\u093e\u0930\u0924\u0940\u092f \u0938\u092e\u093e\u091a\u093e\u0930, \u0924\u093e\u091c\u093c\u093e \u0916\u092c\u0930\u0947\u0902, breaking news, Lokswami, \u0932\u094b\u0915\u0938\u094d\u0935\u093e\u092e\u0940',
  authors: [{ name: 'Lokswami' }],
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/logo-icon-final.png',
    apple: '/logo-icon-final.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Lokswami',
  },
  openGraph: {
    title: 'Lokswami - \u092d\u093e\u0930\u0924 \u0915\u093e \u0938\u092c\u0938\u0947 \u0935\u093f\u0936\u094d\u0935\u0938\u0928\u0940\u092f \u0938\u092e\u093e\u091a\u093e\u0930 \u092a\u094d\u0932\u0947\u091f\u092b\u0949\u0930\u094d\u092e',
    description:
      '\u0924\u093e\u091c\u093c\u093e \u0916\u092c\u0930\u0947\u0902, \u0935\u0940\u0921\u093f\u092f\u094b, \u0908-\u092a\u0947\u092a\u0930 \u0914\u0930 \u092c\u0939\u0941\u0924 \u0915\u0941\u091b\u0964',
    type: 'website',
    locale: 'hi_IN',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#e72129',
};

/** Renders the shared HTML shell and top-level client providers. */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="hi" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <script id="lokswami-theme-init" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          id="lokswami-asset-recovery"
          dangerouslySetInnerHTML={{ __html: ASSET_RECOVERY_SCRIPT }}
        />
        {googleTagManagerId ? (
          <Script id="lokswami-google-tag-manager" strategy="beforeInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${googleTagManagerId}');`}
          </Script>
        ) : null}
      </head>
      <body
        className="min-h-screen bg-white text-gray-900 antialiased transition-colors duration-300 dark:bg-gray-950 dark:text-gray-50"
      >
        {googleTagManagerId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${googleTagManagerId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        ) : null}
        <AuthSessionProvider>
          <ThemeProvider>
            <AuthSync />
            {children}
            <InstallAppPrompt />
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
