import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import ListItemText from '@mui/material/ListItemText';

import { useBoolean } from 'src/hooks/use-boolean';

import { useAuthContext } from 'src/auth/hooks';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomPopover, { usePopover } from 'src/components/custom-popover';

import { IUser, UserStatus } from 'src/types/corecms-api';
import { changeUserStatus, resetUserPassword } from 'src/api/users';

import UserQuickEditForm from './user-quick-edit-form';
import UserRolesDialog from './user-roles-dialog';
import UserBranchesDialog from './user-branches-dialog';

// ----------------------------------------------------------------------

type Props = {
  selected: boolean;
  onEditRow: VoidFunction;
  row: IUser;
  onSelectRow: VoidFunction;
  onDeleteRow: VoidFunction;
  onRefresh?: VoidFunction;
};

export default function UserTableRow({
  row,
  selected,
  onEditRow,
  onSelectRow,
  onDeleteRow,
  onRefresh,
}: Props) {
  const { fullName, profileImageUrl, roles, status, email, phoneNumber, branchScope } = row;

  const { enqueueSnackbar } = useSnackbar();

  // Gán vai trò chỉ Admin: BE POST /roles/assign [Admin], GET /permissions/user/{id} của người khác chỉ
  // Admin (Manager → 403) — Manager không thấy mục "Manage Roles".
  const { user } = useAuthContext();
  const isAdmin = user?.role === 'Admin' || (user?.roles ?? []).includes('Admin');
  const isManager = user?.role === 'Manager' || (user?.roles ?? []).includes('Manager');

  // Phân công chi nhánh (BE kiểm tra lại): Admin luôn mọi chi nhánh nên không phân công; Admin phân công cho Quản lý và
  // Nhân viên; Quản lý chỉ cho Nhân viên. BE cũ không trả branchScope → ẩn mục này.
  const targetIsAdmin = (roles ?? []).includes('Admin');
  const targetIsManager = (roles ?? []).includes('Manager');
  const canAssignBranches =
    !!branchScope && !targetIsAdmin && (isAdmin || (isManager && !targetIsManager));

  const confirm = useBoolean();

  const resetPwConfirm = useBoolean();

  const quickEdit = useBoolean();

  const rolesDialog = useBoolean();

  const branchesDialog = useBoolean();

  const popover = usePopover();

  const handleChangeStatus = async (newStatus: UserStatus) => {
    try {
      await changeUserStatus(row.id, { status: newStatus });
      enqueueSnackbar(`Status changed to ${newStatus}`);
      onRefresh?.();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Failed to change status', { variant: 'error' });
    }
  };

  const handleResetPassword = async () => {
    try {
      await resetUserPassword(row.id, { newPassword: 'Password@123' });
      enqueueSnackbar('Password reset to default (Password@123)');
      resetPwConfirm.onFalse();
    } catch (error) {
      console.error(error);
      enqueueSnackbar('Failed to reset password', { variant: 'error' });
    }
  };

  return (
    <>
      <TableRow hover selected={selected}>
        <TableCell padding="checkbox">
          <Checkbox checked={selected} onClick={onSelectRow} />
        </TableCell>

        <TableCell sx={{ display: 'flex', alignItems: 'center' }}>
          <Avatar alt={fullName} src={profileImageUrl} sx={{ mr: 2 }} />

          <ListItemText
            primary={fullName}
            secondary={email}
            primaryTypographyProps={{ typography: 'body2' }}
            secondaryTypographyProps={{
              component: 'span',
              color: 'text.disabled',
            }}
          />
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>{phoneNumber}</TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {roles?.join(', ') || '-'}
          {branchScope && !branchScope.allBranches && (
            <Label variant="soft" color="info" sx={{ ml: 1 }}>
              {branchScope.branchIds.length} chi nhánh
            </Label>
          )}
        </TableCell>

        <TableCell>
          <Label
            variant="soft"
            color={
              (status === 'Active' && 'success') ||
              (status === 'Pending' && 'warning') ||
              (status === 'Banned' && 'error') ||
              (status === 'Rejected' && 'error') ||
              'default'
            }
          >
            {status}
          </Label>
        </TableCell>

        <TableCell align="right" sx={{ px: 1, whiteSpace: 'nowrap' }}>
          <Tooltip title="Quick Edit" placement="top" arrow>
            <IconButton color={quickEdit.value ? 'inherit' : 'default'} onClick={quickEdit.onTrue}>
              <Iconify icon="solar:pen-bold" />
            </IconButton>
          </Tooltip>

          <IconButton color={popover.open ? 'inherit' : 'default'} onClick={popover.onOpen}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      <UserQuickEditForm currentUser={row} open={quickEdit.value} onClose={quickEdit.onFalse} onRefresh={onRefresh} />

      {isAdmin && (
        <UserRolesDialog
          open={rolesDialog.value}
          onClose={rolesDialog.onFalse}
          userId={row.id}
          userName={fullName}
        />
      )}

      {canAssignBranches && (
        <UserBranchesDialog
          open={branchesDialog.value}
          onClose={branchesDialog.onFalse}
          userId={row.id}
          userName={fullName}
          onSaved={onRefresh}
        />
      )}

      <CustomPopover
        open={popover.open}
        onClose={popover.onClose}
        arrow="right-top"
        sx={{ width: 200 }}
      >
        <MenuItem
          onClick={() => {
            onEditRow();
            popover.onClose();
          }}
        >
          <Iconify icon="solar:pen-bold" />
          Edit
        </MenuItem>

        {isAdmin && (
          <MenuItem
            onClick={() => {
              rolesDialog.onTrue();
              popover.onClose();
            }}
          >
            <Iconify icon="solar:shield-keyhole-bold" />
            Manage Roles
          </MenuItem>
        )}

        {canAssignBranches && (
          <MenuItem
            onClick={() => {
              branchesDialog.onTrue();
              popover.onClose();
            }}
          >
            <Iconify icon="solar:shop-bold" />
            Chi nhánh làm việc
          </MenuItem>
        )}

        {status !== 'Active' && (
          <MenuItem
            onClick={() => {
              handleChangeStatus('Active');
              popover.onClose();
            }}
          >
            <Iconify icon="solar:check-circle-bold" />
            Set Active
          </MenuItem>
        )}

        {status !== 'Banned' && (
          <MenuItem
            onClick={() => {
              handleChangeStatus('Banned');
              popover.onClose();
            }}
            sx={{ color: 'warning.main' }}
          >
            <Iconify icon="solar:forbidden-circle-bold" />
            Ban User
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            resetPwConfirm.onTrue();
            popover.onClose();
          }}
        >
          <Iconify icon="solar:key-bold" />
          Reset Password
        </MenuItem>

        <MenuItem
          onClick={() => {
            confirm.onTrue();
            popover.onClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <Iconify icon="solar:trash-bin-trash-bold" />
          Delete
        </MenuItem>
      </CustomPopover>

      <ConfirmDialog
        open={confirm.value}
        onClose={confirm.onFalse}
        title="Delete"
        content="Are you sure want to delete?"
        action={
          <Button variant="contained" color="error" onClick={onDeleteRow}>
            Delete
          </Button>
        }
      />

      <ConfirmDialog
        open={resetPwConfirm.value}
        onClose={resetPwConfirm.onFalse}
        title="Reset Password"
        content="Are you sure you want to reset this user's password to default (Password@123)?"
        action={
          <Button variant="contained" color="warning" onClick={handleResetPassword}>
            Reset
          </Button>
        }
      />
    </>
  );
}
