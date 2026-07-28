'use client';

import { useState, useEffect } from 'react';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { IShiftReminderRule } from 'src/types/shift-reminder-rule';
import { getShiftReminderRules } from 'src/api/shift-reminder-rules';

import ShiftReminderRuleNewEditForm from '../shift-reminder-rule-new-edit-form';

// ----------------------------------------------------------------------

type Props = {
  id: string;
};

export default function ShiftReminderRuleEditView({ id }: Props) {
  const settings = useSettingsContext();
  const [currentRule, setCurrentRule] = useState<IShiftReminderRule | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        // Chưa có API get-by-id riêng - danh sách rule nhỏ nên lấy hết rồi lọc.
        const rules = await getShiftReminderRules();
        setCurrentRule(rules.find((r) => r.id === id) || null);
      } catch (error) {
        console.error(error);
      }
    };
    fetch();
  }, [id]);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Sửa quy tắc nhắc lịch làm"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Nhắc lịch làm', href: paths.dashboard.shift.reminderRules.list },
          { name: currentRule?.name || 'Sửa' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {currentRule && <ShiftReminderRuleNewEditForm currentRule={currentRule} />}
    </Container>
  );
}
