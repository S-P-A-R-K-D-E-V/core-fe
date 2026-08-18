import type { Metadata } from 'next';

// Route CÔNG KHAI, không đăng nhập user thường — không bọc AuthGuard (khác src/app/dashboard/
// layout.tsx). Kiosk tự xác thực bằng device key riêng (X-Kiosk-Key), xem src/hooks/use-kiosk-device.ts.

export const metadata: Metadata = {
  title: 'Kiosk Chấm Công',
};

type Props = {
  children: React.ReactNode;
};

export default function KioskCheckinLayout({ children }: Props) {
  return children;
}
