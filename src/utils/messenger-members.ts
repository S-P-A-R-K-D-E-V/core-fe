import type { InternalUser } from 'src/api/messenger';

import {
  isSystemUserId,
  isSystemConversation,
  resolveMessengerUser,
  isAgentAdminConversation,
} from './messenger-system';

// ----------------------------------------------------------------------
// Màn "Thành viên" của nhóm Messenger (A4a) — luật hiện / ẩn nút khớp core-be (MessengerService.AddMembersAsync /
// RemoveMemberAsync):
// - Nhóm thường: ai trong nhóm cũng thêm được; chỉ người tạo nhóm gỡ được người khác; ai cũng tự rời được.
// - Nhóm "Quản trị – Đội agent" (systemKey agent-admin): thêm / gỡ người khác cần quyền agent.manage; ai cũng tự rời.
// - Kênh "Cảnh báo hệ thống" (systemKey khác): tự đồng bộ theo vai trò — không có màn thành viên.
// - Không bao giờ gỡ / thêm "Trợ lý hệ thống".
// Ẩn nút chỉ để gọn giao diện — máy chủ vẫn là nơi quyết định, lỗi 403 vẫn phải báo.
// ----------------------------------------------------------------------

type ConversationLike = {
  type: 'Private' | 'Group' | (string & {});
  systemKey?: string | null;
  participantIds: string[];
  /** Có trong Conversation (POST / DELETE members trả về); danh sách hội thoại (summary) hiện chưa có. */
  createdById?: string | null;
};

export type MemberActor = {
  currentUserId: string | null;
  /** hasPermission(user, PERMISSIONS.agent.manage) của người đang xem. */
  canManageAgents: boolean;
};

/** Hội thoại có nút "Thành viên": nhóm thường + nhóm Quản trị; không phải tin riêng, không phải kênh cảnh báo. */
export function hasMembersPanel(conversation: ConversationLike | null | undefined): boolean {
  if (!conversation || conversation.type !== 'Group') return false;
  return !isSystemConversation(conversation) || isAgentAdminConversation(conversation);
}

export function canAddMembers(
  conversation: ConversationLike | null | undefined,
  actor: MemberActor
): boolean {
  if (!hasMembersPanel(conversation) || !actor.currentUserId) return false;
  if (!conversation!.participantIds.includes(actor.currentUserId)) return false;
  return isAgentAdminConversation(conversation) ? actor.canManageAgents : true;
}

/**
 * Gỡ NGƯỜI KHÁC (tự rời dùng {@link canLeaveGroup}). Nhóm thường mà chưa biết người tạo (danh sách hội thoại chưa trả
 * createdById) → vẫn hiện nút, máy chủ quyết định và báo lỗi nếu không được.
 */
export function canRemoveMember(
  conversation: ConversationLike | null | undefined,
  memberId: string,
  actor: MemberActor
): boolean {
  if (!hasMembersPanel(conversation) || !actor.currentUserId) return false;
  if (isSystemUserId(memberId) || memberId === actor.currentUserId) return false;
  if (!conversation!.participantIds.includes(memberId)) return false;
  if (isAgentAdminConversation(conversation)) return actor.canManageAgents;
  if (!conversation!.createdById) return true;
  return conversation!.createdById === actor.currentUserId;
}

export function canLeaveGroup(
  conversation: ConversationLike | null | undefined,
  currentUserId: string | null
): boolean {
  return (
    hasMembersPanel(conversation) &&
    !!currentUserId &&
    conversation!.participantIds.includes(currentUserId)
  );
}

/** Người trong danh bạ cửa hàng chưa ở trong nhóm (bỏ Trợ lý hệ thống), xếp theo tên. */
export function addableUsers(users: InternalUser[], participantIds: string[]): InternalUser[] {
  const inGroup = new Set(participantIds);
  return users
    .filter((u) => !u.isSystem && !isSystemUserId(u.id) && !inGroup.has(u.id))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'));
}

/** Thứ tự hiện: mình trước, người khác theo tên, Trợ lý hệ thống cuối. */
export function sortMemberIds(
  participantIds: string[],
  currentUserId: string | null,
  userCache: Record<string, InternalUser>
): string[] {
  const rank = (id: string) => {
    if (id === currentUserId) return 0;
    if (isSystemUserId(id)) return 2;
    return 1;
  };
  return [...participantIds].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return resolveMessengerUser(a, userCache[a]).name.localeCompare(
      resolveMessengerUser(b, userCache[b]).name,
      'vi'
    );
  });
}

