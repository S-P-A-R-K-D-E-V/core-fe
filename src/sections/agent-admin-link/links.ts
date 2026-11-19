import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------
// Trang trung gian /m/agent-admin (A3): link trong tin Zalo Bot mở trang này, từ đây mở nhóm Messenger "Quản trị – Đội
// agent" trong app (scheme bản app cửa hàng, core-mobile STORE_APP_SCHEME, màn (tabs)/chat/[id]) hoặc trên web.
// ----------------------------------------------------------------------

export const STORE_APP_SCHEME = 'sparkstore';

/** Deep link mở hội thoại trong app cửa hàng. */
export function agentAdminAppLink(conversationId: string): string {
  return `${STORE_APP_SCHEME}://chat/${encodeURIComponent(conversationId)}`;
}

/** Mở hội thoại trên web (Messenger đọc `?c=`). */
export function agentAdminWebLink(conversationId: string): string {
  return `${paths.dashboard.messenger}?c=${encodeURIComponent(conversationId)}`;
}

export type AgentAdminLinkState = 'loading' | 'ready' | 'missing' | 'forbidden' | 'error';

/**
 * Trạng thái trang theo kết quả GET agent-center/admin-group: 404 / `enabled: false` (tính năng tắt) hay chưa có id nhóm
 * đều coi là "nhóm chưa được tạo"; 403 = không có quyền agent.approve.
 */
export function agentAdminLinkState(input: {
  loading: boolean;
  error?: any;
  info?: { conversationId: string | null; enabled?: boolean } | null;
}): AgentAdminLinkState {
  const { loading, error, info } = input;
  if (error) {
    const status = error?.status;
    if (status === 403) return 'forbidden';
    if (status === 404) return 'missing';
    return 'error';
  }
  if (loading || !info) return 'loading';
  if (info.enabled === false || !info.conversationId) return 'missing';
  return 'ready';
}
