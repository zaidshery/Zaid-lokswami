/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV !== 'production';
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
  'res.cloudinary.com',
  '**.googleusercontent.com',
];
const extraImageHosts = (process.env.NEXT_IMAGE_ALLOWED_HOSTS || '')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);
const allowedImageHosts = Array.from(new Set([...defaultImageHosts, ...extraImageHosts]));

const nextConfig = {
  distDir: isDevelopment ? '.next-dev' : '.next',
  output: 'standalone',
  // Hostinger currently normalizes some routes to a trailing slash at the edge.
  // Disable Next.js slash redirects so paths like /admin/ do not bounce back to /admin.
  skipTrailingSlashRedirect: true,
  // Hide Next.js dev indicator (the floating "N" badge) in local dev.
  devIndicators: false,
  images: {
    unoptimized: isDevelopment,
    qualities: [60, 75, 90, 100],
    remotePatterns: allowedImageHosts.map((hostname) => ({
      protocol: 'https',
      hostname,
    })),
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/test-db',
        destination: '/api/health',
      },
    ];
  },
};

module.exports = nextConfig;
