// Giám sát cửa hàng — GET /reports/store-monitor (StoreMonitorController phía Core-be).

import type { AgentCameraRole } from 'src/types/kiosk';

export type IStoreMonitorTotals = {
  in: number;
  out: number;
  /** Số khách đang ở trong = vào − ra (không âm). null khi xem ngày đã qua. */
  occupancy: number | null;
  orders: number;
  revenue: number;
  /** Hoá đơn / lượt vào (%). null khi chưa có lượt vào. */
  conversionRate: number | null;
};

export type IStoreMonitorBranch = IStoreMonitorTotals & {
  branchId: string;
  branchName: string;
  businessType: string;
  hasCamera: boolean;
  lastEventAt: string | null;
};

export type IStoreMonitorHour = {
  hour: number;
  in: number;
  out: number;
  orders: number;
};

export type IAgentCameraStatus = {
  key: string;
  name: string | null;
  online: boolean;
  fps: number | null;
  lastFrameAt: string | null;
  inToday: number | null;
  outToday: number | null;
  /** null/thiếu = agent cũ chưa báo vai trò. */
  role?: AgentCameraRole | null;
  /** Agent có hỗ trợ xem trực tiếp không; null/thiếu = chưa rõ. */
  liveView?: boolean | null;
};

export type IStoreMonitorDevice = {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  kind: 'camera-agent' | 'kiosk';
  agentVersion: string | null;
  lastSeenAt: string | null;
  /** null với kiosk web (không gửi heartbeat). */
  online: boolean | null;
  cameras: IAgentCameraStatus[];
};

export type IStoreMonitor = {
  date: string;
  isToday: boolean;
  generatedAt: string;
  totals: IStoreMonitorTotals;
  branches: IStoreMonitorBranch[];
  hourly: IStoreMonitorHour[];
  devices: IStoreMonitorDevice[];
};

// GET /attendance/today-board (GetTodayBoardQuery) — ca hôm nay + trạng thái chấm công lúc này.
export type ITodayBoardStatus = 'working' | 'done' | 'not_in' | 'absent' | 'upcoming';

export type ITodayBoardItem = {
  assignmentId: string;
  staffId: string;
  staffName: string;
  avatarUrl: string | null;
  shiftName: string;
  startTime: string;
  endTime: string;
  status: ITodayBoardStatus;
  lateMinutes: number;
  checkInTime: string | null;
  checkOutTime: string | null;
};

export type ITodayBoard = {
  date: string;
  counts: { working: number; done: number; notIn: number; absent: number; upcoming: number; late: number };
  items: ITodayBoardItem[];
};
