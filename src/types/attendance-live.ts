// Chấm công trực tiếp theo chi nhánh — GET /attendance/branch-board(/branches) và hub /hubs/store-live (Core-be).
// Mọi thời điểm là chuỗi ISO UTC; hiển thị theo giờ máy xem.

import type { KioskAction, AgentCameraRole } from 'src/types/kiosk';
import type { ITodayBoardStatus } from 'src/types/store-monitor';

/** GET /attendance/branch-board/branches — chi nhánh người dùng được xem và có ≥1 agent camera đang hoạt động. */
export type IBranchBoardBranch = {
  branchId: string;
  branchName: string;
  deviceCount: number;
  liveDeviceCount: number;
};

export type IBranchBoardAssigned = {
  assignmentId: string;
  staffId: string;
  staffName: string;
  avatarUrl: string | null;
  shiftName: string;
  /** "08:00" */
  startTime: string;
  endTime: string;
  status: ITodayBoardStatus;
  lateMinutes: number;
  checkInTime: string | null;
  checkOutTime: string | null;
  /** false = ca chưa gắn chi nhánh (vẫn hiện vì nhiều ca chưa khai báo chi nhánh). */
  branchAssigned: boolean;
  /** Lần đầu / lần cuối camera của chi nhánh này thấy người đó hôm nay; null = chưa thấy. */
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  /** Độ khớp cao nhất camera đạt được hôm nay (0..1); null = chưa thấy. */
  bestSimilarity: number | null;
};

export type IBranchBoardUnassigned = {
  staffId: string;
  staffName: string;
  avatarUrl: string | null;
  /** null khi chỉ có chấm công ngoài ca qua thiết bị chi nhánh mà camera chưa nhận ra hôm nay. */
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  seenCount: number;
  lastAction: KioskAction | null;
  /** Chấm công ngoài ca hôm nay (có thể null). */
  checkInTime: string | null;
  checkOutTime: string | null;
  hasShiftElsewhere: boolean;
  /** Độ khớp cao nhất camera đạt được hôm nay (0..1). */
  bestSimilarity: number | null;
};

export type IStaleOpenCheckInMethod = 'Manual' | 'SmartMobile' | 'Kiosk';

/** Lượt chấm công còn mở từ TRƯỚC hôm nay liên quan tới chi nhánh (cũ nhất trước). */
export type IBranchBoardStaleOpen = {
  logId: string;
  staffId: string;
  staffName: string;
  avatarUrl: string | null;
  checkInTime: string;
  hoursOpen: number;
  /** null = làm ngoài ca. */
  shiftName: string | null;
  checkInMethod: IStaleOpenCheckInMethod | null;
  deviceName: string | null;
};

export type IBranchBoardCamera = {
  key: string;
  name: string | null;
  role: AgentCameraRole | null;
  online: boolean;
  fps: number | null;
  lastFrameAt: string | null;
  inToday: number | null;
  outToday: number | null;
  liveView?: boolean | null;
};

export type IBranchBoardDevice = {
  id: string;
  name: string;
  /** Heartbeat trong 3 phút gần nhất. */
  online: boolean;
  /** Agent đang nối vào hub xem trực tiếp. */
  liveConnected: boolean;
  cameras: IBranchBoardCamera[];
  /** Phiên bản spark-camera-agent (heartbeat); null khi chưa báo. */
  agentVersion?: string | null;
};

export type IBranchBoardCounts = {
  assigned: number;
  working: number;
  done: number;
  notIn: number;
  absent: number;
  upcoming: number;
  late: number;
  unassignedSeen: number;
  staleOpen: number;
};

/** GET /attendance/branch-board?branchId= */
export type IBranchBoard = {
  date: string;
  branchId: string;
  branchName: string;
  generatedAt: string;
  counts: IBranchBoardCounts;
  assigned: IBranchBoardAssigned[];
  unassigned: IBranchBoardUnassigned[];
  staleOpen: IBranchBoardStaleOpen[];
  devices: IBranchBoardDevice[];
};

// ----------------------------------------------------------------------
// Hub /hubs/store-live

export type IStoreLiveInvokeResult = { ok: boolean; error?: string | null };

/** reason khi bị từ chối vì vị trí (người không phải Admin phải đang ở cửa hàng của camera). */
export type StoreCameraDeniedReason = 'branch_no_location' | 'location_required' | 'low_accuracy' | 'outside';

export type IStoreLiveWatchResult = IStoreLiveInvokeResult & {
  sourceConnected?: boolean;
  reason?: StoreCameraDeniedReason | string | null;
  /** Gọi lại Watch (kèm vị trí mới) sau ngần này giây; null = Admin, không cần. */
  recheckSeconds?: number | null;
};

/** ≈2 hình/giây mỗi camera; data là JPEG base64 không có tiền tố data:. */
/** Khung khuôn mặt agent vẽ lên hình (toạ độ tương đối 0..1 theo khung hình). */
export type ILiveOverlayKind = 'matched' | 'no_match' | 'ambiguous' | 'liveness' | 'detecting' | 'small' | 'error';

export type ILiveOverlayBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** vd "Xuân Vũ · 68%", "Không khớp · 48%". */
  label: string | null;
  kind: ILiveOverlayKind | string | null;
};

export type IStoreLiveFrame = {
  deviceId: string;
  cameraKey: string;
  data: string;
  at: string;
  /** null/thiếu với agent cũ (< 0.5) hoặc camera không phải camera quầy. */
  overlay?: ILiveOverlayBox[] | null;
};

export type IStoreLiveStatus = { deviceId: string; sourceConnected: boolean };

export type IStorePresenceChanged = {
  deviceId: string;
  branchId: string;
  staffId: string;
  staffName: string;
  action: KioskAction | null;
  similarity: number;
  at: string;
};

export type StoreLiveConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

// GET /face-tracking/enroll/cameras — camera chấm công (counter_face) dùng làm nguồn ảnh đăng ký khuôn mặt.
export type IEnrollCamera = {
  deviceId: string;
  deviceName: string;
  branchId: string;
  branchName: string;
  cameraKey: string;
  cameraName: string;
  /** Agent gửi heartbeat ≤ 3 phút và camera có hình. */
  online: boolean;
  /** Agent đang nối hub (chụp được ngay). */
  sourceConnected: boolean;
};

/** Sự kiện "snapshot" của /hubs/store-live — ảnh trả về cho RequestSnapshot. */
export type IStoreLiveSnapshot = {
  requestId: string;
  deviceId: string;
  cameraKey: string;
  data: string | null;
  error: string | null;
};
