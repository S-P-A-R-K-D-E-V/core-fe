'use client';

import { useMemo, useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { getBatchHourWarnings } from 'src/api/hr';
import {
  HOUR_WARNING_SEVERE,
  type IProposedAssignment,
  type IProposedAssignmentWarnings,
} from 'src/types/hr';

// ----------------------------------------------------------------------
// Cảnh báo cho ca dự kiến trước khi lưu (A1): xếp ca thẳng, xếp nhiều người một ô, xem trước phân công tự động. Mỗi ca
// được xét cùng lịch đã có và các ca khác trong lô (backend POST /shift-assignments/hour-warnings/batch). Chỉ cảnh báo.
// ----------------------------------------------------------------------

const MAX_ITEMS = 500;

/** Cảnh báo của lô `items` (đợi 300 ms sau lần đổi cuối); lỗi mạng → rỗng, không chặn việc xếp ca. */
export function useBatchHourWarnings(items: IProposedAssignment[], enabled = true) {
  const [result, setResult] = useState<IProposedAssignmentWarnings[]>([]);
  const [loading, setLoading] = useState(false);
  const key = enabled ? JSON.stringify(items.slice(0, MAX_ITEMS)) : '';

  useEffect(() => {
    if (!key || key === '[]') {
      setResult([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      getBatchHourWarnings(JSON.parse(key) as IProposedAssignment[])
        .then((r) => !cancelled && setResult(r))
        .catch(() => !cancelled && setResult([]))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);

  return { result, loading };
}

/**
 * Danh sách cảnh báo theo từng ca dự kiến: "Tên · ngày · ca — • lời cảnh báo". `nameOf` / `shiftOf` đổi id ra chữ.
 */
export function ProposedWarningsAlert({
  result,
  nameOf,
  shiftOf,
  title = 'Cảnh báo theo Nội quy (chỉ cảnh báo, vẫn lưu được)',
}: {
  result: IProposedAssignmentWarnings[];
  nameOf: (staffId: string) => string;
  shiftOf?: (shiftScheduleId: string) => string;
  title?: string;
}) {
  const severe = useMemo(
    () => result.some((r) => r.warnings.some((w) => HOUR_WARNING_SEVERE.includes(w.code))),
    [result]
  );
  if (result.length === 0) return null;

  return (
    <Alert severity={severe ? 'error' : 'warning'}>
      <Stack spacing={0.75}>
        <Typography variant="subtitle2">{title}</Typography>
        {result.map((r) => (
          <Stack key={r.index} spacing={0.25}>
            <Typography variant="body2" fontWeight={600}>
              {nameOf(r.staffId)} · {r.date.slice(8, 10)}/{r.date.slice(5, 7)}
              {shiftOf ? ` · ${shiftOf(r.shiftScheduleId)}` : ''}
            </Typography>
            {r.warnings.map((w) => (
              <Typography key={w.code} variant="body2">
                • {w.message}
              </Typography>
            ))}
          </Stack>
        ))}
      </Stack>
    </Alert>
  );
}
