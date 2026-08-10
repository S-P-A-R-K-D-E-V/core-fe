import axios, { endpoints } from 'src/utils/axios';

import type { IWorkerStatus, IRunWorkerNowResponse } from 'src/types/worker';

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
