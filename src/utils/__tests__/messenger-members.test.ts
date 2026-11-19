import { describe, expect, it } from 'vitest';

import type { InternalUser } from 'src/api/messenger';

import { SYSTEM_USER_ID, SYSTEM_USER_NAME, AGENT_ADMIN_SYSTEM_KEY } from '../messenger-system';
import {
  addableUsers,
  canAddMembers,
  canLeaveGroup,
  sortMemberIds,
  agentMemberChip,
  canRemoveMember,
  hasMembersPanel,
  memberRoleNames,
  CEO_TYPING_LABEL,
  agentAccessFromRoles,
  messengerTypingLabel,
} from '../messenger-members';

// ----------------------------------------------------------------------
// Màn Thành viên (A4a): luật hiện nút phải khớp core-be MessengerService (thêm / gỡ / rời), nhãn "Giao việc được cho
// CEO" theo quyền agent.approve, dòng "CEO đang soạn…" ở nhóm Quản trị.
// ----------------------------------------------------------------------

const ME = '11111111-1111-1111-1111-111111111111';
const HUNG = '22222222-2222-2222-2222-222222222222';
const MAI = '33333333-3333-3333-3333-333333333333';

const user = (id: string, fullName: string, extra: Partial<InternalUser> = {}): InternalUser => ({
  id,
  fullName,
  email: `${id.slice(0, 4)}@test.vn`,
  avatarUrl: null,
  online: false,
  isSystem: false,
  ...extra,
});

const cache: Record<string, InternalUser> = {
  [ME]: user(ME, 'Trần Thị Lan'),
  [HUNG]: user(HUNG, 'Nguyễn Văn Hùng'),
  [MAI]: user(MAI, 'Lê Thị Mai'),
  [SYSTEM_USER_ID]: user(SYSTEM_USER_ID, SYSTEM_USER_NAME, { isSystem: true, email: '' }),
};

const group = { type: 'Group' as const, systemKey: null, participantIds: [ME, HUNG] };
const agentAdmin = {
  type: 'Group' as const,
  systemKey: AGENT_ADMIN_SYSTEM_KEY,
  participantIds: [ME, HUNG, SYSTEM_USER_ID],
};
const alerts = {
  type: 'Group' as const,
  systemKey: 'admin-alerts',
  participantIds: [ME, SYSTEM_USER_ID],
};
const privateChat = { type: 'Private' as const, systemKey: null, participantIds: [ME, HUNG] };

const plain = { currentUserId: ME, canManageAgents: false };
const manager = { currentUserId: ME, canManageAgents: true };

describe('hasMembersPanel', () => {
  it('nhóm thường + nhóm Quản trị có; tin riêng + kênh cảnh báo không', () => {
    expect(hasMembersPanel(group)).toBe(true);
    expect(hasMembersPanel(agentAdmin)).toBe(true);
    expect(hasMembersPanel(alerts)).toBe(false);
    expect(hasMembersPanel(privateChat)).toBe(false);
    expect(hasMembersPanel(null)).toBe(false);
  });
});

describe('canAddMembers', () => {
  it('nhóm thường: ai trong nhóm cũng thêm được', () => {
    expect(canAddMembers(group, plain)).toBe(true);
  });

  it('nhóm Quản trị: cần agent.manage', () => {
    expect(canAddMembers(agentAdmin, plain)).toBe(false);
    expect(canAddMembers(agentAdmin, manager)).toBe(true);
  });

  it('không trong nhóm / kênh cảnh báo / tin riêng → không', () => {
    expect(canAddMembers(group, { currentUserId: MAI, canManageAgents: true })).toBe(false);
    expect(canAddMembers(alerts, manager)).toBe(false);
    expect(canAddMembers(privateChat, manager)).toBe(false);
    expect(canAddMembers(group, { currentUserId: null, canManageAgents: true })).toBe(false);
  });
});

