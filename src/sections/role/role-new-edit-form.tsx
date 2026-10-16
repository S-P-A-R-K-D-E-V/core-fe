'use client';

import * as Yup from 'yup';
import { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid2';
import Checkbox from '@mui/material/Checkbox';
import Typography from '@mui/material/Typography';
import LoadingButton from '@mui/lab/LoadingButton';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import { apiErrorMessage } from 'src/utils/api-error';

import { useSnackbar } from 'src/components/snackbar';
import FormProvider, { RHFTextField } from 'src/components/hook-form';

import { IRole, IPermission, IRoleCatalogStatus } from 'src/types/corecms-api';

import { createRole, updateRole, getAllPermissions, getRoleCatalogStatus } from 'src/api/roles';

// ----------------------------------------------------------------------

type Props = {
  currentRole?: IRole;
};

export default function RoleNewEditForm({ currentRole }: Props) {
  const router = useRouter();

  const { enqueueSnackbar } = useSnackbar();

  const [allPermissions, setAllPermissions] = useState<IPermission[]>([]);

  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);

  const [catalog, setCatalog] = useState<IRoleCatalogStatus | null>(null);

  const readOnly = catalog?.editable === false;

  // Tên vai trò hệ thống là khoá phân quyền của API — Core-be từ chối đổi.
  const nameLocked = !!currentRole?.isSystem;

  useEffect(() => {
    getRoleCatalogStatus().then(setCatalog);
  }, []);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const perms = await getAllPermissions();
        setAllPermissions(perms);
      } catch (error) {
        console.error('Failed to fetch permissions:', error);
      }
    };
    fetchPermissions();
  }, []);

  useEffect(() => {
    if (currentRole?.permissions) {
      setSelectedPermissionIds(currentRole.permissions.map((p) => p.id));
    }
  }, [currentRole]);

  const NewRoleSchema = Yup.object().shape({
    name: Yup.string().required('Name is required'),
    description: Yup.string().default(''),
  });

  const defaultValues = useMemo(
    () => ({
      name: currentRole?.name || '',
      description: currentRole?.description || '',
    }),
    [currentRole]
  );

  const methods = useForm({
    resolver: yupResolver(NewRoleSchema),
    defaultValues,
  });

  const {
    reset,
    handleSubmit,
    formState: { isSubmitting },
  } = methods;

  useEffect(() => {
    if (currentRole) {
      reset(defaultValues);
    }
  }, [currentRole, defaultValues, reset]);

  const onSubmit = handleSubmit(async (data) => {
    try {
      if (currentRole) {
        await updateRole(currentRole.id, {
          name: data.name,
          description: data.description,
          permissionIds: selectedPermissionIds,
        });
        enqueueSnackbar('Update success!');
      } else {
        await createRole({
          name: data.name,
          description: data.description,
          permissionIds: selectedPermissionIds,
        });
        enqueueSnackbar('Create success!');
      }
      router.push(paths.dashboard.role.list);
    } catch (error) {
      console.error(error);
      enqueueSnackbar(
        apiErrorMessage(error, currentRole ? 'Không cập nhật được vai trò' : 'Không tạo được vai trò'),
        { variant: 'error' }
      );
    }
  });

  const handleTogglePermission = (permissionId: string) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleToggleGroup = (groupPermissions: IPermission[]) => {
    const groupIds = groupPermissions.map((p) => p.id);
    const allSelected = groupIds.every((id) => selectedPermissionIds.includes(id));

    if (allSelected) {
      setSelectedPermissionIds((prev) => prev.filter((id) => !groupIds.includes(id)));
    } else {
      setSelectedPermissionIds((prev) => Array.from(new Set([...prev, ...groupIds])));
    }
  };

  // Group permissions by their group field
  const permissionsByGroup = useMemo(() => {
    const groups: Record<string, IPermission[]> = {};
    allPermissions.forEach((perm) => {
      const group = perm.group || 'Other';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(perm);
    });
    return groups;
  }, [allPermissions]);

  return (
    <FormProvider methods={methods} onSubmit={onSubmit}>
      {readOnly && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {catalog?.reason || 'Danh mục vai trò của cửa hàng này không sửa được.'}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ p: 3 }}>
            <Box
              rowGap={3}
              columnGap={2}
              display="grid"
              gridTemplateColumns={{ xs: 'repeat(1, 1fr)' }}
            >
              <RHFTextField
                name="name"
                label="Role Name"
                disabled={nameLocked || readOnly}
                helperText={nameLocked ? 'Vai trò hệ thống — không đổi tên được.' : undefined}
              />

              <RHFTextField
                name="description"
                label="Description"
                multiline
                rows={4}
                disabled={readOnly}
              />
            </Box>

            <Stack alignItems="flex-end" sx={{ mt: 3 }}>
              <LoadingButton type="submit" variant="contained" loading={isSubmitting} disabled={readOnly}>
                {!currentRole ? 'Create Role' : 'Save Changes'}
              </LoadingButton>
            </Stack>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Permissions
            </Typography>

            <Alert severity="warning" sx={{ mb: 2 }}>
              Quyền chi tiết đang được lưu nhưng chưa dùng để chặn truy cập: hệ thống hiện phân quyền theo vai trò
              Admin / Manager / Staff.
            </Alert>

            {Object.entries(permissionsByGroup).map(([group, permissions]) => {
              const groupIds = permissions.map((p) => p.id);
              const allSelected = groupIds.every((id) => selectedPermissionIds.includes(id));
              const someSelected =
                groupIds.some((id) => selectedPermissionIds.includes(id)) && !allSelected;

              return (
                <Box key={group} sx={{ mb: 2 }}>
                  <FormControlLabel
                    label={
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                        {group}
                      </Typography>
                    }
                    control={
                      <Checkbox
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={() => handleToggleGroup(permissions)}
                      />
                    }
                  />

                  <Box sx={{ pl: 4, display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                    {permissions.map((permission) => (
                      <FormControlLabel
                        key={permission.id}
                        label={
                          <Box>
                            <Typography variant="body2">{permission.name}</Typography>
                            {permission.description && (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {permission.description}
                              </Typography>
                            )}
                          </Box>
                        }
                        control={
                          <Checkbox
                            checked={selectedPermissionIds.includes(permission.id)}
                            onChange={() => handleTogglePermission(permission.id)}
                          />
                        }
                        sx={{ width: '50%', mr: 0 }}
                      />
                    ))}
                  </Box>

                  <Divider sx={{ mt: 1 }} />
                </Box>
              );
            })}

            {allPermissions.length === 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                No permissions available
              </Typography>
            )}
          </Card>
        </Grid>
      </Grid>
    </FormProvider>
  );
}
