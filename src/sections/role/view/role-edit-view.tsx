'use client';

import { useState, useEffect } from 'react';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { IRole } from 'src/types/corecms-api';

import { getRoleById } from 'src/api/roles';
import RoleNewEditForm from '../role-new-edit-form';


// ----------------------------------------------------------------------

type Props = {
  id: string;
};

export default function RoleEditView({ id }: Props) {
  const [currentRole, setCurrentRole] = useState<IRole | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const role = await getRoleById(id);
        setCurrentRole(role);
      } catch (error) {
        console.error('Failed to fetch role:', error);
      }
    };
    fetchRole();
  }, [id]);

  return (
    <Container maxWidth="lg">
      <CustomBreadcrumbs
        heading="Edit Role"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Role', href: paths.dashboard.role.list },
          { name: currentRole?.name || '...' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {currentRole && <RoleNewEditForm currentRole={currentRole} />}
    </Container>
  );
}
