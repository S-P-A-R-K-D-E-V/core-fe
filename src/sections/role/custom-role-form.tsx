'use client';

import * as Yup from 'yup';
import { useForm } from 'react-hook-form';
import { useMemo, useState, useEffect } from 'react';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid2';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { apiErrorMessage } from 'src/utils/api-error';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField, RHFRadioGroup } from 'src/components/hook-form';

import type { ICustomRole, IPermissionCatalog } from 'src/types/corecms-api';

import {
  createCustomRole,
  updateCustomRole,
  SYSTEM_ROLE_LABELS,
  getPermissionCatalog,
} from 'src/api/custom-roles';

import SystemRoleBaseline from './system-role-baseline';
import PermissionChecklist from './permission-checklist';

// ----------------------------------------------------------------------

const SYSTEM_ROLE_NAMES = ['admin', 'manager', 'staff', 'user'];

const BASE_ROLE_HELP: Record<string, string> = {
  Manager: 'Vào được các màn hình dành cho quản lý mà chưa chuyển sang phân quyền chi tiết.',
  Staff: 'Vào được các màn hình dành cho nhân viên mà chưa chuyển sang phân quyền chi tiết.',
};

type Props = {
  currentRole?: ICustomRole;
};

export default function CustomRoleForm({ currentRole }: Props) {
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const [catalog, setCatalog] = useState<IPermissionCatalog | null>(null);
  const [selected, setSelected] = useState<string[]>(currentRole?.permissions ?? []);

  useEffect(() => {
    getPermissionCatalog()
      .then(setCatalog)
      .catch((error) => enqueueSnackbar(apiErrorMessage(error, 'Không tải được danh mục quyền'), { variant: 'error' }));
  }, [enqueueSnackbar]);

  const schema = Yup.object().shape({
    name: Yup.string()
      .trim()
      .required('Nhập tên vai trò')
      .max(100, 'Tối đa 100 ký tự')
      .test('not-system', 'Trùng tên vai trò hệ thống — chọn tên khác', (v) => !SYSTEM_ROLE_NAMES.includes((v ?? '').trim().toLowerCase())),
    description: Yup.string().max(500, 'Tối đa 500 ký tự').default(''),
    baseRole: Yup.string().required('Chọn vai trò gốc'),
  });

  const defaultValues = useMemo(
    () => ({
      name: currentRole?.name ?? '',
      description: currentRole?.description ?? '',
      baseRole: currentRole?.baseRole ?? 'Staff',
    }),
    [currentRole]
  );

  const methods = useForm({ resolver: yupResolver(schema), defaultValues });
  const {
    reset,
    watch,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    reset(defaultValues);
    setSelected(currentRole?.permissions ?? []);
  }, [currentRole, defaultValues, reset]);

  const baseRole = watch('baseRole');

  const onSubmit = handleSubmit(async (data) => {
    const payload = {
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      baseRole: data.baseRole,
      permissions: selected,
    };
    try {
      if (currentRole) {
        await updateCustomRole(currentRole.id, payload);
        enqueueSnackbar('Đã lưu vai trò');
      } else {
        await createCustomRole(payload);
        enqueueSnackbar('Đã tạo vai trò');
      }
      router.push(paths.dashboard.role.list);
    } catch (error) {
      enqueueSnackbar(apiErrorMessage(error, currentRole ? 'Không lưu được vai trò' : 'Không tạo được vai trò'), {
        variant: 'error',
      });
    }
  });

  const baseRoles = catalog?.baseRoles ?? ['Manager', 'Staff'];
  const baseBaseline = catalog?.systemRoles.find((r) => r.name === baseRole)?.baseline;

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ p: 3 }}>
            <Stack spacing={3}>
              <RHFTextField name="name" label="Tên vai trò" placeholder="VD: Thu ngân, Kế toán" />

              <RHFTextField name="description" label="Mô tả" multiline rows={3} />

              <Box>
                <RHFRadioGroup
                  name="baseRole"
                  label="Vai trò gốc"
                  options={baseRoles.map((r) => ({ value: r, label: SYSTEM_ROLE_LABELS[r] ?? r }))}
                />
                {baseBaseline?.length ? (
                  <Box sx={{ mt: 1 }}>
                    <SystemRoleBaseline baseline={baseBaseline} title="Vai trò gốc làm được sẵn" />
                  </Box>
                ) : null}
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {baseBaseline?.length ? '' : BASE_ROLE_HELP[baseRole] ?? ''}
                  {currentRole && currentRole.userCount > 0 && baseRole !== currentRole.baseRole
                    ? ' Đổi vai trò gốc sẽ đăng xuất những người đang mang vai trò này.'
                    : ''}
                </Typography>
              </Box>

              <LoadingButton type="submit" variant="contained" loading={isSubmitting} disabled={!catalog}>
                {currentRole ? 'Lưu thay đổi' : 'Tạo vai trò'}
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Quyền chi tiết
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Chỉ liệt kê quyền hệ thống đã áp dụng. Người mang vai trò này chỉ có đúng các quyền được chọn — vai trò gốc
              không cộng thêm quyền. Đổi quyền có hiệu lực ngay, không cần đăng nhập lại.
            </Alert>

            {catalog ? (
              <PermissionChecklist catalog={catalog} selected={selected} onChange={setSelected} />
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Đang tải danh mục quyền…
              </Typography>
            )}
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
