// ----------------------------------------------------------------------
// KiotViet Sync Job Types
// ----------------------------------------------------------------------

export interface ISyncJobStatus {
  jobId: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled';
  type: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  steps: ISyncJobStep[];
  error?: string | null;
}

export interface ISyncJobStep {
  entity: string;
  /** Khoá ổn định để retry đúng sub-job này (vd "Invoices_2022-01", "Categories"). */
  key?: string | null;
  kind?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  created: number;
  updated: number;
  skipped: number;
  total: number;
  totalKnown: number;
  /** Số bản ghi đã xử lý trong bước hiện tại (created + updated + skipped). */
  processed: number;
  /** Phần trăm hoàn thành của bước (0–100). */
  percent: number;
  /** Thông điệp trạng thái hiện tại của bước. */
  message: string | null;
  isRunning: boolean;
  /** true = đã lên kế hoạch nhưng chưa chạy (đang chờ tới lượt/chờ phase trước xong). */
  isPending?: boolean;
  error: string | null;
  /** "Unauthorized" | "RateLimited" | "Other" | "Cancelled" */
  errorType?: string | null;
  attempts?: number;
}

// ----------------------------------------------------------------------
// Theo dõi / huỷ / buộc dừng / chạy lại job (GET /kiotviet/sync/jobs/monitor, GET /admin/workers/jobs)
// ----------------------------------------------------------------------

/** Immediate: có tác dụng ngay. NextCheckpoint: dừng ở điểm an toàn kế tiếp. GraceThenDetach: chờ rồi worker bỏ đợi. */
export type SyncJobStopMode = 'Immediate' | 'NextCheckpoint' | 'GraceThenDetach' | 'None';

export interface ISyncJobControlState {
  canCancel: boolean;
  cancelMode: SyncJobStopMode;
  cancelNote: string;
  canForce: boolean;
  forceMode: SyncJobStopMode;
  forceNote: string;
  canRetry: boolean;
  retryNote: string;
  suspected: boolean;
  suspectNote: string | null;
}

export interface ISyncJobControlEvent {
  action: string;
  /** Null khi do worker tự ghi. */
  actorId: string | null;
  actorName: string | null;
  at: string;
  note: string | null;
}

export interface ISyncJobMonitorItem {
  jobId: string;
  tenantId: string;
  tenantCode: string | null;
  type: string;
  status: ISyncJobStatus['status'];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  lastProgressAt: string;
  error: string | null;
  stepsTotal: number;
  stepsDone: number;
  stepsFailed: number;
  currentStep: string | null;
  runnerAlive: boolean;
  cancelRequested: boolean;
  forceRequested: boolean;
  forceStoppedAt: string | null;
  forceStopMode: 'Detached' | 'NoRunner' | null;
  detachedTaskAlive: boolean;
  retryOfJobId: string | null;
  control: ISyncJobControlState;
  controlEvents: ISyncJobControlEvent[];
}

export interface ISyncJobControlResponse {
  message: string;
  stopMode: SyncJobStopMode | null;
  newJobId: string | null;
}

export interface ISyncJobResponse {
  jobId: string;
  message: string;
}
