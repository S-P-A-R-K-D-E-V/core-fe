'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import ShiftScheduleNewEditForm from '../shift-schedule-new-edit-form';

// ----------------------------------------------------------------------

export default function ShiftScheduleCreateView() {
  const settings = useSettingsContext();

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Create Shift Schedule"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Shift Schedules', href: paths.dashboard.shift.schedules.list },
          { name: 'New Schedule' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <ShiftScheduleNewEditForm />
    </Container>
  );
}
