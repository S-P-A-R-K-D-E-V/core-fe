'use client';

import { useState, useEffect, useCallback } from 'react';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import Container from '@mui/material/Container';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import TableContainer from '@mui/material/TableContainer';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';
import { RouterLink } from 'src/routes/components';

import { apiErrorMessage } from 'src/utils/api-error';

import Label from 'src/components/label';
import Iconify from 'src/components/iconify';
import Scrollbar from 'src/components/scrollbar';
import { useSnackbar } from 'src/components/snackbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { ICustomRole, IPermissionCatalog } from 'src/types/corecms-api';

import {
  getCustomRoles,
  deleteCustomRole,
  SYSTEM_ROLE_LABELS,
  getPermissionCatalog,
} from 'src/api/custom-roles';

import PermissionChecklist from '../permission-checklist';

// ----------------------------------------------------------------------
// Vai trò & phân quyền: vai trò hệ thống (quyền cố định, chỉ xem) + vai trò tuỳ chỉnh của cửa hàng (Core-be /custom-roles).
// ----------------------------------------------------------------------

export default function RoleListView() {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [catalog, setCatalog] = useState<IPermissionCatalog | null>(null);
  const [customRoles, setCustomRoles] = useState<ICustomRole[] | null>(null);
  const [viewing, setViewing] = useState<{ name: string; permissions: string[] } | null>(null);
  const [deleting, setDeleting] = useState<ICustomRole | null>(null);

  const total = catalog?.groups.reduce((n, g) => n + g.permissions.length, 0) ?? 0;

  const load = useCallback(async () => {
    try {
      const [cat, roles] = await Promise.all([getPermissionCatalog(), getCustomRoles()]);
      setCatalog(cat);
      setCustomRoles(roles);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không tải được vai trò'), { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCustomRole(deleting.id);
      enqueueSnackbar('Đã xoá vai trò');
      load();
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, 'Không xoá được vai trò'), { variant: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  const countLabel = (permissions: string[]) =>
    total > 0 && permissions.length >= total ? 'Toàn quyền' : `${permissions.length}/${total} quyền`;

  return (
    <>
      <Container maxWidth="lg">
        <CustomBreadcrumbs
          heading="Vai trò & phân quyền"
          links={[
            { name: 'Dashboard', href: paths.dashboard.root },
            { name: 'Vai trò', href: paths.dashboard.role.root },
            { name: 'Danh sách' },
          ]}
          action={
            <Button
              component={RouterLink}
              href={paths.dashboard.role.new}
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
            >
              Thêm vai trò
            </Button>
          }
          sx={{ mb: { xs: 3, md: 5 } }}
        />

        <Alert severity="info" sx={{ mb: 3 }}>
          Vai trò hệ thống có quyền cố định. Muốn cấp quyền khác (vd Thu ngân chỉ bán hàng, Kế toán xem báo cáo) thì tạo
          vai trò tuỳ chỉnh rồi gán trong mục Người dùng.
        </Alert>

        <Card sx={{ mb: 3 }}>
          <CardHeader title="Vai trò tuỳ chỉnh" subheader="Riêng của cửa hàng này" />
          <TableContainer sx={{ mt: 2 }}>
            <Scrollbar>
              <Table sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Tên</TableCell>
                    <TableCell>Vai trò gốc</TableCell>
                    <TableCell>Quyền</TableCell>
                    <TableCell>Người dùng</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customRoles?.map((role) => (
                    <TableRow key={role.id} hover>
                      <TableCell>
                        <strong>{role.name}</strong>
                        {role.description && (
                          <Typography variant="caption" component="div" sx={{ color: 'text.secondary' }}>
                            {role.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{SYSTEM_ROLE_LABELS[role.baseRole] ?? role.baseRole}</TableCell>
                      <TableCell>
                        <Label variant="soft" color="info">
                          {countLabel(role.permissions)}
                        </Label>
                      </TableCell>
                      <TableCell>{role.userCount}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title="Sửa">
                          <IconButton aria-label={`Sửa ${role.name}`} onClick={() => router.push(paths.dashboard.role.edit(role.id))}>
                            <Iconify icon="solar:pen-bold" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={role.userCount > 0 ? 'Gỡ vai trò khỏi mọi người trước khi xoá' : 'Xoá'}>
                          <span>
                            <IconButton
                              aria-label={`Xoá ${role.name}`}
                              color="error"
                              disabled={role.userCount > 0}
                              onClick={() => setDeleting(role)}
                            >
                              <Iconify icon="solar:trash-bin-trash-bold" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}

                  {customRoles?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', color: 'text.secondary', py: 4 }}>
                        Chưa có vai trò tuỳ chỉnh.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Scrollbar>
          </TableContainer>
        </Card>

        <Card>
          <CardHeader title="Vai trò hệ thống" subheader="Quyền cố định, không sửa được" />
          <TableContainer sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Vai trò</TableCell>
                  <TableCell>Quyền chi tiết</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {catalog?.systemRoles.map((role) => (
                  <TableRow key={role.name} hover>
                    <TableCell>{SYSTEM_ROLE_LABELS[role.name] ?? role.name}</TableCell>
                    <TableCell>
                      <Label variant="soft" color={role.permissions.length > 0 ? 'success' : 'default'}>
                        {countLabel(role.permissions)}
                      </Label>
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => setViewing(role)}>
                        Xem quyền
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Container>

      <Dialog fullWidth maxWidth="md" open={!!viewing} onClose={() => setViewing(null)}>
        <DialogTitle>Quyền của {viewing ? SYSTEM_ROLE_LABELS[viewing.name] ?? viewing.name : ''}</DialogTitle>
        <DialogContent dividers>
          {viewing && catalog && <PermissionChecklist catalog={catalog} selected={viewing.permissions} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewing(null)}>Đóng</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Xoá vai trò"
        content={`Xoá vai trò "${deleting?.name ?? ''}"?`}
        action={
          <Button variant="contained" color="error" onClick={handleDelete}>
            Xoá
          </Button>
        }
      />
    </>
  );
}
