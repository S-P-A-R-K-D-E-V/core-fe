import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';

import type { ITodayBoardStatus } from 'src/types/store-monitor';

// ----------------------------------------------------------------------
// Dùng chung cho Giám sát cửa hàng và Chấm công trực tiếp: nhãn/màu trạng thái ca hôm nay và thẻ số liệu.

export type StaffStatusColor = 'success' | 'default' | 'warning' | 'error' | 'info';

export const STAFF_STATUS: Record<ITodayBoardStatus, { label: string; color: StaffStatusColor }> = {
  working: { label: 'Đang làm', color: 'success' },
  done: { label: 'Đã về', color: 'default' },
  not_in: { label: 'Chưa vào', color: 'warning' },
  absent: { label: 'Vắng', color: 'error' },
  upcoming: { label: 'Sắp tới', color: 'info' },
};

// ----------------------------------------------------------------------

type StatProps = {
  title: string;
  value: string;
  caption?: string;
  icon: string;
  color: string;
  /** Cho tiêu đề dài xuống dòng thay vì cắt "…". */
  wrapTitle?: boolean;
};

export function StatCard({ title, value, caption, icon, color, wrapTitle = false }: StatProps) {
  return (
    <Card sx={{ p: 2.5, height: 1 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" noWrap={!wrapTitle}>
            {title}
          </Typography>
          <Typography variant="h3" sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Typography>
          {caption && (
            <Typography variant="caption" color="text.secondary">
              {caption}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: `${color}.main`,
            bgcolor: `${color}.lighter`,
          }}
        >
          <Iconify icon={icon} width={26} />
        </Box>
      </Stack>
    </Card>
  );
}
