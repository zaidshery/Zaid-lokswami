/** @type {import('next').NextConfig} */
const path = require('path');

const isDevelopment = process.env.NODE_ENV !== 'production';
const scriptSrc = [
  "script-src 'self' 'unsafe-inline'",
  isDevelopment ? "'unsafe-eval'" : '',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net',
  'https://www.googletagmanager.com',
  'https://www.google-analytics.com',
].filter(Boolean);
const defaultImageHosts = [
  'images.unsplash.com',
  'via.placeholder.com',
  'img.youtube.com',
  '**.ytimg.com',
  'i.ytimg.com',
  'i1.ytimg.com',
  'i2.ytimg.com',
  'i3.ytimg.com',
  'i4.ytimg.com',
  'api.dicebear.com',
  '**.digitaloceanspaces.com',
  '**.googleusercontent.com',
];
const extraImageHosts = (process.env.NEXT_IMAGE_ALLOWED_HOSTS || '')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);
const allowedImageHosts = Array.from(new Set([...defaultImageHosts, ...extraImageHosts]));

function cacheControlHeader(value) {
  return [
    {
      key: 'Cache-Control',
      value,
    },
  ];
}

const immutableAssetCache = cacheControlHeader('public, max-age=31536000, immutable');
const privateNoStoreCache = cacheControlHeader(
  'private, no-store, no-cache, max-age=0, must-revalidate'
);
const publicPageCache = cacheControlHeader(
  'public, max-age=0, s-maxage=300, stale-while-revalidate=900'
);
const shortPublicPageCache = cacheControlHeader(
  'public, max-age=0, s-maxage=120, stale-while-revalidate=600'
);
const searchPageCache = cacheControlHeader(
  'public, max-age=0, s-maxage=30, stale-while-revalidate=120'
);

const nextConfig = {
  distDir: isDevelopment ? '.next-dev' : '.next',
  output: 'standalone',
  serverExternalPackages: ['@napi-rs/canvas', 'pdfjs-dist'],
  outputFileTracingIncludes: {
    '/api/admin/epapers/**/*': [
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    ],
  },
  // Hostinger currently normalizes some routes to a trailing slash at the edge.
  // Disable Next.js slash redirects so paths like /admin/ do not bounce back to /admin.
  skipTrailingSlashRedirect: true,
  // Hide Next.js dev indicator (the floating "N" badge) in local dev.
  devIndicators: false,
  images: {
    unoptimized: isDevelopment,
    formats: ['image/webp'],
    minimumCacheTTL: 86400,
    qualities: [55, 60, 75, 90, 100],
    remotePatterns: allowedImageHosts.map((hostname) => ({
      protocol: 'https',
      hostname,
    })),
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname),
    };
    return config;
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: immutableAssetCache,
      },
      {
        source: '/next/static/:path*',
        headers: immutableAssetCache,
      },
      {
        source: '/__next_static__/:path*',
        headers: immutableAssetCache,
      },
      {
        source: '/sw.js',
        headers: privateNoStoreCache,
      },
      {
        source: '/',
        headers: shortPublicPageCache,
      },
      {
        source: '/main',
        headers: shortPublicPageCache,
      },
      {
        source: '/main/latest/:path*',
        headers: shortPublicPageCache,
      },
      {
        source: '/main/news/:path*',
        headers: shortPublicPageCache,
      },
      {
        source: '/main/stories/:path*',
        headers: shortPublicPageCache,
      },
      {
        source: '/main/category/:path*',
        headers: publicPageCache,
      },
      {
        source: '/main/article/:path*',
        headers: publicPageCache,
      },
      {
        source: '/main/epaper/:path*',
        headers: publicPageCache,
      },
      {
        source: '/main/videos/:path*',
        headers: publicPageCache,
      },
      {
        source: '/main/search/:path*',
        headers: searchPageCache,
      },
      {
        // Cache election images for 5 minutes
        source: '/elections/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, stale-while-revalidate=60',
          },
        ],
      },
      {
        source: '/main/account',
        headers: privateNoStoreCache,
      },
      {
        source: '/main/saved',
        headers: privateNoStoreCache,
      },
      {
        source: '/main/preferences',
        headers: privateNoStoreCache,
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            // Keep strict MIME checking enabled so broken asset responses fail loudly.
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            // Strict Transport Security: enforce HTTPS for 1 year
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            // Content Security Policy: restrict resource loading
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc.join(' '),
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: https: blob:",
              "media-src 'self' https: blob:",
              "connect-src 'self' https: wss:",
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              'report-uri /api/security/csp-report',
            ].join('; '),
          },
          {
            // Permissions Policy: restrict browser features
            key: 'Permissions-Policy',
            value: [
              'geolocation=()',
              'microphone=()',
              'camera=()',
              'payment=()',
              'usb=()',
              'magnetometer=()',
              'gyroscope=()',
              'accelerometer=()',
            ].join(', '),
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/next/static/:path*',
        destination: '/_next/static/:path*',
      },
      {
        source: '/__next_static__/:path*',
        destination: '/_next/static/:path*',
      },
      {
        source: '/api/test-db',
        destination: '/api/health',
      },
    ];
  },
  // Configure size limits for server actions
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

module.exports = nextConfig;