describe('canRemoveMember', () => {
  it('nhóm thường: chỉ người tạo gỡ được người khác', () => {
    expect(canRemoveMember({ ...group, createdById: ME }, HUNG, plain)).toBe(true);
    // Lan không tạo nhóm → không gỡ được Mai, kể cả có agent.manage (chỉ áp cho nhóm Quản trị).
    const byHung = { ...group, participantIds: [ME, HUNG, MAI], createdById: HUNG };
    expect(canRemoveMember(byHung, MAI, manager)).toBe(false);
    expect(canRemoveMember(byHung, MAI, { currentUserId: HUNG, canManageAgents: false })).toBe(
      true
    );
  });

  it('nhóm thường chưa biết người tạo → hiện nút, máy chủ quyết', () => {
    expect(canRemoveMember(group, HUNG, plain)).toBe(true);
  });

  it('nhóm Quản trị: gỡ người khác cần agent.manage', () => {
    expect(canRemoveMember(agentAdmin, HUNG, plain)).toBe(false);
    expect(canRemoveMember(agentAdmin, HUNG, manager)).toBe(true);
  });

  it('không bao giờ gỡ Trợ lý hệ thống, không "gỡ" chính mình (dùng Rời nhóm), không gỡ người ngoài nhóm', () => {
    expect(canRemoveMember(agentAdmin, SYSTEM_USER_ID, manager)).toBe(false);
    expect(canRemoveMember(agentAdmin, SYSTEM_USER_ID.toUpperCase(), manager)).toBe(false);
    expect(canRemoveMember({ ...group, createdById: ME }, ME, plain)).toBe(false);
    expect(canRemoveMember({ ...group, createdById: ME }, MAI, plain)).toBe(false);
    expect(canRemoveMember(alerts, ME, manager)).toBe(false);
  });
});

describe('canLeaveGroup', () => {
  it('ai trong nhóm cũng tự rời được, kể cả nhóm Quản trị không có agent.manage', () => {
    expect(canLeaveGroup(group, ME)).toBe(true);
    expect(canLeaveGroup(agentAdmin, HUNG)).toBe(true);
  });

  it('kênh cảnh báo / tin riêng / không trong nhóm → không', () => {
    expect(canLeaveGroup(alerts, ME)).toBe(false);
    expect(canLeaveGroup(privateChat, ME)).toBe(false);
    expect(canLeaveGroup(group, MAI)).toBe(false);
    expect(canLeaveGroup(group, null)).toBe(false);
  });
});

describe('addableUsers / sortMemberIds', () => {
  it('bỏ người đã trong nhóm và Trợ lý hệ thống, xếp theo tên', () => {
    const list = addableUsers(Object.values(cache), [ME]);
    expect(list.map((u) => u.id)).toEqual([MAI, HUNG]);
  });

  it('mình trước, người khác theo tên, Trợ lý hệ thống cuối', () => {
    expect(sortMemberIds([SYSTEM_USER_ID, HUNG, ME, MAI], ME, cache)).toEqual([
      ME,
      MAI,
      HUNG,
      SYSTEM_USER_ID,
    ]);
  });
});

