// ----------------------------------------------------------------------
// KiotViet Sync Job Types
// ----------------------------------------------------------------------

export interface ISyncJobStatus {
  jobId: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed';
  type: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  steps: ISyncJobStep[];
  error?: string | null;
}

export interface ISyncJobStep {
  entity: string;
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
  error: string | null;
}

export interface ISyncJobResponse {
  jobId: string;
  message: string;
}
