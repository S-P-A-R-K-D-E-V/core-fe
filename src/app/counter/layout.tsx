import type { Metadata } from 'next';

// Máy quầy: màn chọn nhân viên đăng nhập, không khung dashboard (src/sections/counter).

export const metadata: Metadata = {
  title: 'Máy quầy',
};

type Props = {
  children: React.ReactNode;
};

export default function CounterLayout({ children }: Props) {
  return children;
}
