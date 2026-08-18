// Kiosk Check-in — types khớp contract thật của Core-be KioskHub +
// face-tracking-service (đọc trực tiếp code, KHÔNG theo giả định trong plan doc gốc).
// Xem: Core-be/CoreCms-facetracking/CoreCms.Api/Hubs/KioskHub.cs,
//      Core-be/CoreCms-facetracking/CoreCms.Application/Kiosk/Commands/Identify/KioskIdentifyCommand.cs,
//      face-tracking-service/app/core/schemas/{track,common}.py

export type KioskMode = 'checkin' | 'checkout';

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
export interface IKioskCandidateFound {
  trackId: string;
  staffId: string;
  staffName: string;
  similarity: number;
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
