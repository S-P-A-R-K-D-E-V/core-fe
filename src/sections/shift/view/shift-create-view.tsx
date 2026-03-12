'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import ShiftNewEditForm from '../shift-new-edit-form';

// ----------------------------------------------------------------------

export default function ShiftCreateView() {
  const settings = useSettingsContext();

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Create Shift"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Shift', href: paths.dashboard.shift.list },
          { name: 'New Shift' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <ShiftNewEditForm />
    </Container>
  );
}
