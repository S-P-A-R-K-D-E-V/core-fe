import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { fCurrency } from 'src/utils/format-number';

// ----------------------------------------------------------------------
// Tóm tắt tiền ở trang đặt hàng: tiền hàng + phí ship = tổng. Phí ship chưa có (chưa chọn địa chỉ) thì ghi rõ; số cuối
// cùng do máy chủ tính lại khi đặt.
// ----------------------------------------------------------------------

type Props = {
  subTotal: number;
  /** undefined = chưa tính (chưa chọn cách nhận / địa chỉ); 0 = miễn phí */
  shipping?: number | null;
  shippingNote?: string | null;
  freeShipping?: boolean;
  children?: React.ReactNode;
};

export default function CheckoutSummary({ subTotal, shipping, shippingNote, freeShipping, children }: Props) {
  const known = shipping !== undefined && shipping !== null;
  const total = subTotal + (known ? (shipping as number) : 0);

  return (
    <Card sx={{ mb: 3 }}>
      <CardHeader title="Tóm tắt đơn hàng" />

      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Tiền hàng
            </Typography>
            <Typography variant="subtitle2">{fCurrency(subTotal)}</Typography>
          </Stack>

          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Typography variant="body2" sx={{ color: 'text.secondary', flexShrink: 0 }}>
              Phí giao hàng
            </Typography>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="subtitle2">
                {!known ? '—' : freeShipping || shipping === 0 ? 'Miễn phí' : fCurrency(shipping as number)}
              </Typography>
              {shippingNote && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {shippingNote}
                </Typography>
              )}
            </Box>
          </Stack>

          <Divider sx={{ borderStyle: 'dashed' }} />

          <Stack direction="row" justifyContent="space-between">
            <Typography variant="subtitle1">Tổng thanh toán</Typography>
            <Typography variant="subtitle1" sx={{ color: 'error.main' }}>
              {fCurrency(total)}
            </Typography>
          </Stack>

          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}
