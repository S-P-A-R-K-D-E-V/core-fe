import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import Iconify from 'src/components/iconify';

import type { IPayrollShiftCoverEvent, IPayrollShiftSwapEvent } from 'src/types/corecms-api';

// ──────────────────────────────────────────────────────────────────────────
// Badge nhỏ trên mỗi ca trong "Chi tiết ca làm việc" — cho biết ca này có liên
// quan tới 1 yêu cầu đổi ca / bài đăng làm hộ nào không, để admin/nhân viên
// đối chiếu lại với dữ liệu vận hành thay vì chỉ tin vào StaffId hiện tại của
// assignment (đổi ca/làm hộ cả ca đã DUYỆT sẽ đổi thẳng StaffId, không còn
// dấu vết nào khác trên chính ca đó).
// ──────────────────────────────────────────────────────────────────────────

const NEED_TYPE_LABEL: Record<string, string> = {
  Swap: 'Đổi ca',
  FullCover: 'Làm hộ cả ca',
  PartialCover: 'Làm hộ 1 phần',
};

const STATUS_LABEL: Record<string, string> = {
  Approved: 'Đã duyệt',
  Pending: 'Chờ duyệt',
  WaitingApproval: 'Chờ duyệt',
  WaitingTargetConfirmation: 'Chờ xác nhận',
  Rejected: 'Từ chối',
  Cancelled: 'Đã huỷ',
  Open: 'Đang mở',
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
}

type Props = {
  swapEvents: IPayrollShiftSwapEvent[];
  coverEvents: IPayrollShiftCoverEvent[];
};

export default function ShiftCrossCheckBadge({ swapEvents, coverEvents }: Props) {
  const total = swapEvents.length + coverEvents.length;
  if (total === 0) return null;

  const hasApproved =
    swapEvents.some((e) => e.status === 'Approved') || coverEvents.some((e) => e.status === 'Approved');

  return (
    <Tooltip
      arrow
      title={
        <Stack spacing={0.75} sx={{ py: 0.5 }}>
          {swapEvents.map((e) => (
            <Typography key={e.id} variant="caption" component="div">
              Đổi ca ({STATUS_LABEL[e.status] || e.status}): {e.requesterName} ⇄ {e.targetName || '—'}
            </Typography>
          ))}
          {coverEvents.map((e) => (
            <Typography key={e.id} variant="caption" component="div">
              {NEED_TYPE_LABEL[e.needType] || e.needType} ({STATUS_LABEL[e.status] || e.status}):{' '}
              {e.posterName} → {e.claimerName || 'chưa có người nhận'}
              {e.extraPayAmount ? ` · +${formatCurrency(e.extraPayAmount)}` : ''}
            </Typography>
          ))}
        </Stack>
      }
    >
      <Chip
        size="small"
        icon={<Iconify icon="mdi:swap-horizontal" width={14} />}
        label={total > 1 ? `${total} sự kiện` : 'Đổi/làm hộ'}
        color={hasApproved ? 'info' : 'default'}
        variant="outlined"
        sx={{ ml: 0.5, cursor: 'help' }}
      />
    </Tooltip>
  );
}
