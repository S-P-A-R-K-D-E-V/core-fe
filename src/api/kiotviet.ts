import axios, { endpoints } from 'src/utils/axios';

import type { ISyncJobStatus } from 'src/types/sync-job';
import type {
  IKiotVietWebhook,
  IKiotVietFailedPushPagedResponse,
  IKiotVietWebhookLogPagedResponse,
  IKiotVietWebhookLogDetail,
  IKiotVietWebhookRegisterResult,
} from 'src/types/corecms-api';

/** Lịch sử job đồng bộ gần nhất (tối đa 50, mới nhất trước) */
export async function getRecentSyncJobs(limit = 50): Promise<ISyncJobStatus[]> {
  const response = await axios.get<ISyncJobStatus[]>(endpoints.kiotViet.syncJobs, {
    params: { limit },
  });
  return response.data;
}

/** Danh sách đơn bán đẩy KiotViet thất bại (phân trang) */
export async function getFailedPushes(page = 1, pageSize = 20): Promise<IKiotVietFailedPushPagedResponse> {
  const response = await axios.get<IKiotVietFailedPushPagedResponse>(endpoints.kiotViet.pushFailed, {
    params: { page, pageSize },
  });
  return response.data;
}

/**
 * Đăng ký webhook KiotViet trỏ về endpoint public đã cấu hình. BE gọi POST /webhooks
 * riêng cho từng Type (API KiotViet chỉ nhận 1 Type/lần) và trả kết quả từng cái.
 * @param events Danh sách Type ghi đè (vd ['product', 'order']).
 *   Bỏ trống → BE dùng danh sách mặc định (KiotVietWebhookEvents.Default).
 */
export async function registerWebhook(events?: string[]): Promise<IKiotVietWebhookRegisterResult> {
  const response = await axios.post<IKiotVietWebhookRegisterResult>(endpoints.kiotViet.webhooksRegister, null, {
    params: events?.length ? { events: events.join(',') } : undefined,
  });
  return response.data;
}

export async function getWebhooks(): Promise<IKiotVietWebhook[]> {
  const response = await axios.get<IKiotVietWebhook[]>(endpoints.kiotViet.webhooks);
  return response.data;
}

export async function deleteWebhook(id: number): Promise<void> {
  await axios.delete(endpoints.kiotViet.webhookById(id));
}

/** Log webhook nhận từ KiotViet (phân trang, mới nhất trước) — rút gọn, không kèm header/body */
export async function getWebhookLogs(page = 1, pageSize = 20): Promise<IKiotVietWebhookLogPagedResponse> {
  const response = await axios.get<IKiotVietWebhookLogPagedResponse>(endpoints.kiotViet.webhookLogs, {
    params: { page, pageSize },
  });
  return response.data;
}

/** Chi tiết đầy đủ 1 lần gọi webhook — header/query/body — để trace lỗi kết nối */
export async function getWebhookLogDetail(id: string): Promise<IKiotVietWebhookLogDetail> {
  const response = await axios.get<IKiotVietWebhookLogDetail>(endpoints.kiotViet.webhookLogDetail(id));
  return response.data;
}

/** Xoá toàn bộ log webhook đã lưu (MongoDB) — dùng dọn log rác/nhiễu lúc mới tích hợp */
export async function clearWebhookLogs(): Promise<{ deletedCount: number }> {
  const response = await axios.delete<{ deletedCount: number }>(endpoints.kiotViet.webhookLogs);
  return response.data;
}
