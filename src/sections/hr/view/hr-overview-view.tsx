'use client';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Container from '@mui/material/Container';

import { useAuthContext } from 'src/auth/hooks';
import { useActiveHrRules } from 'src/api/hr-rules';
import { PERMISSIONS, hasAnyPermission } from 'src/auth/permissions';

import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { StaffRankingCard, MyProvisionalScoreCard } from '../hr-score-cards';

// ----------------------------------------------------------------------
// Tổng quan nhân sự: quản lý xem xếp hạng theo điểm tháng, mọi nhân viên xem điểm của mình.
// ----------------------------------------------------------------------

export default function HrOverviewView() {
  const settings = useSettingsContext();
  const rules = useActiveHrRules();
  const { user } = useAuthContext();
  const canRead = hasAnyPermission(user, [PERMISSIONS.hr.performanceRead, PERMISSIONS.hr.performanceManage]);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs heading="Tổng quan nhân sự" links={[{ name: 'Tổng quan' }, { name: 'Nhân sự' }]} sx={{ mb: 2 }} />
      {rules && !rules.performanceEnabled && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Cửa hàng chưa bật chấm điểm hiệu suất.
        </Alert>
      )}
      <Stack spacing={2}>
        <MyProvisionalScoreCard hideWhenEmpty={canRead} />
        {canRead && <StaffRankingCard />}
      </Stack>
    </Container>
  );
}
