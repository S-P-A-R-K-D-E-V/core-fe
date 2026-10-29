/**
 * @type {import('next').NextConfig}
 */

const isStaticExport = 'false';

// All backend API path prefixes to proxy via rewrites.
// When BACKEND_URL is set (production/K8s), requests to these paths are
// forwarded server-side to the backend — no CORS, no backend URL exposed to browser.
const BACKEND_API_PREFIXES = [
  'auth', 'users', 'roles', 'custom-roles', 'permissions', 'platform-features', 'media',
  'shifts', 'shift-templates', 'shift-schedules', 'shift-assignments', 'shift-swap', 'shift-registrations', 'shift-cash', 'late-cover', 'shift-pool', 'shift-audit', 'shift-reminder-rules',
  'attendance', 'branches', 'checkin',
  'salary', 'salary-configurations', 'salary-history',
  'payroll', 'payroll-cycles', 'payroll-complaints', 'bonus-programs',
  'holiday-policies', 'penalty-policies',
  'kiotviet', 'notification', 'notifications', 'user-tours',
  'categories', 'unit-of-measures', 'units', 'variant-attributes', 'products',
  'warehouses', 'inventory', 'suppliers', 'purchase-orders', 'shift-stock-checks',
  'customers', 'sales-orders', 'print-templates', 'bank-accounts', 'payment', 'reports',
  'chatbot', 'messenger', 'expenses', 'shareholders', 'cleaning', 'media-library',
  'admin', 'kiosk', 'kiosk-pairing', 'kiosk-devices', 'face-tracking',
  'auth-hub', 'store-settings', 'agent-keys', 'automation',
  // F&B: khu vực, bàn, thực đơn, ghi chú nhanh (trang Thiết lập F&B). Thiếu ở đây → Next trả trang 404 HTML.
  'fnb',
  // Đơn online từ storefront (trang quản trị Đơn online).
  'online-orders',
  // Kiểm tra cửa hàng: bảng kiểm, lượt kiểm, lỗi cần sửa, việc sửa tận gốc.
  'inspections', 'corrective-actions', 'shift-work',
  // Nhân sự: xin nghỉ ca, văn bản ký xác nhận, target tuần, nhiệm vụ, biên bản, điểm + xếp loại, hợp đồng lao động.
  'shift-leave', 'policy-documents', 'sales-targets', 'work-tasks', 'hr-records', 'performance', 'employment-contracts',
  // Bồi thường thiệt hại, ca hỗ trợ trên chợ ca (Phase 2).
  'hr-compensations', 'support-shifts',
  // Luật nhân sự riêng của cửa hàng; danh mục vi phạm + điểm trừ.
  'hr-rule-settings', 'hr-violations',
  // Kết nối hãng vận chuyển (Thanh toán → Cài đặt → Bán online & giao hàng) — chuyển tiếp spark-shipping.
  'shipping',
  // API công khai của cửa hàng (thương hiệu, sản phẩm) — app mobile bản cửa hàng dùng để kiểm tra mã cửa hàng.
  'public',
  // Màn hình khách ở quầy (quảng cáo theo chi nhánh). Trang /customer-display/ là của Next, API dùng tiền tố khác.
  'pos-display',
  // Đặt trình duyệt làm máy quầy (JWT quản lý). /counter/* (key máy quầy) gọi qua /api — trùng trang /counter của Next.
  'counter-devices',
  // Trả hàng từ hoá đơn (máy quầy + quản lý).
  'sales-returns',
  // Nhập phiếu từ ảnh hoá đơn NCC (đọc ảnh bằng AI, gợi ý mã, tạo phiếu nhập nháp).
  'purchase-imports',
  // Tin tức của cửa hàng (trang quản trị /dashboard/tin-tuc, trợ lý AI viết bài).
  'store-posts',
];

const nextConfig = {
  trailingSlash: true,
  // Tắt bộ tối ưu ảnh (/_next/image trả 404): Next 14.2 dính lỗ hổng RCE của Image Optimization API (vá ở 15.5.24+).
  // Ảnh dùng thẳng file gốc. Bật lại khi đã nâng Next.
  images: { unoptimized: true },
  // Không lộ "X-Powered-By: Next.js".
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  env: {
    BUILD_STATIC_EXPORT: isStaticExport,
  },
  experimental: {
    // rewrites() tới core-api cắt kết nối sau 30 giây (mặc định) — lệnh dài trả "Internal Server Error". Trợ lý AI viết
    // bài đã đi đường stream riêng (app/store-posts-ai); nới thêm cho các lệnh không stream.
    proxyTimeout: 120_000,
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
