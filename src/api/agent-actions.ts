import useSWR from 'swr';
import { useMemo } from 'react';

import axios, { fetcher, endpoints } from 'src/utils/axios';

import type { IAgentKey } from './store-settings';

// ----------------------------------------------------------------------
// Đội agent — phía người (K3, core-be AgentActionsController /agent-actions/*). Khoá agent ở chế độ "Agent tự chạy"
// (server_approval) gửi lệnh ghi: theo mức tự chủ của cửa hàng cho quyền đó máy chủ tự chạy, tự chạy rồi báo, tạo phiếu
// chờ duyệt, hoặc chặn. Duyệt = máy chủ chạy ngay ĐÚNG lệnh đã lưu, người duyệt là người thực hiện.
// ----------------------------------------------------------------------

export type AgentActionStatus =
  | 'pending'
  | 'approved'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'rejected'
  | 'expired'
  /** Người duyệt bấm "Yêu cầu sửa" — agent làm lại rồi gửi phiếu bản mới. */
  | 'revision_requested';

export type AgentActionStatusFilter = AgentActionStatus | 'all';

export interface IAgentPreviewChannel {
  id: string;
  /** vd "threads". */
  platform: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
}

export interface IAgentPreviewProduct {
  id: string;
  code: string;
  name: string;
  price: number;
  imageUrl: string | null;
  inStock: boolean;
}

export interface IAgentSocialPostPreview {
  /** draft | queue | schedule | now. */
  mode: string;
  /** Câu cho người đọc, vd "Hẹn đăng 19:30 hôm nay (18/11)". */
  modeLabel: string;
  scheduledAt: string | null;
  text: string | null;
  imageUrls: string[];
  channels: IAgentPreviewChannel[];
  products: IAgentPreviewProduct[];
}

/** Một dòng của lịch đăng bài (phiếu social_batch). */
export interface IAgentSocialBatchItem {
  postId: string;
  scheduledAt: string | null;
  /** Bài đã bị sửa sau khi gửi duyệt — dòng này sẽ không được hẹn. */
  changed: boolean;
  /** Bài không còn (đã xoá). */
  missing: boolean;
  post: IAgentSocialPostPreview;
}

export interface IAgentActionPreview {
  kind: 'social_post' | 'social_batch' | 'generic' | (string & {});
  /** Tên thao tác tiếng Việt, vd "Tạo bài đăng mạng xã hội". */
  title: string;
  /** Chỉ có khi kind = social_post. */
  socialPost: IAgentSocialPostPreview | null;
  /** Tham số "nhãn — giá trị" (id đã đổi thành tên); bài mạng xã hội thì trống. */
  fields: { label: string; value: string }[];
  /** Chỉ có khi kind = social_batch: các bài theo giờ đăng. */
  socialBatch?: { items: IAgentSocialBatchItem[] } | null;
}

/** Bản trước của cùng việc (phiếu đã bị "Yêu cầu sửa") — để so chữ / ảnh cũ và mới. */
export interface IAgentActionPrevious {
  actionId: string;
  note: string | null;
  decidedByName: string | null;
  preview: IAgentActionPreview | null;
}

export interface IAgentAction {
  id: string;
  agentName: string;
  agentApiKeyId: string;
  actsForUserId: string | null;
  actsForName: string | null;
  method: string;
  pathAndQuery: string;
  permission: string;
  /** Body JSON (chuỗi) đã bỏ cờ confirm; null = lệnh không có body. */
  bodyJson: string | null;
  summary: string;
  status: AgentActionStatus;
  createdAt: string;
  expiresAt: string;
  decidedByUserId: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  executedAt: string | null;
  resultStatusCode: number | null;
  /** Phản hồi của lệnh khi chạy (máy chủ đã cắt ngắn). */
  resultBody: string | null;
  /** Tên thao tác tiếng Việt; rỗng ở máy chủ cũ → dùng `summary`. */
  title?: string;
  /** Bản xem trước dễ đọc (bài đăng như thật / bảng tham số); null = không dựng được. */
  preview?: IAgentActionPreview | null;
  /** Việc trên bảng việc đang chờ phiếu này. */
  taskId?: string | null;
  taskTitle?: string | null;
  /** Bản thứ mấy (1 = lần đầu) sau các lần "Yêu cầu sửa". */
  version?: number | null;
  previous?: IAgentActionPrevious | null;
  /** Còn mấy lần được "Yêu cầu sửa"; 0 = khoá nút; null = không áp dụng. */
  revisionsLeft?: number | null;
}

export type AgentAutonomyLevel = 'auto' | 'auto_notify' | 'approve' | 'deny';

export interface IAgentAutonomyPolicy {
  /** Quyền của lệnh ghi nội bộ, vd "payroll.finalize". */
  permission: string;
  level: AgentAutonomyLevel;
  /** Chưa đặt mức — đang theo mặc định (chờ duyệt). */
  isDefault: boolean;
  /** Các lệnh dùng quyền này, vd "POST /api/internal/payroll/finalize". */
  endpoints: string[];
  /** Lệnh vốn cần người xác nhận (confirm) khi khoá ở chế độ người dùng tự xác nhận. */
  requiresConfirmation: boolean;
}