// ----------------------------------------------------------------------
// Nhãn "Giao việc được cho CEO" (nhóm Quản trị). Danh bạ messenger không có vai trò / quyền của người khác, nên:
// - chính mình: theo quyền đã tải của tài khoản (hasPermission);
// - người khác: chỉ chủ cửa hàng (Admin) đọc được phân vai (GET /custom-roles/users/{id}) + danh mục quyền
//   (GET /permissions/catalog) + vai trò tuỳ chỉnh (GET /custom-roles) → tính lại như core-be
//   (TenantAccessService.GetPermissionsAsync: quyền mặc định của vai trò hệ thống ∪ quyền của vai trò tuỳ chỉnh);
// - không tính được → 'unknown' (không gắn nhãn, màn hình ghi chú chung).
// ----------------------------------------------------------------------

export type AgentAccess = 'approve' | 'view' | 'unknown';

export const AGENT_APPROVE_PERMISSION = 'agent.approve';
export const AGENT_MANAGE_PERMISSION = 'agent.manage';

export type RoleAssignmentLike = { systemRoles: string[]; customRoleIds: string[] };
export type CustomRoleLike = { id: string; name: string; permissions: string[] };
export type SystemRoleLike = { name: string; permissions: string[] };

export function agentAccessFromRoles(
  assignment: RoleAssignmentLike | null | undefined,
  customRoles: CustomRoleLike[],
  systemRoles: SystemRoleLike[]
): AgentAccess {
  if (!assignment) return 'unknown';
  const { systemRoles: assigned, customRoleIds } = assignment;
  if (assigned.includes('Admin')) return 'approve';
  // Chưa được gán vai trò nào: core-be lùi về vai trò của membership — web không thấy được.
  if (assigned.length === 0 && customRoleIds.length === 0) return 'unknown';

  const permissions = new Set<string>();
  assigned.forEach((name) =>
    systemRoles.find((r) => r.name === name)?.permissions.forEach((p) => permissions.add(p))
  );
  customRoleIds.forEach((id) =>
    customRoles.find((r) => r.id === id)?.permissions.forEach((p) => permissions.add(p))
  );

  // agent.manage luôn kèm agent.approve (PermissionCatalog.Expand).
  return permissions.has('*') ||
    permissions.has(AGENT_APPROVE_PERMISSION) ||
    permissions.has(AGENT_MANAGE_PERMISSION)
    ? 'approve'
    : 'view';
}

const SYSTEM_ROLE_SHORT: Record<string, string> = {
  Admin: 'Chủ cửa hàng',
  Manager: 'Quản lý',
  Staff: 'Nhân viên',
  User: 'Người dùng',
};

/** Tên vai trò để hiện dưới tên thành viên (vai trò hệ thống + vai trò tuỳ chỉnh). */
export function memberRoleNames(
  assignment: RoleAssignmentLike | null | undefined,
  customRoles: CustomRoleLike[]
): string[] {
  if (!assignment) return [];
  return [
    ...assignment.systemRoles.map((r) => SYSTEM_ROLE_SHORT[r] ?? r),
    ...assignment.customRoleIds
      .map((id) => customRoles.find((r) => r.id === id)?.name)
      .filter((name): name is string => !!name),
  ];
}

export type AgentMemberChip = { label: string; color: 'success' | 'default'; rolesLink: boolean };

/** Nhãn của một người trong nhóm Quản trị; null = không gắn (Trợ lý hệ thống, hoặc chưa biết quyền). */
export function agentMemberChip(memberId: string, access: AgentAccess): AgentMemberChip | null {
  if (isSystemUserId(memberId)) return null;
  if (access === 'approve')
    return { label: 'Giao việc được cho CEO', color: 'success', rolesLink: false };
  if (access === 'view') return { label: 'Chỉ xem', color: 'default', rolesLink: true };
  return null;
}

// ----------------------------------------------------------------------
// Dòng "đang nhập…" dưới khung chat. Trong nhóm Quản trị, Trợ lý hệ thống gõ = agent CEO đang soạn trả lời (A4b).
// ----------------------------------------------------------------------

export const CEO_TYPING_LABEL = 'CEO đang soạn…';

export function messengerTypingLabel(
  typingIds: string[],
  opts: {
    currentUserId: string | null;
    conversation: { systemKey?: string | null } | null | undefined;
    userCache: Record<string, InternalUser>;
  }
): string {
  const others = typingIds.filter((id) => id !== opts.currentUserId);
  if (others.length === 0) return '';

  const ceo = isAgentAdminConversation(opts.conversation) && others.some(isSystemUserId);
  const people = others
    .filter((id) => !(ceo && isSystemUserId(id)))
    .map((id) => {
      if (isSystemUserId(id)) return resolveMessengerUser(id, opts.userCache[id]).name;
      return opts.userCache[id]?.fullName?.split(' ').at(-1) ?? '...';
    });

  const parts: string[] = [];
  if (ceo) parts.push(CEO_TYPING_LABEL);
  if (people.length > 0) parts.push(`${people.join(', ')} đang nhập...`);
  return parts.join(' · ');
}
