'use client';

import { useState } from 'react';

import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import { paths } from 'src/routes/paths';
import { useSearchParams } from 'src/routes/hooks';

import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';
import { useSettingsContext } from 'src/components/settings';

import { parseDateStr, toDateStr } from 'src/utils/format-time';

import CleaningReviewChecklist from '../cleaning-review-checklist';

// ----------------------------------------------------------------------
// Standalone "Đánh giá" page: same pass/fail + penalty logic as the
// "Theo dõi tuần" popup (src/sections/cleaning/cleaning-review-dialog.tsx),
// both backed by CleaningReviewChecklist so the logic isn't duplicated.

const CLEANING_BLOCKS = [
  { value: 'Morning', label: 'Sáng' },
  { value: 'Afternoon', label: 'Chiều' },
  { value: 'Evening', label: 'Tối' },
];

// ----------------------------------------------------------------------

export default function CleaningReviewView() {
  const settings = useSettingsContext();
  const searchParams = useSearchParams();

  const [date, setDate] = useState(searchParams.get('date') || toDateStr(new Date()));
  const [block, setBlock] = useState(searchParams.get('block') || 'Morning');

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Đánh giá vệ sinh"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Vệ sinh', href: paths.dashboard.cleaning.root },
          { name: 'Đánh giá' },
        ]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card sx={{ mb: 3, p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <DatePicker
            label="Ngày"
            value={parseDateStr(date)}
            onChange={(val) => setDate(toDateStr(val))}
            format="dd/MM/yyyy"
            slotProps={{ textField: { sx: { width: { xs: 1, md: 200 } } } }}
          />
          <TextField
            select
            label="Ca"
            value={block}
            onChange={(e) => setBlock(e.target.value)}
            sx={{ width: { xs: 1, md: 200 } }}
          >
            {CLEANING_BLOCKS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Card>

      <CleaningReviewChecklist date={date} block={block} />
    </Container>
  );
}
