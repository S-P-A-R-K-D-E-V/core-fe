'use client';

import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';

import { PRODUCT_CHECKOUT_STEPS } from 'src/_mock/_product';

import { useSettingsContext } from 'src/components/settings';

import CheckoutCart from '../checkout-cart';
import CheckoutSteps from '../checkout-steps';
import { useCheckoutContext } from '../context';
import CheckoutDeliveryPayment from '../checkout-delivery-payment';

// ----------------------------------------------------------------------
// Đặt hàng online: Giỏ hàng → Nhận hàng & thanh toán. Đặt xong chuyển sang trang đơn (/order/{mã}) — mã QR / cổng thanh
// toán, tự cập nhật khi tiền về. Khách không cần đăng nhập.
// ----------------------------------------------------------------------

export default function CheckoutView() {
  const settings = useSettingsContext();

  const checkout = useCheckoutContext();
  const step = Math.min(checkout.activeStep, PRODUCT_CHECKOUT_STEPS.length - 1);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'} sx={{ mb: 10 }}>
      <Typography variant="h4" component="h1" sx={{ my: { xs: 3, md: 5 } }}>
        Đặt hàng
      </Typography>

      <Grid container>
        <Grid size={{ xs: 12, md: 8 }}>
          <CheckoutSteps activeStep={step} steps={PRODUCT_CHECKOUT_STEPS} />
        </Grid>
      </Grid>

      {step === 0 && <CheckoutCart />}

      {step === 1 && (checkout.items.length > 0 ? <CheckoutDeliveryPayment /> : <CheckoutCart />)}
    </Container>
  );
}
