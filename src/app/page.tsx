import type { Metadata } from 'next';

import { HomeView } from 'src/sections/home/view';

// ----------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'CiCi Accessories — Hệ thống quản lý nội bộ',
  description:
    'Nền tảng quản lý nội bộ dành cho hệ thống cửa hàng CiCi Accessories. Quản lý ca, chấm công, kiểm tiền ca, bán hàng POS, kho hàng và lương.',
};

export default function HomePage() {
  return <HomeView />;
}
