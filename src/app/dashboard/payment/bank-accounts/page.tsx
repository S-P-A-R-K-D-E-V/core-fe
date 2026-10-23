import { redirect } from 'next/navigation';

import { paymentSettingsHref } from 'src/sections/payment/payment-pages';

// Trang cũ — đã gộp vào Thanh toán → Cài đặt → Tài khoản ngân hàng.
export default function PaymentBankAccountsPage() {
  redirect(paymentSettingsHref('accounts'));
}
