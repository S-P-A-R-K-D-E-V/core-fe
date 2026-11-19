import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { SYSTEM_USER_ID, AGENT_ADMIN_SYSTEM_KEY } from 'src/utils/messenger-system';

import { useMessengerStore } from 'src/store/messenger-store';
import type { ConversationSummary } from 'src/api/messenger';

// ----------------------------------------------------------------------
// Ngăn "Thành viên" (A4a): ẩn / hiện nút theo luật core-be, nhãn "Giao việc được cho CEO" ở nhóm Quản trị, thêm / gỡ /
// rời nhóm gọi đúng API và cập nhật store, lỗi máy chủ hiện rõ.
// ----------------------------------------------------------------------

const ME = '11111111-1111-1111-1111-111111111111';
const HUNG = '22222222-2222-2222-2222-222222222222';
const MAI = '33333333-3333-3333-3333-333333333333';

vi.mock('src/components/iconify', () => ({
  default: ({ icon }: any) => <span data-icon={icon} />,
}));

vi.mock('src/routes/components', async () => {
  const { forwardRef } = await import('react');
  return {
    RouterLink: forwardRef<HTMLAnchorElement, any>(({ href, children, ...other }, ref) => (
      <a ref={ref} href={href} {...other}>
        {children}
      </a>
    )),
  };
});

const addGroupMembers = vi.fn();
const removeGroupMember = vi.fn();
vi.mock('src/api/messenger', () => ({
  addGroupMembers: (...args: any[]) => addGroupMembers(...args),
  removeGroupMember: (...args: any[]) => removeGroupMember(...args),
}));

const getPermissionCatalog = vi.fn();
const getCustomRoles = vi.fn();
const getUserRoleAssignment = vi.fn();
vi.mock('src/api/custom-roles', () => ({
  getPermissionCatalog: () => getPermissionCatalog(),
  getCustomRoles: () => getCustomRoles(),
  getUserRoleAssignment: (id: string) => getUserRoleAssignment(id),
}));

// Imported after the mocks above.
import ConversationMembersDrawer from '../conversation-members-drawer';

const agentAdmin: ConversationSummary = {
  id: 'agent-admin-1',
  type: 'Group',
  name: 'Quản trị – Đội agent',
  participantIds: [SYSTEM_USER_ID, ME, HUNG],
  lastMessagePreview: null,
  lastMessageSenderId: null,
  lastMessageAt: null,
  unreadCount: 0,
  systemKey: AGENT_ADMIN_SYSTEM_KEY,
};

const group: ConversationSummary = {
  ...agentAdmin,
  id: 'g1',
  name: 'Ca sáng',
  systemKey: null,
  participantIds: [ME, HUNG],
};

const managerNoAgent = {
  id: ME,
  role: 'Manager',
  roles: ['Manager'],
  permissions: ['agent.approve'],
};
const owner = { id: ME, role: 'Admin', roles: ['Admin'], permissions: [] };

beforeEach(() => {
  const u = (id: string, fullName: string) => ({
    id,
    fullName,
    email: '',
    avatarUrl: null,
    online: false,
    isSystem: false,
  });
  useMessengerStore.setState({
    userCache: {
      [ME]: u(ME, 'Trần Thị Lan'),
      [HUNG]: u(HUNG, 'Nguyễn Văn Hùng'),
      [MAI]: u(MAI, 'Lê Thị Mai'),
    },
    conversations: [agentAdmin, group],
  });
  getPermissionCatalog.mockResolvedValue({
    groups: [],
    baseRoles: [],
    systemRoles: [
      { name: 'Admin', permissions: ['*'] },
      { name: 'Staff', permissions: [] },
    ],
  });
  getCustomRoles.mockResolvedValue([]);
  getUserRoleAssignment.mockImplementation(async (id: string) =>
    id === ME
      ? { systemRoles: ['Admin'], customRoleIds: [] }
      : { systemRoles: ['Staff'], customRoleIds: [] }
  );
});

afterEach(() => {
  vi.clearAllMocks();
  useMessengerStore.setState({ userCache: {}, conversations: [] });
});

function renderDrawer(conversation: ConversationSummary, user: any, onLeft = vi.fn()) {
  render(
    <ThemeProvider theme={createTheme()}>
      <ConversationMembersDrawer
        open
        onClose={vi.fn()}
        conversation={conversation}
        user={user}
        onLeft={onLeft}
      />
    </ThemeProvider>
  );
  return { onLeft };
}

