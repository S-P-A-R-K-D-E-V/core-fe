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
  | 'expired';

export type AgentActionStatusFilter = AgentActionStatus | 'all';

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
