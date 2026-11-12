import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { fCurrency } from 'src/utils/format-number';

import Iconify from 'src/components/iconify';

import type { IKiotVietBankAccount } from 'src/types/corecms-api';

import { buildReceiptQr } from '../receipt-print/receipt-qr';
import { transferAccountLabel } from '../receipt-print/receipt-settings';

import { buildVietQrPayload, normalizeTransferContent } from './vietqr';

// ----------------------------------------------------------------------
// QR chuyển khoản TĨNH dựng tại máy — khi mất mạng không tạo được QR qua máy chủ (spark-payment). Máy không biết tiền đã
// về: thu ngân xem app ngân hàng / loa báo rồi bấm "Đã nhận chuyển khoản". Khoản thu ghi mã tham chiếu "QR tĩnh … — chưa
// đối soát" để cuối ca đối soát. Nội dung chuyển khoản = mã tạm của hoá đơn (tra lại được).
// ----------------------------------------------------------------------

/** Mã tham chiếu ghi vào khoản thu chuyển khoản xác nhận tay. */
export const staticQrReference = (code: string) => `QR tĩnh ${code} — chưa đối soát`;

type Props = {
  amount: number;
  /** Mã tạm của hoá đơn — nội dung chuyển khoản. */
  code: string | null;
  accounts: IKiotVietBankAccount[];
  confirmed: boolean;
  onConfirm: (reference: string) => void;
  /** Có mạng: quay lại QR tự xác nhận. */
  onUseDynamic?: () => void;
};

export default function OfflineTransferQr({ amount, code, accounts, confirmed, onConfirm, onUseDynamic }: Props) {
  const [accountId, setAccountId] = useState(() => accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? '');
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];

  const qr = useMemo(() => {
    if (!account || !code || amount <= 0) return null;
    try {
      const payload = buildVietQrPayload(account.bin, account.accountNumber, Math.round(amount), code);
      return buildReceiptQr(payload, 48);
    } catch {
      return null;
    }
  }, [account, code, amount]);

  if (accounts.length === 0) {
    return (
      <Alert severity="warning" sx={{ mt: 1 }}>
        Máy này chưa lưu tài khoản nhận chuyển khoản (cần mở màn bán hàng lúc có mạng một lần). Khi mất mạng hãy thu tiền mặt
        / thẻ.
      </Alert>
    );
  }

  return (
    <Stack spacing={1} sx={{ mt: 1, p: 1.25, borderRadius: 1, border: '1px dashed', borderColor: 'warning.main' }}>
      <Stack direction="row" alignItems="center" spacing={0.75}>
        <Iconify icon="solar:qr-code-bold" width={18} />
        <Typography variant="subtitle2">QR tĩnh — xác nhận tay</Typography>
      </Stack>

      {accounts.length > 1 && (
        <TextField select size="small" label="Tài khoản nhận" value={account?.id ?? ''} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <MenuItem key={a.id} value={a.id}>
              {transferAccountLabel(a)}
            </MenuItem>
          ))}
        </TextField>
      )}

      {qr ? (
        <Box
          aria-label="Mã QR chuyển khoản tĩnh"
          sx={{ alignSelf: 'center', bgcolor: '#fff', p: 0.5, borderRadius: 1, '& svg': { width: 180, height: 180, display: 'block' } }}
          // SVG do buildReceiptQr dựng từ chuỗi VietQR (không có nội dung người dùng chèn vào HTML).
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: qr.svg }}
        />
      ) : (
        <Typography variant="caption" color="error.main">
          Không dựng được mã QR cho tài khoản này — đọc số tài khoản bên dưới cho khách.
        </Typography>
      )}

      <Box sx={{ typography: 'caption', color: 'text.secondary', lineHeight: 1.6 }}>
        <div>
          {account?.shortName || account?.bankName} · <strong>{account?.accountNumber}</strong>
          {account?.accountHolder ? ` · ${account.accountHolder}` : ''}
        </div>
        <div>
          Số tiền: <strong>{fCurrency(amount)}</strong> · Nội dung: <strong>{normalizeTransferContent(code) || '—'}</strong>
        </div>
      </Box>

      <Alert severity="warning" sx={{ py: 0 }}>
        Máy không tự biết tiền đã về. Kiểm tra app ngân hàng / loa báo rồi mới bấm xác nhận.
      </Alert>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          size="small"
          variant={confirmed ? 'outlined' : 'contained'}
          color="success"
          disabled={!code || confirmed}
          startIcon={<Iconify icon={confirmed ? 'solar:check-circle-bold' : 'solar:hand-money-bold'} />}
          onClick={() => code && onConfirm(staticQrReference(code))}
        >
          {confirmed ? 'Đã xác nhận nhận tiền' : 'Đã nhận chuyển khoản'}
        </Button>
        {onUseDynamic && (
          <Button size="small" color="inherit" onClick={onUseDynamic}>
            Dùng QR tự xác nhận
          </Button>
        )}
      </Stack>
    </Stack>
  );
}