describe('agentAccessFromRoles + agentMemberChip', () => {
  const systemRoles = [
    { name: 'Admin', permissions: ['*'] },
    { name: 'Manager', permissions: ['orders.read'] },
    { name: 'Staff', permissions: [] },
  ];
  const customRoles = [
    { id: 'r-duyet', name: 'Duyệt agent', permissions: ['agent.approve'] },
    { id: 'r-ql', name: 'Quản lý agent', permissions: ['agent.manage'] },
    { id: 'r-thu-ngan', name: 'Thu ngân', permissions: ['orders.read'] },
  ];

  it('Admin luôn giao việc được', () => {
    expect(
      agentAccessFromRoles({ systemRoles: ['Admin'], customRoleIds: [] }, customRoles, systemRoles)
    ).toBe('approve');
  });

  it('vai trò tuỳ chỉnh có agent.approve hoặc agent.manage → giao việc được', () => {
    expect(
      agentAccessFromRoles(
        { systemRoles: ['Manager'], customRoleIds: ['r-duyet'] },
        customRoles,
        systemRoles
      )
    ).toBe('approve');
    expect(
      agentAccessFromRoles({ systemRoles: [], customRoleIds: ['r-ql'] }, customRoles, systemRoles)
    ).toBe('approve');
  });

  it('quyền mặc định của vai trò hệ thống cũng tính', () => {
    expect(
      agentAccessFromRoles({ systemRoles: ['Manager'], customRoleIds: [] }, customRoles, [
        { name: 'Manager', permissions: ['agent.approve'] },
      ])
    ).toBe('approve');
  });

  it('không có quyền → chỉ xem; chưa gán vai trò / không đọc được → chưa biết', () => {
    expect(
      agentAccessFromRoles(
        { systemRoles: ['Staff'], customRoleIds: ['r-thu-ngan'] },
        customRoles,
        systemRoles
      )
    ).toBe('view');
    expect(
      agentAccessFromRoles({ systemRoles: [], customRoleIds: [] }, customRoles, systemRoles)
    ).toBe('unknown');
    expect(agentAccessFromRoles(null, customRoles, systemRoles)).toBe('unknown');
  });

  it('nhãn: giao việc được / chỉ xem kèm link Vai trò & quyền / không gắn', () => {
    expect(agentMemberChip(HUNG, 'approve')).toEqual({
      label: 'Giao việc được cho CEO',
      color: 'success',
      rolesLink: false,
    });
    expect(agentMemberChip(HUNG, 'view')).toEqual({
      label: 'Chỉ xem',
      color: 'default',
      rolesLink: true,
    });
    expect(agentMemberChip(HUNG, 'unknown')).toBeNull();
    expect(agentMemberChip(SYSTEM_USER_ID, 'approve')).toBeNull();
  });

  it('tên vai trò: vai trò hệ thống rút gọn + vai trò tuỳ chỉnh', () => {
    expect(
      memberRoleNames({ systemRoles: ['Manager'], customRoleIds: ['r-duyet', 'mất'] }, customRoles)
    ).toEqual(['Quản lý', 'Duyệt agent']);
    expect(memberRoleNames(null, customRoles)).toEqual([]);
  });
});

describe('messengerTypingLabel', () => {
  const opts = (systemKey: string | null) => ({
    currentUserId: ME,
    conversation: { systemKey },
    userCache: cache,
  });

  it('không ai (hoặc chỉ mình) gõ → rỗng', () => {
    expect(messengerTypingLabel([], opts(null))).toBe('');
    expect(messengerTypingLabel([ME], opts(null))).toBe('');
  });

  it('người thường: tên cuối + "đang nhập..."', () => {
    expect(messengerTypingLabel([HUNG, MAI], opts(null))).toBe('Hùng, Mai đang nhập...');
  });

  it('nhóm Quản trị: Trợ lý hệ thống gõ = "CEO đang soạn…"', () => {
    expect(messengerTypingLabel([SYSTEM_USER_ID], opts(AGENT_ADMIN_SYSTEM_KEY))).toBe(
      CEO_TYPING_LABEL
    );
    expect(messengerTypingLabel([SYSTEM_USER_ID, HUNG], opts(AGENT_ADMIN_SYSTEM_KEY))).toBe(
      'CEO đang soạn… · Hùng đang nhập...'
    );
  });

  it('nơi khác: Trợ lý hệ thống giữ tên đầy đủ, kể cả khi danh bạ không có mục của nó', () => {
    expect(
      messengerTypingLabel([SYSTEM_USER_ID], {
        currentUserId: ME,
        conversation: { systemKey: 'admin-alerts' },
        userCache: {},
      })
    ).toBe(`${SYSTEM_USER_NAME} đang nhập...`);
  });
});
