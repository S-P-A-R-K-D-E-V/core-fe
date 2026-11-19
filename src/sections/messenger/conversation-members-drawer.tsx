'use client';

import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';

import { paths } from 'src/routes/paths';
import { RouterLink } from 'src/routes/components';

import {
  canAddMembers,
  addableUsers,
  canLeaveGroup,
  sortMemberIds,
  agentMemberChip,
  canRemoveMember,
  memberRoleNames,
  agentAccessFromRoles,
} from 'src/utils/messenger-members';
import type {
  AgentAccess,
  CustomRoleLike,
  SystemRoleLike,
  RoleAssignmentLike,
} from 'src/utils/messenger-members';
import {
  resolveMessengerUser,
  messengerErrorMessage,
  isAgentAdminConversation,
} from 'src/utils/messenger-system';

import { getUserRoles } from 'src/auth/roles';
import { PERMISSIONS, hasPermission } from 'src/auth/permissions';
import Iconify from 'src/components/iconify';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { SystemSenderAvatar } from 'src/components/messenger/system-avatar';

import { useMessengerStore } from 'src/store/messenger-store';
import { addGroupMembers, removeGroupMember } from 'src/api/messenger';
import type { InternalUser, Conversation, ConversationSummary } from 'src/api/messenger';
import { useAgentAdminGroup } from 'src/api/agent-center';
import { getCustomRoles, getPermissionCatalog, getUserRoleAssignment } from 'src/api/custom-roles';

// ----------------------------------------------------------------------
// Ngăn "Thành viên" của nhóm Messenger (A4a): danh sách, thêm người, gỡ người, rời nhóm. Luật ẩn / hiện nút ở
// src/utils/messenger-members.ts (khớp core-be); máy chủ vẫn quyết định — lỗi trả về luôn hiện trong ngăn.
// ----------------------------------------------------------------------

type Props = {
  open: boolean;
  onClose: VoidFunction;
  conversation: ConversationSummary;
  /** Người đang xem (useAuthContext().user). */
  user: any;
  /** Đã rời nhóm — màn chat bỏ chọn hội thoại. */
  onLeft: VoidFunction;
};

type RoleInfo = {
  /** userId → quyền giao việc cho CEO. */
  access: Record<string, AgentAccess>;
  /** userId → tên vai trò. */
  roles: Record<string, string[]>;
};

type Pending = { kind: 'remove'; memberId: string } | { kind: 'leave' } | null;

