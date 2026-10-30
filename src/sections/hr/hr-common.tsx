'use client';

import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import type { IHourWarning, IPerformanceScore, IPersonHourWarnings } from 'src/types/hr';
import { HOUR_WARNING_SEVERE } from 'src/types/hr';

// ----------------------------------------------------------------------
// Phần dùng chung của các trang Nhân sự.
// ----------------------------------------------------------------------

/** 1.250.000đ — số nguyên, dấu chấm hàng nghìn. */
export function fVnd(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

/** Số tiền nhập (có thể có dấu trừ, dấu chấm hàng nghìn) → số. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[^\d-]/g, '');
  if (!cleaned || cleaned === '-') return null;
  return Number(cleaned);
}

export function fPct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
}

/** Ngày đầu tháng "yyyy-MM-01" của một ngày "yyyy-MM-dd" hoặc Date. */
export function monthStart(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00`) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Ngày cuối tháng "yyyy-MM-dd" của "yyyy-MM-01". */
export function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${month.slice(0, 7)}-${String(last).padStart(2, '0')}`;
}

/** Tháng trước của "yyyy-MM-01". */
export function previousMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return monthStart(new Date(y, m - 2, 1));
}

/** Xếp hạng theo tổng điểm, bằng điểm cùng hạng. Chưa có ca hoặc điểm mặc định (người mới) không có hạng, đứng cuối. */
export function rankScores(scores: IPerformanceScore[]): { score: IPerformanceScore; rank: number | null }[] {
  const isRanked = (s: IPerformanceScore) => s.shiftCount > 0 && !s.isDefaultScore;
  const ranked = scores.filter(isRanked).sort((a, b) => b.total - a.total);
  let rank = 0;
  return [
    ...ranked.map((score, i) => {
      if (i === 0 || score.total !== ranked[i - 1].total) rank = i + 1;
      return { score, rank };
    }),
    ...scores.filter((s) => !isRanked(s)).map((score) => ({ score, rank: null })),
  ];
}

export function MonthField({ value, onChange, label = 'Tháng' }: { value: string; onChange: (month: string) => void; label?: string }) {
  return (
    <TextField
      type="month"
      size="small"
      label={label}
      value={value.slice(0, 7)}
      onChange={(e) => e.target.value && onChange(`${e.target.value}-01`)}
      InputLabelProps={{ shrink: true }}
      sx={{ width: 180 }}
    />
  );
}

/**
 * Cảnh báo giờ làm theo Nội quy Điều 5–6 cho người duyệt / xếp ca. Chỉ cảnh báo — người duyệt vẫn duyệt được (chủ tịch
 * 2026-10-27).
 */
export function HourWarningsAlert({
  people,
  warnings,
  dense = false,
}: {
  people?: IPersonHourWarnings[] | null;
  warnings?: IHourWarning[] | null;
  dense?: boolean;
}) {
  const groups: { role: string | null; warnings: IHourWarning[] }[] = [
    ...(people ?? []).filter((p) => p.warnings.length > 0).map((p) => ({ role: p.role, warnings: p.warnings })),
    ...(warnings && warnings.length > 0 ? [{ role: null, warnings }] : []),
  ];
  if (groups.length === 0) return null;

  const severe = groups.some((g) => g.warnings.some((w) => HOUR_WARNING_SEVERE.includes(w.code)));
  return (
    <Alert severity={severe ? 'error' : 'warning'} sx={dense ? { py: 0, '& .MuiAlert-message': { py: 0.5 } } : undefined}>
      <Stack spacing={0.5}>
        {groups.map((g, i) => (
          <Stack key={g.role ?? i} spacing={0.25}>
            {g.role && <Typography variant="subtitle2">{g.role}</Typography>}
            {g.warnings.map((w) => (
              <Typography key={w.code} variant="body2">
                • {w.message}
              </Typography>
            ))}
          </Stack>
        ))}
        {!dense && (
          <Typography variant="caption" color="text.secondary">
            Chỉ cảnh báo — bạn vẫn duyệt / xếp được nếu đã trao đổi với nhân viên.
          </Typography>
        )}
      </Stack>
    </Alert>
  );
}