describe('ConversationMembersDrawer — nhóm Quản trị', () => {
  it('không có agent.manage: không thêm / gỡ người khác, vẫn rời nhóm được; nhãn của mình theo agent.approve', () => {
    renderDrawer(agentAdmin, managerNoAgent);

    expect(screen.getByText('Thành viên (2)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Thêm người')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gỡ' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rời nhóm' })).toBeInTheDocument();

    const me = screen.getByTestId(`member-${ME}`);
    expect(within(me).getByText('Giao việc được cho CEO')).toBeInTheDocument();
    // Người khác: không đọc được phân vai → không gắn nhãn, có ghi chú chung.
    expect(
      within(screen.getByTestId(`member-${HUNG}`)).queryByText('Chỉ xem')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Người có quyền duyệt agent mới giao việc được cho CEO/)
    ).toBeInTheDocument();
    expect(getUserRoleAssignment).not.toHaveBeenCalled();

    // Trợ lý hệ thống: có trong danh sách, không gỡ được, không có nhãn.
    const system = screen.getByTestId(`member-${SYSTEM_USER_ID}`);
    expect(within(system).getByText('Trợ lý hệ thống')).toBeInTheDocument();
    expect(within(system).queryByRole('button')).not.toBeInTheDocument();
  });

  it('chủ cửa hàng: nhãn theo phân vai (Staff → Chỉ xem + link Vai trò & quyền), thêm người gọi API và cập nhật store', async () => {
    const user = userEvent.setup();
    addGroupMembers.mockResolvedValue({
      ...agentAdmin,
      participantIds: [SYSTEM_USER_ID, ME, HUNG, MAI],
      createdById: ME,
    });
    renderDrawer(agentAdmin, owner);

    const hung = await screen.findByTestId(`member-${HUNG}`);
    await waitFor(() => expect(within(hung).getByText('Chỉ xem')).toBeInTheDocument());
    expect(within(hung).getByText('Nhân viên')).toBeInTheDocument();
    expect(within(hung).getByRole('link', { name: 'Vai trò & quyền' })).toHaveAttribute(
      'href',
      '/dashboard/role/list'
    );
    expect(within(hung).getByRole('button', { name: 'Gỡ' })).toBeInTheDocument();
    expect(getUserRoleAssignment).not.toHaveBeenCalledWith(SYSTEM_USER_ID);

    await user.click(screen.getByLabelText('Thêm người'));
    await user.click(await screen.findByRole('option', { name: /Lê Thị Mai/ }));
    await user.click(screen.getByRole('button', { name: 'Thêm 1 người' }));

    expect(addGroupMembers).toHaveBeenCalledWith('agent-admin-1', [MAI]);
    await waitFor(() =>
      expect(useMessengerStore.getState().conversations[0].participantIds).toEqual([
        SYSTEM_USER_ID,
        ME,
        HUNG,
        MAI,
      ])
    );
  });

  it('gỡ bị máy chủ từ chối → báo lỗi trong ngăn', async () => {
    const user = userEvent.setup();
    removeGroupMember.mockRejectedValue({
      error: 'Chỉ người có quyền quản lý đội agent mới thêm / gỡ thành viên nhóm quản trị.',
      code: 'agent_admin_manage',
    });
    renderDrawer(agentAdmin, owner);

    await user.click(
      within(screen.getByTestId(`member-${HUNG}`)).getByRole('button', { name: 'Gỡ' })
    );
    const dialog = await screen.findByRole('dialog', { name: 'Gỡ khỏi nhóm?' });
    await user.click(within(dialog).getByRole('button', { name: 'Gỡ' }));

    expect(removeGroupMember).toHaveBeenCalledWith('agent-admin-1', HUNG);
    expect(
      await screen.findByText(
        'Chỉ người có quyền quản lý đội agent mới thêm / gỡ thành viên nhóm quản trị.'
      )
    ).toBeInTheDocument();
  });
});

describe('ConversationMembersDrawer — nhóm thường', () => {
  it('ai trong nhóm cũng thêm được; rời nhóm gọi API với id của mình, bỏ hội thoại khỏi danh sách', async () => {
    const user = userEvent.setup();
    removeGroupMember.mockResolvedValue({ ...group, participantIds: [HUNG], createdById: HUNG });
    const { onLeft } = renderDrawer(group, managerNoAgent);

    expect(screen.getByLabelText('Thêm người')).toBeInTheDocument();
    expect(screen.queryByText('Giao việc được cho CEO')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Rời nhóm' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rời nhóm?' });
    await user.click(within(dialog).getByRole('button', { name: 'Rời nhóm' }));

    expect(removeGroupMember).toHaveBeenCalledWith('g1', ME);
    await waitFor(() => expect(onLeft).toHaveBeenCalled());
    expect(useMessengerStore.getState().conversations.map((c) => c.id)).toEqual(['agent-admin-1']);
  });

  it('biết người tạo là người khác → không có nút Gỡ', () => {
    renderDrawer({ ...group, createdById: HUNG }, managerNoAgent);
    expect(screen.queryByRole('button', { name: 'Gỡ' })).not.toBeInTheDocument();
  });
});
