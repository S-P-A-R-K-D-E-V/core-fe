'use client';

import { useState, useEffect } from 'react';

import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import { apiErrorMessage } from 'src/utils/api-error';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import type { ICustomRole } from 'src/types/corecms-api';

import { getCustomRoles } from 'src/api/custom-roles';

import CustomRoleForm from '../custom-role-form';

// ----------------------------------------------------------------------

type Props = {
  id: string;
};

export default function RoleEditView({ id }: Props) {
  const [role, setRole] = useState<ICustomRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Danh sách vai trò của một cửa hàng ngắn — lấy cả danh sách thay vì thêm endpoint chi tiết.
    getCustomRoles()
      .then((roles) => {
        const found = roles.find((r) => r.id === id);
        if (found) setRole(found);
        else setError('Không tìm thấy vai trò.');
      })
      .catch((e) => setError(apiErrorMessage(e, 'Không tải được vai trò')));
  }, [id]);

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Sửa vai trò"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Vai trò', href: paths.dashboard.role.list },
          { name: role?.name || '...' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {error && <Alert severity="error">{error}</Alert>}
      {role && <CustomRoleForm currentRole={role} />}
    </Container>
  );
}
