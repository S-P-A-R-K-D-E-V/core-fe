'use client';

import RoleBasedGuard from 'src/auth/guard/role-based-guard';

import BankAccountsTab from 'src/sections/store-settings/bank-accounts-tab';

// ----------------------------------------------------------------------
// Thanh toán → Tài khoản ngân hàng (chủ cửa hàng): tài khoản nhận tiền, VietQR, đăng ký báo có theo tài khoản.

export default function PaymentBankAccountsPage() {
  return (
    <RoleBasedGuard hasContent roles={['Admin']}>
      <BankAccountsTab />
    </RoleBasedGuard>
  );
}
