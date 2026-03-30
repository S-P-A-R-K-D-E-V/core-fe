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
  total: number;
  error: string | null;
}

export interface ISyncJobResponse {
  jobId: string;
  message: string;
}
