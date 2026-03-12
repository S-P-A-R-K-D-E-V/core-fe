'use client';

import { useState, useEffect } from 'react';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { IShift } from 'src/types/corecms-api';
import { getShiftById } from 'src/api/attendance';

import ShiftNewEditForm from '../shift-new-edit-form';

// ----------------------------------------------------------------------

type Props = {
  id: string;
};

export default function ShiftEditView({ id }: Props) {
  const settings = useSettingsContext();
  const [currentShift, setCurrentShift] = useState<IShift | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const shift = await getShiftById(id);
        setCurrentShift(shift);
      } catch (error) {
        console.error(error);
      }
    };
    fetch();
  }, [id]);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Edit Shift"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Shift', href: paths.dashboard.shift.list },
          { name: currentShift?.name || 'Edit' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {currentShift && <ShiftNewEditForm currentShift={currentShift} />}
    </Container>
  );
}
