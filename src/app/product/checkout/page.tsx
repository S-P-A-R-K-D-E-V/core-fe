'use client';

import { AuthGuard } from 'src/auth/guard';
import { CheckoutView } from 'src/sections/checkout/view';

// ----------------------------------------------------------------------

export default function CheckoutPage() {
  return (
    <AuthGuard>
      <CheckoutView />
    </AuthGuard>
  );
}
