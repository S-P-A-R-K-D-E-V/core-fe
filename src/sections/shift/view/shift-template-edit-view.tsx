'use client';

import { useState, useEffect } from 'react';

import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { IShiftTemplate } from 'src/types/corecms-api';
import { getShiftTemplateById } from 'src/api/attendance';

import ShiftTemplateNewEditForm from '../shift-template-new-edit-form';

// ----------------------------------------------------------------------

type Props = {
  id: string;
};

export default function ShiftTemplateEditView({ id }: Props) {
  const settings = useSettingsContext();
  const [currentTemplate, setCurrentTemplate] = useState<IShiftTemplate | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const template = await getShiftTemplateById(id);
        setCurrentTemplate(template);
      } catch (error) {
        console.error(error);
      }
    };
    fetch();
  }, [id]);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Edit Shift Template"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Shift Templates', href: paths.dashboard.shift.templates.list },
          { name: currentTemplate?.name || 'Edit' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      {currentTemplate && <ShiftTemplateNewEditForm currentTemplate={currentTemplate} />}
    </Container>
  );
}
