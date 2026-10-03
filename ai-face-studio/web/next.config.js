/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'microphone=(), geolocation=()' },
];

// Two build targets from one codebase:
// - default (Vercel): a normal server build, with the security headers below.
// - BUILD_TARGET=capacitor (`npm run build:capacitor`): a fully static export into `out/`,
//   because `headers()`/server features aren't available in `output: 'export'` mode and
//   Capacitor needs local files to bundle into the Android app (no server at runtime).
const isCapacitorBuild = process.env.BUILD_TARGET === 'capacitor';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  poweredByHeader: false,
};

if (isCapacitorBuild) {
  config.output = 'export';
} else {
  config.headers = async () => [{ source: '/:path*', headers: securityHeaders }];
}

module.exports = config;