export default function ConversationMembersDrawer({
  open,
  onClose,
  conversation,
  user,
  onLeft,
}: Props) {
  const currentUserId: string | null = user?.id ?? null;
  const userCache = useMessengerStore((s) => s.userCache);

  const agentAdmin = isAgentAdminConversation(conversation);
  const canManageAgents = hasPermission(user, PERMISSIONS.agent.manage);
  const actor = { currentUserId, canManageAgents };
  const isOwner = getUserRoles(user).includes('Admin');

  const [toAdd, setToAdd] = useState<InternalUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [roleInfo, setRoleInfo] = useState<RoleInfo>({ access: {}, roles: {} });

  const memberIds = useMemo(
    () => sortMemberIds(conversation.participantIds, currentUserId, userCache),
    [conversation.participantIds, currentUserId, userCache]
  );
  const candidates = useMemo(
    () => addableUsers(Object.values(userCache), conversation.participantIds),
    [userCache, conversation.participantIds]
  );

  useEffect(() => {
    if (!open) {
      setToAdd([]);
      setError(null);
      setPending(null);
    }
  }, [open]);

  // Ai giao việc được cho CEO: máy chủ trả sẵn (GET agent-center/admin-group → approverIds), ai trong nhóm cũng thấy.
  const { info: adminGroupInfo } = useAgentAdminGroup(open && agentAdmin);
  const approverIds = adminGroupInfo?.approverIds ?? null;

  // Tên vai trò của người khác (chỉ hiện thêm cho chủ cửa hàng) + dự phòng khi máy chủ cũ chưa trả approverIds.
  const memberKey = conversation.participantIds.join(',');
  useEffect(() => {
    if (!open || !agentAdmin || !isOwner) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [catalog, customRoles] = await Promise.all([
          getPermissionCatalog(),
          getCustomRoles(),
        ]);
        const systemRoles: SystemRoleLike[] = catalog.systemRoles ?? [];
        const custom: CustomRoleLike[] = customRoles;
        const people = conversation.participantIds.filter(
          (id) => !resolveMessengerUser(id, userCache[id]).isSystem
        );
        const assignments = await Promise.all(
          people.map((id) =>
            getUserRoleAssignment(id)
              .then((a): [string, RoleAssignmentLike | null] => [id, a])
              .catch((): [string, RoleAssignmentLike | null] => [id, null])
          )
        );
        if (cancelled) return;
        const next: RoleInfo = { access: {}, roles: {} };
        assignments.forEach(([id, a]) => {
          next.access[id] = agentAccessFromRoles(a, custom, systemRoles);
          next.roles[id] = memberRoleNames(a, custom);
        });
        setRoleInfo(next);
      } catch {
        // Không đọc được phân vai → không gắn nhãn cho người khác, vẫn có ghi chú chung.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agentAdmin, isOwner, conversation.id, memberKey]);

  const accessOf = (memberId: string): AgentAccess => {
    if (memberId === currentUserId) {
      return hasPermission(user, PERMISSIONS.agent.approve) ? 'approve' : 'view';
    }
    if (approverIds) return approverIds.includes(memberId) ? 'approve' : 'view';
    return roleInfo.access[memberId] ?? 'unknown';
  };

  const applyConversation = (updated: Conversation) => {
    useMessengerStore.getState().updateConversation({
      id: conversation.id,
      participantIds: updated.participantIds,
      createdById: updated.createdById,
    });
  };

  const handleAdd = async () => {
    if (toAdd.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await addGroupMembers(
        conversation.id,
        toAdd.map((u) => u.id)
      );
      applyConversation(updated);
      setToAdd([]);
    } catch (err) {
      setError(messengerErrorMessage(err, 'Không thêm được người vào nhóm.'));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    if (!pending || !currentUserId) return;
    const leaving = pending.kind === 'leave';
    const memberId = leaving ? currentUserId : pending.memberId;
    setBusy(true);
    setError(null);
    try {
      const updated = await removeGroupMember(conversation.id, memberId);
      setPending(null);
      if (leaving) {
        const s = useMessengerStore.getState();
        s.setConversations(s.conversations.filter((c) => c.id !== conversation.id));
        onLeft();
      } else {
        applyConversation(updated);
      }
    } catch (err) {
      setPending(null);
      setError(
        messengerErrorMessage(
          err,
          leaving ? 'Không rời nhóm được.' : 'Không gỡ được người này khỏi nhóm.'
        )
      );
    } finally {
      setBusy(false);
    }
  };

  const pendingName =
    pending?.kind === 'remove'
      ? resolveMessengerUser(pending.memberId, userCache[pending.memberId]).name
      : '';
  const people = conversation.participantIds.filter(
    (id) => !resolveMessengerUser(id, userCache[id]).isSystem
  );

  return (
    <>
      <Drawer
        anchor="right"
        open={open}
        onClose={onClose}
        PaperProps={{ sx: { width: { xs: 1, sm: 380 } } }}
      >
        <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.5 }}>
          <Typography variant="h6" sx={{ flex: 1 }}>
            Thành viên ({people.length})
          </Typography>
          <IconButton onClick={onClose} aria-label="Đóng">
            <Iconify icon="mingcute:close-line" />
          </IconButton>
        </Stack>
        <Divider />

        <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {agentAdmin && (
            <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
              Người có quyền duyệt agent mới giao việc được cho CEO; người khác chỉ xem.
              {!canManageAgents &&
                ' Chỉ người có quyền quản lý đội agent mới thêm / gỡ thành viên.'}
            </Alert>
          )}

          {canAddMembers(conversation, actor) && (
            <Stack spacing={1} sx={{ mb: 2 }}>
              <Autocomplete
                multiple
                size="small"
                options={candidates}
                value={toAdd}
                onChange={(_, value) => setToAdd(value)}
                getOptionLabel={(option) => option.fullName}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                filterSelectedOptions
                noOptionsText="Không còn ai để thêm"
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    <Avatar
                      src={option.avatarUrl ?? undefined}
                      sx={{ width: 28, height: 28, mr: 1, fontSize: 13 }}
                    >
                      {option.fullName.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap>
                        {option.fullName}
                      </Typography>
                      {option.email && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {option.email}
                        </Typography>
                      )}
                    </Box>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField {...params} label="Thêm người" placeholder="Tìm theo tên" />
                )}
              />
              <Button
                variant="contained"
                disabled={busy || toAdd.length === 0}
                onClick={handleAdd}
                startIcon={<Iconify icon="solar:user-plus-bold" />}
              >
                Thêm{toAdd.length > 0 ? ` ${toAdd.length} người` : ''}
              </Button>
            </Stack>
          )}

          <Stack spacing={1.5}>
            {memberIds.map((id) => {
              const identity = resolveMessengerUser(id, userCache[id]);
              const roles =
                id === currentUserId && !roleInfo.roles[id]
                  ? memberRoleNames({ systemRoles: getUserRoles(user), customRoleIds: [] }, [])
                  : (roleInfo.roles[id] ?? []);
              const chip = agentAdmin ? agentMemberChip(id, accessOf(id)) : null;
              const removable = canRemoveMember(conversation, id, actor);

              return (
                <Stack
                  key={id}
                  direction="row"
                  alignItems="center"
                  spacing={1.5}
                  data-testid={`member-${id}`}
                >
                  {identity.isSystem ? (
                    <SystemSenderAvatar size={36} />
                  ) : (
                    <Avatar src={identity.avatarUrl ?? undefined} sx={{ width: 36, height: 36 }}>
                      {identity.name.charAt(0).toUpperCase()}
                    </Avatar>
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2" noWrap>
                      {identity.name}
                      {id === currentUserId && ' (bạn)'}
                    </Typography>
                    {identity.isSystem ? (
                      <Typography variant="caption" color="text.secondary">
                        {agentAdmin ? 'Đăng thẻ của đội agent · CEO' : 'Người gửi tự động'}
                      </Typography>
                    ) : (
                      roles.length > 0 && (
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {roles.join(', ')}
                        </Typography>
                      )
                    )}
                    {chip && (
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                        <Chip size="small" label={chip.label} color={chip.color} variant="soft" />
                        {chip.rolesLink && isOwner && (
                          <Link
                            component={RouterLink}
                            href={paths.dashboard.role.list}
                            variant="caption"
                            underline="hover"
                          >
                            Vai trò & quyền
                          </Link>
                        )}
                      </Stack>
                    )}
                  </Box>
                  {removable && (
                    <Button
                      size="small"
                      color="error"
                      disabled={busy}
                      onClick={() => setPending({ kind: 'remove', memberId: id })}
                    >
                      Gỡ
                    </Button>
                  )}
                </Stack>
              );
            })}
          </Stack>
        </Box>

        {canLeaveGroup(conversation, currentUserId) && (
          <>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Button
                fullWidth
                color="error"
                variant="outlined"
                disabled={busy}
                onClick={() => setPending({ kind: 'leave' })}
                startIcon={<Iconify icon="solar:logout-2-outline" />}
              >
                Rời nhóm
              </Button>
            </Box>
          </>
        )}
      </Drawer>

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending?.kind === 'leave' ? 'Rời nhóm?' : 'Gỡ khỏi nhóm?'}
        content={
          pending?.kind === 'leave'
            ? agentAdmin && !canManageAgents
              ? 'Bạn sẽ không còn thấy tin của nhóm. Muốn vào lại phải nhờ người có quyền quản lý đội agent thêm vào.'
              : 'Bạn sẽ không còn thấy tin của nhóm này.'
            : `${pendingName} sẽ không còn thấy tin của nhóm này.`
        }
        cancelText="Huỷ"
        action={
          <Button variant="contained" color="error" disabled={busy} onClick={handleConfirm}>
            {pending?.kind === 'leave' ? 'Rời nhóm' : 'Gỡ'}
          </Button>
        }
      />
    </>
  );
}
