import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';

// ----------------------------------------------------------------------
// Nhãn nhà cung cấp kênh báo tiền về (payOS, ApiPay, GPMPay…) — cùng bộ màu / chữ viết tắt với trang S Payment.
// Logo chính thức: thả file vào public/assets/icons/payment-providers/<mã>.png rồi thêm mã vào LOGO_FILES — chưa có file thì
// hiện chữ viết tắt trên nền màu nhận diện.
// ----------------------------------------------------------------------

type Brand = { name: string; mark: string; color: string; title: string };

const BRANDS: Record<string, Brand> = {
  payos: {
    name: 'payOS',
    mark: 'pO',
    color: '#00a86b',
    title: 'payOS — QR vào tài khoản ảo, tiền về thẳng tài khoản',
  },
  apipay: {
    name: 'ApiPay',
    mark: 'AP',
    color: '#2f6fed',
    title: 'ApiPay — báo biến động số dư qua tài khoản ảo (VA)',
  },
  sepay: { name: 'SePay', mark: 'SP', color: '#1d4ed8', title: 'SePay — báo biến động số dư' },
  casso: { name: 'Casso', mark: 'CA', color: '#0f766e', title: 'Casso — báo biến động số dư' },
  pay2s: { name: 'Pay2S', mark: 'P2', color: '#2e7d4f', title: 'Pay2S — báo biến động số dư' },
  gpmpay: {
    name: 'GPMPay',
    mark: 'GP',
    color: '#0f2a6b',
    title: 'GPMPay — báo biến động số dư MB',
  },
  acb: {
    name: 'ACB',
    mark: 'ACB',
    color: '#1e3a8a',
    title: 'Ngân hàng báo có trực tiếp (Open Banking)',
  },
  mbbank: {
    name: 'MB',
    mark: 'MB',
    color: '#1e40af',
    title: 'Ngân hàng báo có trực tiếp (Open Banking)',
  },
  bidv: {
    name: 'BIDV',
    mark: 'BV',
    color: '#065f46',
    title: 'Ngân hàng báo có trực tiếp (Open Banking)',
  },
  vietinbank: {
    name: 'VietinBank',
    mark: 'VT',
    color: '#b91c1c',
    title: 'Ngân hàng báo có trực tiếp (Open Banking)',
  },
  vietqr: {
    name: 'QR thường',
    mark: 'QR',
    color: '#6b7280',
    title: 'Chỉ tạo QR — thu ngân tự kiểm tra tiền về',
  },
  vnpay: { name: 'VNPay', mark: 'VN', color: '#dc2626', title: 'Cổng thanh toán VNPay' },
  mockbank: {
    name: 'Giả lập',
    mark: 'GL',
    color: '#9ca3af',
    title: 'Ngân hàng giả lập (thử nghiệm)',
  },
};

/** Mã nhà cung cấp đã có file logo trong public/assets/icons/payment-providers. */
const LOGO_FILES = new Set<string>(['payos', 'apipay', 'gpmpay', 'pay2s', 'sepay']);

export function providerBrand(provider: string): Brand {
  return (
    BRANDS[provider] ?? {
      name: provider,
      mark: provider.slice(0, 2).toUpperCase(),
      color: '#6b7280',
      title: provider,
    }
  );
}

type Props = {
  provider: string;
  /** Ẩn tên, chỉ hiện logo (danh sách chật). */
  compact?: boolean;
};

export function ProviderLogo({ provider, compact }: Props) {
  const brand = providerBrand(provider);
  return (
    <Tooltip title={brand.title}>
      <Box
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          pl: '2px',
          pr: compact ? '2px' : 1,
          py: '2px',
          borderRadius: 99,
          border: `1px solid ${brand.color}55`,
          bgcolor: `${brand.color}14`,
          fontSize: 12,
          lineHeight: '18px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {LOGO_FILES.has(provider) ? (
          <Box
            component="img"
            src={`/assets/icons/payment-providers/${provider}.png`}
            alt={brand.name}
            sx={{
              width: 18,
              height: 18,
              borderRadius: '5px',
              objectFit: 'contain',
              bgcolor: '#fff',
            }}
          />
        ) : (
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 18,
              height: 18,
              px: '4px',
              borderRadius: 99,
              bgcolor: brand.color,
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {brand.mark}
          </Box>
        )}
        {!compact && (
          <Box component="span" sx={{ color: brand.color, fontWeight: 600 }}>
            {brand.name}
          </Box>
        )}
      </Box>
    </Tooltip>
  );
}

/** Các nhà cung cấp của một tài khoản (bỏ trùng, giữ thứ tự). */
export function ProviderLogos({
  providers,
  compact,
}: {
  providers: (string | null | undefined)[];
  compact?: boolean;
}) {
  const unique = Array.from(new Set(providers.filter((p): p is string => !!p)));
  if (unique.length === 0) return null;
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" component="span">
      {unique.map((p) => (
        <ProviderLogo key={p} provider={p} compact={compact} />
      ))}
    </Stack>
  );
}
