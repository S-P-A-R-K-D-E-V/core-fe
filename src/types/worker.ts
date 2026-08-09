// ----------------------------------------------------------------------
// System Jobs (Admin) — trạng thái các BackgroundService (worker) trong hệ thống
// ----------------------------------------------------------------------

export type WorkerHealth = 'NeverRun' | 'Healthy' | 'Stale' | 'Error';

export interface IWorkerStatus {
  name: string;
  displayName: string;
  description: string;
  process: string;
  scheduleDescription: string;
  supportsManualTrigger: boolean;
  health: WorkerHealth;
  startedAtUtc: string | null;
  lastTickAtUtc: string | null;
  lastSuccessAtUtc: string | null;
  lastErrorAtUtc: string | null;
  lastError: string | null;
  lastSummary: string | null;
  lastTickWasManual: boolean;
  supportsEnableToggle: boolean;
  enabled: boolean;
}

export interface IRunWorkerNowResponse {
  message: string;
}
