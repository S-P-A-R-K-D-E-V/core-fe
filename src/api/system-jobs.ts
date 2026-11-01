import axios, { endpoints } from 'src/utils/axios';

import type { ISyncJobMonitorItem, ISyncJobControlResponse } from 'src/types/sync-job';
import type { IWorkerStatus, IRunWorkerNowResponse } from 'src/types/worker';

/** allStores: Admin CiCi xem mọi cửa hàng (/admin/workers/jobs). ownStore: Admin chỉ cửa hàng mình (/kiotviet/sync/jobs). */
export type SyncJobScope = 'allStores' | 'ownStore';

export interface ISyncJobMonitor {
  jobs: ISyncJobMonitorItem[];
  /** Cửa hàng không đọc được job (chỉ có ở allStores). */
  failedStores: string[];
}

type JobRef = Pick<ISyncJobMonitorItem, 'tenantId' | 'jobId'>;

/** Job đang chạy và gần đây, đang chạy trước */
export async function getSyncJobMonitor(scope: SyncJobScope): Promise<ISyncJobMonitor> {
  if (scope === 'allStores') {
    const response = await axios.get<ISyncJobMonitor>(endpoints.adminWorkers.jobs);
    return response.data;
  }
  const response = await axios.get<ISyncJobMonitorItem[]>(endpoints.kiotViet.syncJobsMonitor);
  return { jobs: response.data, failedStores: [] };
}

/** Huỷ: job chưa chạy thì huỷ ngay, đang chạy thì dừng ở điểm an toàn kế tiếp */
export async function cancelSyncJob(scope: SyncJobScope, job: JobRef): Promise<ISyncJobControlResponse> {
  const url =
    scope === 'allStores'
      ? endpoints.adminWorkers.jobCancel(job.tenantId, job.jobId)
      : endpoints.kiotViet.syncJobCancel(job.jobId);
  const response = await axios.post<ISyncJobControlResponse>(url);
  return response.data;
}

/** Buộc dừng job treo: chờ tối đa 60 giây rồi worker bỏ đợi; không còn worker giữ job thì dừng ngay */
export async function forceCancelSyncJob(scope: SyncJobScope, job: JobRef): Promise<ISyncJobControlResponse> {
  const url =
    scope === 'allStores'
      ? endpoints.adminWorkers.jobForceCancel(job.tenantId, job.jobId)
      : endpoints.kiotViet.syncJobForceCancel(job.jobId);
  const response = await axios.post<ISyncJobControlResponse>(url);
  return response.data;
}

/** Chạy lại bằng job mới cùng tham số */
export async function retrySyncJob(scope: SyncJobScope, job: JobRef): Promise<ISyncJobControlResponse> {
  const url =
    scope === 'allStores'
      ? endpoints.adminWorkers.jobRetry(job.tenantId, job.jobId)
      : endpoints.kiotViet.syncJobRetry(job.jobId);
  const response = await axios.post<ISyncJobControlResponse>(url);
  return response.data;
}

/** Danh sách toàn bộ worker đã biết kèm heartbeat gần nhất */
export async function getWorkers(): Promise<IWorkerStatus[]> {
  const response = await axios.get<IWorkerStatus[]>(endpoints.adminWorkers.list);
  return response.data;
}

/** Ép worker tick-based chạy ngay (chỉ áp dụng worker có supportsManualTrigger=true) */
export async function runWorkerNow(name: string): Promise<IRunWorkerNowResponse> {
  const response = await axios.post<IRunWorkerNowResponse>(endpoints.adminWorkers.runNow(name));
  return response.data;
}

/** Bật/tắt runtime worker (chỉ áp dụng worker có supportsEnableToggle=true) */
export async function setWorkerEnabled(
  name: string,
  enabled: boolean
): Promise<IRunWorkerNowResponse> {
  const url = enabled ? endpoints.adminWorkers.enable(name) : endpoints.adminWorkers.disable(name);
  const response = await axios.post<IRunWorkerNowResponse>(url);
  return response.data;
}
