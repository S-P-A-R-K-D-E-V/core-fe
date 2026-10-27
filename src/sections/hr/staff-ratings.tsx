'use client';

import { useState, useEffect } from 'react';

import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';

import { useAuthContext } from 'src/auth/hooks';
import { getPerformanceMonth } from 'src/api/hr';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import { PERFORMANCE_RATING_COLOR, PERFORMANCE_RATING_LABEL, type PerformanceRating } from 'src/types/hr';

// ----------------------------------------------------------------------
// Điểm hiệu suất tháng gần nhất cạnh tên người ở màn xếp ca / đăng ký ca (A3) — chỉ để người xếp tham khảo, không quyết
// định thứ tự đăng ký. Cần hr.performance.read (mặc định Admin + Quản lý).
// ----------------------------------------------------------------------

export type StaffRating = { rating: PerformanceRating; total: number; month: string; published: boolean };

const monthKey = (offset: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

/** Điểm tháng trước (chưa tính thì tháng trước nữa) theo người. Không có quyền / lỗi → rỗng. */
export function useStaffRatings(enabled = true): Map<string, StaffRating> {
  const { user } = useAuthContext();
  const allowed = enabled && hasPermission(user, PERMISSIONS.hr.performanceRead);
  const [ratings, setRatings] = useState<Map<string, StaffRating>>(new Map());

  useEffect(() => {
    if (!allowed) return undefined;
    let cancelled = false;
    (async () => {
      for (const offset of [1, 2]) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const month = await getPerformanceMonth(monthKey(offset));
          if (month.scores.length > 0) {
            if (!cancelled)
              setRatings(
                new Map(
                  month.scores.map((s) => [
                    s.userId,
                    { rating: s.rating, total: s.total, month: month.month, published: !!month.publishedAt },
                  ])
                )
              );
            return;
          }
        } catch {
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  return ratings;
}

export function RatingChip({ value }: { value?: StaffRating }) {
  if (!value || value.rating === 'NotRated') return null;
  const month = `${value.month.slice(5, 7)}/${value.month.slice(0, 4)}`;
  return (
    <Tooltip title={`Điểm tháng ${month}${value.published ? '' : ' (chưa công bố)'} — chỉ để tham khảo khi xếp ca`}>
      <Chip
        size="small"
        variant="outlined"
        color={PERFORMANCE_RATING_COLOR[value.rating]}
        label={`${PERFORMANCE_RATING_LABEL[value.rating]} · ${Math.round(value.total)}`}
        sx={{ height: 20, fontSize: 11, flexShrink: 0 }}
      />
    </Tooltip>
  );
}
