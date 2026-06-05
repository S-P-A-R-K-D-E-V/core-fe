import type { PoolNeedType, PoolPostStatus } from 'src/types/corecms-api';

export function needTypeLabel(t: PoolNeedType | string): string {
  const map: Record<string, string> = {
    Swap: 'Đổi ca',
    FullCover: 'Làm hộ cả ca',
    PartialCover: 'Làm hộ 1 phần',
  };
  return map[t] ?? t;
}

export function poolStatusLabel(s: PoolPostStatus | string): string {
  const map: Record<string, string> = {
    Open: 'Đang mở',
    WaitingApproval: 'Chờ duyệt',
    Approved: 'Đã duyệt',
    Rejected: 'Từ chối',
    Cancelled: 'Đã huỷ',
  };
  return map[s] ?? s;
}

export function poolStatusColor(
  s: PoolPostStatus | string
): 'success' | 'error' | 'warning' | 'info' | 'default' {
  if (s === 'Approved') return 'success';
  if (s === 'Rejected') return 'error';
  if (s === 'Cancelled') return 'default';
  if (s === 'WaitingApproval') return 'warning';
  return 'info'; // Open
}

export function fmtDate(d?: string): string {
  return d ? new Date(d).toLocaleDateString('vi-VN') : '-';
}
