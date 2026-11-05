'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  getBankApps,
  detectMobileOs,
  buildBankDeeplink,
  type VietQrBankApp,
} from 'src/utils/vietqr';

import Iconify from 'src/components/iconify';

// ----------------------------------------------------------------------
// "Mở app ngân hàng" — chỉ hiện khi trang mở trên điện thoại: chọn app ngân hàng của người chuyển, bấm là mở app qua
// dl.vietqr.io. App có điền sẵn (VietinBank, BIDV, OCB, ACB, MB — danh sách api.vietqr.io 05/11/2026) nhận luôn STK,
// số tiền, nội dung; app khác chỉ mở app, người dùng dán thông tin đã sao chép hoặc quét QR từ ảnh đã lưu.
// ----------------------------------------------------------------------

const STORAGE_KEY = 'payroll.bankAppId';

function readSavedApp(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveApp(appId: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, appId);
  } catch {
    /* private mode */
  }
}

type Props = {
  bankCode: string;
  account: string;
  amount: number;
  content: string;
  accountName?: string | null;
};

export default function BankAppDeeplink({
  bankCode,
  account,
  amount,
  content,
  accountName,
}: Props) {
  const [os] = useState(() => detectMobileOs());
  const [apps, setApps] = useState<VietQrBankApp[]>([]);
  const [failed, setFailed] = useState(false);
  const [appId, setAppId] = useState('');

  useEffect(() => {
    if (!os) return undefined;
    let cancelled = false;
    getBankApps(os)
      .then((list) => {
        if (cancelled) return;
        setApps(list);
        const saved = readSavedApp();
        setAppId(list.some((a) => a.appId === saved) ? saved : '');
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [os]);

  const app = apps.find((a) => a.appId === appId);

  const href = useMemo(
    () =>
      app
        ? buildBankDeeplink({
            appId: app.appId,
            bankCode,
            account,
            amount,
            content,
            accountName,
            returnUrl: window.location.href,
          })
        : null,
    [app, bankCode, account, amount, content, accountName]
  );

  if (!os) {
    return (
      <Typography variant="caption" color="text.disabled" display="block" textAlign="center">
        Mở trang này trên điện thoại để bấm mở thẳng app ngân hàng.
      </Typography>
    );
  }

  if (failed) return null;

  return (
    <Stack spacing={1}>
      <TextField
        select
        size="small"
        label="App ngân hàng của bạn"
        value={appId}
        onChange={(e) => {
          setAppId(e.target.value);
          saveApp(e.target.value);
        }}
        SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 360 } } } }}
      >
        {apps.map((a) => (
          <MenuItem key={a.appId} value={a.appId}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ width: 1 }}>
              <Box
                component="img"
                src={a.appLogo}
                alt=""
                referrerPolicy="no-referrer"
                sx={{ width: 24, height: 24, borderRadius: 0.75 }}
              />
              <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                {a.appName}
              </Typography>
              {a.autofill ? (
                <Chip size="small" color="success" variant="soft" label="Điền sẵn" />
              ) : null}
            </Stack>
          </MenuItem>
        ))}
      </TextField>

      <Button
        fullWidth
        variant="contained"
        disabled={!href}
        href={href ?? undefined}
        startIcon={<Iconify icon="solar:smartphone-bold-duotone" width={18} />}
      >
        Mở app ngân hàng
      </Button>

      {app ? (
        <Typography variant="caption" color="text.secondary">
          {app.autofill
            ? `${app.appName} sẽ điền sẵn số tài khoản, số tiền và nội dung — kiểm tra lại rồi xác nhận trong app.`
            : `${app.appName} chưa hỗ trợ điền sẵn: app chỉ được mở lên, hãy dán số tài khoản / nội dung đã sao chép hoặc quét QR từ ảnh đã tải.`}
        </Typography>
      ) : null}
    </Stack>
  );
}
