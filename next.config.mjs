/**
 * @type {import('next').NextConfig}
 */

const isStaticExport = 'false';

// All backend API path prefixes to proxy via rewrites.
// When BACKEND_URL is set (production/K8s), requests to these paths are
// forwarded server-side to the backend — no CORS, no backend URL exposed to browser.
const BACKEND_API_PREFIXES = [
  'auth', 'users', 'roles', 'permissions',
  'shifts', 'shift-templates', 'shift-schedules', 'shift-assignments', 'shift-swap', 'shift-registrations', 'shift-cash',
  'attendance', 'branches', 'checkin',
  'salary', 'salary-configurations', 'salary-history',
  'payroll', 'payroll-cycles',
  'holiday-policies', 'penalty-policies',
  'kiotviet', 'notification', 'notifications', 'user-tours',
  'categories', 'unit-of-measures', 'variant-attributes', 'products',
  'warehouses', 'inventory', 'suppliers', 'purchase-orders',
  'customers', 'sales-orders', 'bank-accounts', 'payment', 'reports',
  'chatbot', 'messenger',
];

const nextConfig = {
  trailingSlash: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  env: {
    BUILD_STATIC_EXPORT: isStaticExport,
  },
  experimental: {
    serverActions: {
      // Stable key across all pods/deployments — prevents "Failed to find
      // Server Action" when browser cache has JS from a previous build.
      // Provided at runtime via K8s Secret (see k8s/deployment.yaml).
      ...(process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY && {
        encryptionKey: process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,
      }),
    },
  },

  // Proxy API requests to the backend service (baked at build time into routes-manifest.json).
  // BACKEND_URL defaults to the K8s internal service URL — override via env var if needed.
  // Local dev: axios uses absolute NEXT_PUBLIC_HOST_API URL, so rewrites are never triggered.
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://core-api:5000';
    return BACKEND_API_PREFIXES.map((prefix) => ({
      source: `/${prefix}/:path*`,
      destination: `${backendUrl}/${prefix}/:path*`,
    }));
  },

  modularizeImports: {
    '@mui/icons-material': {
      transform: '@mui/icons-material/{{member}}',
    },
    '@mui/material': {
      transform: '@mui/material/{{member}}',
    },
    '@mui/lab': {
      transform: '@mui/lab/{{member}}',
    },
  },
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },
  ...(isStaticExport === 'true' && {
    output: 'export',
  }),
};

export default nextConfig;
