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

/** Màu hex theo loại nhu cầu — dùng cho calendar (Chợ ca). */
export function needTypeHex(t: PoolNeedType | string): string {
  if (t === 'Swap') return '#1976d2'; // xanh dương
  if (t === 'FullCover') return '#7b1fa2'; // tím
  if (t === 'PartialCover') return '#ed6c02'; // cam
  return '#1976d2';
}

/** Màu hex theo trạng thái — dùng cho calendar (bài đăng / ca nhận / duyệt). */
export function statusHex(s: PoolPostStatus | string): string {
  if (s === 'Approved') return '#2e7d32'; // xanh lá
  if (s === 'Rejected') return '#d32f2f'; // đỏ
  if (s === 'Cancelled') return '#9e9e9e'; // xám
  if (s === 'WaitingApproval') return '#ed6c02'; // cam
  return '#1976d2'; // Open - xanh dương
}
