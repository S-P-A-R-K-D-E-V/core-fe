import { redirect } from 'next/navigation';

import { paths } from 'src/routes/paths';

// Trang cũ — đã gộp vào mục Thanh toán → Đơn online.
export default function OnlineOrdersPage() {
  redirect(paths.dashboard.payment.onlineOrders);
}
