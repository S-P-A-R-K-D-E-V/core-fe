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

  // Proxy API requests to the backend service.
  // BACKEND_URL is a server-side env var (NOT NEXT_PUBLIC_) set in k8s/deployment.yaml.
  // Local dev: set NEXT_PUBLIC_HOST_API=http://localhost:2510 in .env.local instead.
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) return [];

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
