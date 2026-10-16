import type { Metadata } from 'next';

// Màn hình khách ở quầy: cửa sổ riêng do trang bán hàng mở, không khung dashboard. Không gọi API — nội dung do trang
// bán hàng cùng trình duyệt đẩy sang (src/sections/customer-display/customer-display-bus.ts).

export const metadata: Metadata = {
  title: 'Màn hình khách',
};

type Props = {
  children: React.ReactNode;
};

export default function CustomerDisplayLayout({ children }: Props) {
  return children;
}
