'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import ShiftTemplateNewEditForm from '../shift-template-new-edit-form';

// ----------------------------------------------------------------------

export default function ShiftTemplateCreateView() {
  const settings = useSettingsContext();

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Create Shift Template"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Shift Templates', href: paths.dashboard.shift.templates.list },
          { name: 'New Template' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <ShiftTemplateNewEditForm />
    </Container>
  );
}
