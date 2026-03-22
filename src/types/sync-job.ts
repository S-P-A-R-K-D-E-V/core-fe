// ----------------------------------------------------------------------
// KiotViet Sync Job Types
// ----------------------------------------------------------------------

export interface ISyncJobStatus {
  jobId: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed';
  type: string;
  createdAt: string;
  updatedAt: string;
  steps: ISyncJobStep[];
  error?: string;
}

export interface ISyncJobStep {
  step: string;
  success: boolean;
  message: string;
  createdCount: number;
  updatedCount: number;
  error?: string;
}

export interface ISyncJobResponse {
  jobId: string;
  message: string;
}
