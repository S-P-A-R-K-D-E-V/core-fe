'use client';

import { useEffect, useRef, useState } from 'react';

import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';
import { useRouter, useSearchParams } from 'src/routes/hooks';

import { apiErrorMessage } from 'src/utils/api-error';

import { useAuthContext } from 'src/auth/hooks';
import { PATH_AFTER_LOGIN } from 'src/config-global';
import { safeReturnPath, takeCentralLoginState } from 'src/auth/utils/saas-host';

// ----------------------------------------------------------------------

/**
 * Chạy trên tên miền cửa hàng (<mã>.devbyspark.com). auth.devbyspark.com chuyển về đây kèm mã dùng
 * một lần; chỉ đổi mã khi state khớp với state chính trang này đã tạo trước khi đi (chống login CSRF).
 */
export default function SsoCallbackView() {
  const { loginWithSso } = useAuthContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const returnTo = safeReturnPath(searchParams.get('returnTo'), PATH_AFTER_LOGIN);
    const expectedState = takeCentralLoginState();

    // Bỏ mã khỏi thanh địa chỉ/lịch sử ngay, dù đổi được hay không.
    window.history.replaceState(null, '', window.location.pathname);

    if (!code || !state || !expectedState || state !== expectedState) {
      setErrorMsg('Phiên đăng nhập không hợp lệ hoặc đã mở ở tab khác. Vui lòng đăng nhập lại.');
      return;
    }

    loginWithSso?.(code, state)
      .then(() => router.replace(returnTo === '/' ? PATH_AFTER_LOGIN : returnTo))
      .catch((err: any) => {
        setErrorMsg(apiErrorMessage(err, 'Không đăng nhập được. Mã đăng nhập đã hết hạn, vui lòng thử lại.'));
      });
  }, [loginWithSso, router, searchParams]);

  if (errorMsg) {
    return (
      <Stack spacing={2}>
        <Alert severity="error">{errorMsg}</Alert>
        <Link component={RouterLink} href={paths.auth.jwt.login} variant="subtitle2">
          Quay lại trang đăng nhập
        </Link>
      </Stack>
    );
  }

  return (
    <Stack spacing={2} alignItems="center" sx={{ py: 5 }}>
      <CircularProgress />
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Đang đăng nhập…
      </Typography>
    </Stack>
  );
}
