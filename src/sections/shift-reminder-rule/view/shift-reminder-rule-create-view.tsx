'use client';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import ShiftReminderRuleNewEditForm from '../shift-reminder-rule-new-edit-form';

// ----------------------------------------------------------------------

export default function ShiftReminderRuleCreateView() {
  const settings = useSettingsContext();

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Thêm quy tắc nhắc lịch làm"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Nhắc lịch làm', href: paths.dashboard.shift.reminderRules.list },
          { name: 'Thêm mới' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <ShiftReminderRuleNewEditForm />
    </Container>
  );
}
