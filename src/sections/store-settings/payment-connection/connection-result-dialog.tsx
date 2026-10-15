'use client';

import type { IPaymentConnection, IPaymentProviderInfo } from 'src/types/payment-service';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import AlertTitle from '@mui/material/AlertTitle';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import FormControlLabel from '@mui/material/FormControlLabel';

import { paymentProviderLabel } from 'src/utils/payment-status';

import CopyField from './copy-field';
import { findProvider, credentialLabel, webhookUrlEntries, hasGeneratedSecrets } from './utils';

// ----------------------------------------------------------------------
// Kết quả tạo kết nối / tạo lại khoá webhook: khoá hệ thống tự sinh (generatedSecrets) hiện MỘT lần — phải tick "Tôi
// đã lưu" mới đóng được — và mọi webhook URL để dán vào trang nhà cung cấp / gửi ngân hàng.
// ----------------------------------------------------------------------

type Props = {
  /** null = đóng */
  connection: IPaymentConnection | null;
  providers: IPaymentProviderInfo[];
  /** "created" = vừa tạo; "rotated" = vừa tạo lại khoá webhook */
  reason: 'created' | 'rotated';
  paymentCodePrefix?: string;
  onClose: VoidFunction;
};

export default function ConnectionResultDialog({
  connection,
  providers,
  reason,
  paymentCodePrefix,
  onClose,
}: Props) {
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    setAcknowledged(false);
  }, [connection]);

  const provider = findProvider(providers, connection?.provider);
  const secrets = hasGeneratedSecrets(connection)
    ? Object.entries(connection!.generatedSecrets!)
    : [];
  const mustAcknowledge = secrets.length > 0;
  const urls = connection ? webhookUrlEntries(connection) : [];
  const providerName = connection ? paymentProviderLabel(connection.provider) : '';
  const closable = !mustAcknowledge || acknowledged;

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={!!connection}
      // Còn khoá chưa xác nhận đã lưu → không cho đóng bằng Esc / bấm ra ngoài.
      onClose={closable ? onClose : undefined}
      disableEscapeKeyDown={!closable}
      aria-labelledby="payment-connection-result-title"
    >
      <DialogTitle id="payment-connection-result-title">
        {reason === 'created' ? `Đã thêm kết nối ${providerName}` : 'Đã tạo khoá webhook mới'}
      </DialogTitle>

      <DialogContent dividers>
        {connection && (
          <Stack spacing={2.5}>
            {mustAcknowledge && (
              <Stack spacing={1.5}>
                <Alert severity="error" variant="outlined">
                  <AlertTitle>Lưu các khoá này ngay — chỉ hiện MỘT lần</AlertTitle>
                  Đóng hộp thoại là không xem lại được nữa
                  {reason === 'rotated' ? '; khoá cũ đã hết hiệu lực' : ''}. Gửi khoá cho{' '}
                  {providerName} qua kênh an toàn, không dán vào nhóm chat hay chụp màn hình gửi
                  người khác.
                </Alert>
                {secrets.map(([key, value]) => (
                  <CopyField
                    key={key}
                    label={credentialLabel(provider, key)}
                    value={value}
                    copiedMessage="Đã sao chép khoá"
                  />
                ))}
              </Stack>
            )}

            {urls.length > 0 && (
              <Stack spacing={1.5}>
                <Typography variant="subtitle2">
                  {urls.length > 1 ? 'Các webhook URL' : 'Webhook URL'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {connection.kind === 'bank_direct'
                    ? `Gửi ${urls.length > 1 ? 'các URL' : 'URL'} dưới đây cho ${providerName} khi đăng ký nhận báo có.`
                    : `Dán URL dưới đây vào trang quản trị ${providerName} để tiền về được báo ngay.`}
                </Typography>
                {urls.map((u) => (
                  <CopyField
                    key={u.key}
                    label={u.label}
                    value={u.url}
                    copiedMessage="Đã sao chép webhook URL"
                  />
                ))}
              </Stack>
            )}

            {reason === 'created' && connection.kind === 'bank_feed' && paymentCodePrefix && (
              <Alert severity="info">
                Tiền chỉ tự khớp khi nội dung chuyển khoản có mã thanh toán bắt đầu bằng &quot;
                {paymentCodePrefix}&quot; (vd {paymentCodePrefix}K7Q2M9X) — cấu hình nhận diện mã
                đúng như vậy bên {providerName}.
              </Alert>
            )}

            {reason === 'created' && provider && provider.setupSteps.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="subtitle2">Bước tiếp theo</Typography>
                <Box
                  component="ol"
                  sx={{ pl: 2.5, m: 0, typography: 'body2', '& li + li': { mt: 0.5 } }}
                >
                  {provider.setupSteps.map((step, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <li key={i}>{step}</li>
                  ))}
                </Box>
              </Stack>
            )}

            {mustAcknowledge && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                  />
                }
                label="Tôi đã lưu các khoá trên ở nơi an toàn"
              />
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions>
        <Button variant="contained" onClick={onClose} disabled={!closable}>
          {mustAcknowledge ? 'Tôi đã lưu, đóng' : 'Xong'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
