'use client';

import type { IPaymentConnectionTestResult } from 'src/types/payment-service';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import CopyField from './copy-field';

// ----------------------------------------------------------------------
// Kết quả "Kiểm tra kết nối" ngân hàng trực tiếp (lấy token ngân hàng). bankTraceId để gửi ngân hàng khi cần tra lỗi.
// ----------------------------------------------------------------------

type Props = {
  /** null = đóng */
  result: IPaymentConnectionTestResult | null;
  connectionName?: string;
  onClose: VoidFunction;
};

export default function ConnectionTestDialog({ result, connectionName, onClose }: Props) {
  const rows: { label: string; value: string }[] = [];
  if (result) {
    if (result.outcome) rows.push({ label: 'Kết quả', value: result.outcome });
    if (result.httpStatus) rows.push({ label: 'HTTP', value: String(result.httpStatus) });
    if (result.code) rows.push({ label: 'Mã', value: result.code });
    if (result.logId) rows.push({ label: 'Mã nhật ký', value: result.logId });
  }

  return (
    <Dialog
      fullWidth
      maxWidth="sm"
      open={!!result}
      onClose={onClose}
      aria-labelledby="payment-connection-test-title"
    >
      <DialogTitle id="payment-connection-test-title">
        Kiểm tra kết nối{connectionName ? ` · ${connectionName}` : ''}
      </DialogTitle>
      <DialogContent dividers>
        {result && (
          <Stack spacing={2}>
            <Alert severity={result.success ? 'success' : 'error'}>
              {result.success
                ? 'Kết nối được với ngân hàng (lấy được token).'
                : 'Ngân hàng từ chối hoặc không trả lời — kiểm tra lại khoá và môi trường (sandbox / production).'}
              {result.message ? (
                <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                  {result.message}
                </Box>
              ) : null}
            </Alert>

            {rows.length > 0 && (
              <Box
                component="dl"
                sx={{
                  m: 0,
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  columnGap: 2,
                  rowGap: 0.75,
                }}
              >
                {rows.map((r) => (
                  <Box key={r.label} sx={{ display: 'contents' }}>
                    <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>
                      {r.label}
                    </Typography>
                    <Typography
                      component="dd"
                      variant="body2"
                      sx={{ m: 0, fontFamily: 'monospace' }}
                    >
                      {r.value}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {result.bankTraceId && (
              <CopyField
                label="Mã tra soát của ngân hàng (bankTraceId)"
                value={result.bankTraceId}
                copiedMessage="Đã sao chép mã tra soát"
                helperText="Gửi mã này cho ngân hàng khi cần tra lỗi."
              />
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
