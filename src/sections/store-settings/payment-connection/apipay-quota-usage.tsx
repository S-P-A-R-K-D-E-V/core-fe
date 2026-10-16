'use client';

import type { IPaymentQuotaUsage, IPaymentConnection } from 'src/types/payment-service';

import { useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

import { apiErrorMessage } from 'src/utils/api-error';

import { getPaymentConnectionUsage } from 'src/api/payment-settings';

import { quotaUsageView } from './utils';

// ----------------------------------------------------------------------
// Hạn mức gói ApiPay trên thẻ kết nối: "Đã dùng X / Y GD · chu kỳ 15/10 → 15/11 · còn Z" + thanh tiến độ (vàng ≥ 80%,
// đỏ khi vượt — ApiPay vẫn chạy, trừ phí vượt vào số dư trả trước). Số liệu là ước tính của spark-payment; hạn mức và
// ngày bắt đầu chu kỳ sửa bằng "Cập nhật" (monthlyQuota / quotaCycleDay).
// ----------------------------------------------------------------------

type Props = {
  connection: Pick<IPaymentConnection, 'id' | 'publicSettings'>;
  /** Mở form Cập nhật để sửa hạn mức / ngày bắt đầu chu kỳ */
  onEdit?: VoidFunction;
};

export default function ApiPayQuotaUsage({ connection, onEdit }: Props) {
  const [usage, setUsage] = useState<IPaymentQuotaUsage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const monthlyQuota = connection.publicSettings?.monthlyQuota;
  const cycleDay = connection.publicSettings?.quotaCycleDay;

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getPaymentConnectionUsage(connection.id)
      .then((u) => !cancelled && setUsage(u))
      .catch((err) => {
        if (cancelled) return;
        setUsage(null);
        setError(apiErrorMessage(err, 'Không tải được hạn mức ApiPay'));
      });
    return () => {
      cancelled = true;
    };
    // Tải lại khi đổi hạn mức / ngày chu kỳ bằng Cập nhật.
  }, [connection.id, monthlyQuota, cycleDay]);

  if (error) {
    return (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {error}
      </Typography>
    );
  }

  if (!usage) return <Skeleton variant="rounded" height={56} aria-label="Đang tải hạn mức" />;

  const view = quotaUsageView(usage);
  const warnColor = view.color === 'error' ? 'error.main' : 'warning.dark';

  return (
    <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.neutral' }}>
      <Stack spacing={0.75}>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1}>
          <Typography variant="body2">
            <Box component="span" sx={{ fontWeight: 'fontWeightSemiBold' }}>
              Hạn mức gói ApiPay:
            </Box>{' '}
            {view.summary}
          </Typography>
          {onEdit && (
            <Link
              component="button"
              type="button"
              variant="caption"
              onClick={onEdit}
              sx={{ flexShrink: 0 }}
            >
              Sửa hạn mức
            </Link>
          )}
        </Stack>
        <LinearProgress
          variant="determinate"
          value={view.percent}
          color={view.color}
          aria-label="Hạn mức gói ApiPay đã dùng"
          sx={{ height: 6, borderRadius: 1 }}
        />
        {view.warning && (
          <Typography variant="caption" sx={{ color: warnColor }}>
            {view.warning}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {view.note}
        </Typography>
      </Stack>
    </Box>
  );
}
