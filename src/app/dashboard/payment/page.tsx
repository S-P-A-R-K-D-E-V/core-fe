import { redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

// Mở mục Thanh toán ở tab Đối soát (chủ + quản lý đều xem được).
export default function PaymentPage() {
  redirect(paths.dashboard.payment.reconciliation);
}
