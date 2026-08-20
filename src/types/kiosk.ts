// Kiosk Check-in — types khớp contract thật của Core-be KioskHub +
// face-tracking-service (đọc trực tiếp code, KHÔNG theo giả định trong plan doc gốc).
// Xem: Core-be/CoreCms-facetracking/CoreCms.Api/Hubs/KioskHub.cs,
//      Core-be/CoreCms-facetracking/CoreCms.Application/Kiosk/Commands/Identify/KioskIdentifyCommand.cs,
//      face-tracking-service/app/core/schemas/{track,common}.py

export type TrackState =
  | 'NEW'
  | 'TRACKING'
  | 'QUALITY_OK'
  | 'LIVENESS_PASSED'
  | 'LIVENESS_FAILED'
  | 'EMBEDDED';

// bbox: pixel [x1, y1, x2, y2] theo đúng kích thước frame đã gửi lên (KHÔNG normalize 0-1).
export interface IKioskTrack {
  trackId: string;
  bbox: [number, number, number, number];
  confidence: number;
  quality?: number | null;
  state: TrackState;
}

export interface IKioskTracksMessage {
  type: 'tracks';
  seq: number;
  tracks: IKioskTrack[];
}

// Payload thật từ KioskHub — KHÔNG có staffAvatarUrl (Core-be chưa wire field này,
// xem KioskIdentifyResult record). Để optional cho dễ bổ sung sau.
// action: kiosk KHÔNG gạt tay chọn — BE tự nhận diện rồi suy luận nên làm gì cho người đó
// (KioskIdentifyCommandHandler): "checkout" nếu đang có log mở, "checkin" nếu có ca hôm nay
// chưa check-in, "overtime" nếu không có ca (tự động check-in ngoài giờ, không cần xác nhận
// thêm). shiftName/shiftStartTime/shiftEndTime chỉ có giá trị khi action="checkin".
export type KioskAction = 'checkin' | 'checkout' | 'overtime';

export interface IKioskCandidateFound {
  trackId: string;
  staffId: string;
  staffName: string;
  similarity: number;
  action: KioskAction;
  shiftName?: string | null;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  staffAvatarUrl?: string;
}

export type KioskConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

export interface IKioskConfirmResponse {
  id: string;
  staffId: string;
  checkInTime: string | null;
  checkOutTime: string | null;
}

// ── Ghép nối thiết bị (KioskPairingController) — thay cho seed tay KioskDevice qua DB ──

export interface IKioskPairingRequest {
  pairingId: string;
  code: string;
  expiresAt: string;
}

export type KioskPairingStatus = 'pending' | 'expired' | 'claimed';

export interface IKioskPairingStatusResponse {
  status: KioskPairingStatus;
  kioskKey?: string | null;
  deviceName?: string | null;
}

export interface IKioskClaimResponse {
  deviceId: string;
  deviceName: string;
}

export interface IKioskDeviceItem {
  id: string;
  name: string;
  branchId: string;
  branchName: string;
  isActive: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}
