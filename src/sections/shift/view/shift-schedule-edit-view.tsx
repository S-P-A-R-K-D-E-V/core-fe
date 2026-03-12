'use client';

import { useState, useEffect } from 'react';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { IShiftSchedule } from 'src/types/corecms-api';
import { getShiftScheduleById } from 'src/api/attendance';

import ShiftScheduleNewEditForm from '../shift-schedule-new-edit-form';

// ----------------------------------------------------------------------

type Props = {
  id: string;
};

export default function ShiftScheduleEditView({ id }: Props) {
  const settings = useSettingsContext();
  const [currentSchedule, setCurrentSchedule] = useState<IShiftSchedule | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const schedule = await getShiftScheduleById(id);
        setCurrentSchedule(schedule);
      } catch (error) {
        console.error(error);
      }
    };
    fetch();
  }, [id]);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Edit Shift Schedule"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Shift Schedules', href: paths.dashboard.shift.schedules.list },
          { name: 'Edit' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {currentSchedule && <ShiftScheduleNewEditForm currentSchedule={currentSchedule} />}
    </Container>
  );
}