export interface IAgentAutonomyPolicies {
  levels: AgentAutonomyLevel[];
  defaultLevel: AgentAutonomyLevel;
  items: IAgentAutonomyPolicy[];
}

export interface IAgentActionLog {
  id: string;
  agentApiKeyId: string | null;
  agentName: string;
  approvalMode: string;
  actsForUserId: string | null;
  performedByUserId: string | null;
  method: string;
  path: string;
  permission: string | null;
  /** auto / auto_notify / approve / deny / client_confirm / pending. */
  decision: string;
  pendingActionId: string | null;
  statusCode: number;
  durationMs: number;
  createdAt: string;
}

export type AgentApprovalMode = 'client_confirm' | 'server_approval';

const EP = endpoints.agentActions;

export function agentActionListKey(status: AgentActionStatusFilter, take = 50) {
  return `${EP.list}?status=${status}&take=${take}`;
}

/** Phiếu theo trạng thái; tab Chờ duyệt tự làm mới mỗi 30 giây (agent có thể gửi phiếu mới bất cứ lúc nào). */
export function useAgentActions(status: AgentActionStatusFilter, enabled = true, take = 50) {
  const { data, isLoading, error, mutate } = useSWR<IAgentAction[]>(
    enabled ? agentActionListKey(status, take) : null,
    fetcher,
    { refreshInterval: status === 'pending' ? 30_000 : 0, keepPreviousData: true }
  );
  return useMemo(
    () => ({ actions: data ?? [], loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

/** Số phiếu đang chờ — huy hiệu trên header. Hỏi lại mỗi 60 giây; `enabled=false` khi người dùng không có quyền duyệt. */
export function useAgentPendingCount(enabled: boolean) {
  const { data, mutate } = useSWR<{ count: number }>(enabled ? EP.pendingCount : null, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });
  return useMemo(() => ({ count: data?.count ?? 0, refresh: mutate }), [data, mutate]);
}

export async function getAgentAction(id: string): Promise<IAgentAction> {
  const res = await axios.get<IAgentAction>(EP.details(id));
  return res.data;
}

/** Duyệt: máy chủ chạy ngay lệnh đã lưu và trả phiếu kèm kết quả (status executed / failed). 409 = đã có người xử lý. */
export async function approveAgentAction(id: string, note?: string): Promise<IAgentAction> {
  const res = await axios.post<IAgentAction>(EP.approve(id), { note: note?.trim() || null });
  return res.data;
}

export async function rejectAgentAction(id: string, note?: string): Promise<IAgentAction> {
  const res = await axios.post<IAgentAction>(EP.reject(id), { note: note?.trim() || null });
  return res.data;
}

/**
 * Yêu cầu sửa: lệnh không chạy, agent nhận ghi chú + ảnh cần làm lại rồi gửi phiếu bản mới. Cần ghi chú hoặc ít nhất 1 ảnh
 * (ảnh phải thuộc phiếu) — 400; quá số lần sửa — 409 (câu tiếng Việt ở detail / title).
 */
export async function requestAgentActionRevision(
  id: string,
  data: { note?: string; imageUrls?: string[] }
): Promise<IAgentAction> {
  const res = await axios.post<IAgentAction>(EP.requestRevision(id), {
    note: data.note?.trim() || null,
    imageUrls: data.imageUrls && data.imageUrls.length > 0 ? data.imageUrls : null,
  });
  return res.data;
}

export function useAgentAutonomyPolicies(enabled = true) {
  const { data, isLoading, error, mutate } = useSWR<IAgentAutonomyPolicies>(
    enabled ? EP.policies : null,
    fetcher
  );
  return useMemo(
    () => ({ data, loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

export async function setAgentAutonomyLevel(
  permission: string,
  level: AgentAutonomyLevel
): Promise<{ permission: string; level: AgentAutonomyLevel }> {
  const res = await axios.put(EP.policy(permission), { level });
  return res.data;
}

export function useAgentActionLogs(enabled = true, keyId?: string, take = 100) {
  const params = new URLSearchParams({ take: String(take) });
  if (keyId) params.set('keyId', keyId);
  const { data, isLoading, error, mutate } = useSWR<IAgentActionLog[]>(
    enabled ? `${EP.logs}?${params.toString()}` : null,
    fetcher
  );
  return useMemo(
    () => ({ logs: data ?? [], loading: isLoading && !data, error, refresh: mutate }),
    [data, isLoading, error, mutate]
  );
}

/**
 * Cách duyệt của khoá agent (chỉ Admin). "Agent tự chạy" (server_approval) cần người được làm thay — máy chủ báo 400 nếu
 * thiếu. Không gửi field = giữ nguyên.
 */
export async function updateAgentKeySettings(
  id: string,
  data: { approvalMode?: AgentApprovalMode; actsForUserId?: string | null }
): Promise<IAgentKey> {
  const res = await axios.patch<IAgentKey>(EP.keySettings(id), data);
  return res.data;
}
