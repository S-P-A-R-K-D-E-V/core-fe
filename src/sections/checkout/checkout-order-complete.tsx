import { m, AnimatePresence } from 'framer-motion';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Paper, { PaperProps } from '@mui/material/Paper';
import Dialog, { DialogProps } from '@mui/material/Dialog';

import { OrderCompleteIllustration } from 'src/assets/illustrations';

import Iconify from 'src/components/iconify';
import { varFade } from 'src/components/animate';

// ----------------------------------------------------------------------

interface Props extends DialogProps {
  orderId?: string;
  onReset: VoidFunction;
  onDownloadPDF: VoidFunction;
}

export default function CheckoutOrderComplete({ open, orderId, onReset }: Props) {
  const renderContent = (
    <Stack
      spacing={5}
      sx={{
        m: 'auto',
        maxWidth: 480,
        textAlign: 'center',
        px: { xs: 2, sm: 0 },
      }}
    >
      <Typography variant="h4">Cảm ơn bạn đã đặt hàng!</Typography>

      <OrderCompleteIllustration sx={{ height: 260 }} />

      <Typography>
        Đơn hàng của bạn đã được tiếp nhận thành công.
        {orderId && (
          <>
            <br />
            <br />
            Mã đơn hàng:{' '}
            <Link component="span" fontWeight="bold">
              {orderId}
            </Link>
          </>
        )}
        <br />
        <br />
        Shop sẽ liên hệ xác nhận trong vòng 30 phút.
        <br />
        Nếu có thắc mắc, nhắn tin cho CiCi qua Messenger nhé!
      </Typography>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Stack
        spacing={2}
        justifyContent="space-between"
        direction={{ xs: 'column-reverse', sm: 'row' }}
      >
        <Button
          fullWidth
          size="large"
          color="inherit"
          variant="outlined"
          onClick={onReset}
          startIcon={<Iconify icon="eva:arrow-ios-back-fill" />}
        >
          Tiếp tục mua sắm
        </Button>

        <Button
          fullWidth
          size="large"
          variant="contained"
          component="a"
          href="https://m.me/ciciaccessories"
          target="_blank"
          rel="noopener"
          startIcon={<Iconify icon="logos:messenger" width={20} />}
        >
          Nhắn tin với shop
        </Button>
      </Stack>
    </Stack>
  );

  return (
    <AnimatePresence>
      {open && (
        <Dialog
          fullWidth
          fullScreen
          open={open}
          PaperComponent={(props: PaperProps) => (
            <Box
              component={m.div}
              {...varFade({
                distance: 120,
                durationIn: 0.32,
                durationOut: 0.24,
                easeIn: 'easeInOut',
              }).inUp}
              sx={{
                width: 1,
                height: 1,
                p: { md: 3 },
              }}
            >
              <Paper {...props}>{props.children}</Paper>
            </Box>
          )}
        >
          {renderContent}
        </Dialog>
      )}
    </AnimatePresence>
  );
}
