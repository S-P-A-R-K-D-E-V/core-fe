'use client';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import { paths } from 'src/routes/paths';

import { RoleBasedGuard } from 'src/auth/guard';
import EmptyContent from 'src/components/empty-content';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { getAutomationRules, type IAutomationRule } from 'src/api/automation';

import AutomationRuleCard from '../automation-rule-card';
import { groupRulesByArea, requestErrorMessage } from '../automation-fields';

// ----------------------------------------------------------------------

// Cảnh báo tự động của cửa hàng: những việc hệ thống tự kiểm tra rồi báo cho mọi Admin. Chỉ Admin vào được
// (core-be: AutomationController [Authorize(Roles = "Admin")]) — vai trò khác thấy "không có quyền" và trang
// không gọi API.
export default function AutomationSettingsView() {
  const settings = useSettingsContext();

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Cảnh báo tự động"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Cảnh báo tự động' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <RoleBasedGuard hasContent roles={['Admin']}>
        <AutomationRuleList />
      </RoleBasedGuard>
    </Container>
  );
}

// ----------------------------------------------------------------------

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; rules: IAutomationRule[] }
  // Máy chủ chưa có API (404): core-be chưa triển khai bản có cảnh báo tự động.
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

function AutomationRuleList() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const rules = await getAutomationRules();
      setState(rules === null ? { status: 'unavailable' } : { status: 'ready', rules });
    } catch (err) {
      setState({
        status: 'error',
        message: requestErrorMessage(err, 'Không tải được danh sách cảnh báo tự động.'),
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaved = useCallback((updated: IAutomationRule) => {
    setState((prev) =>
      prev.status === 'ready'
        ? {
            ...prev,
            rules: prev.rules.map((rule) => (rule.code === updated.code ? updated : rule)),
          }
        : prev
    );
  }, []);

  if (state.status === 'loading') {
    return (
      <Stack alignItems="center" sx={{ py: 10 }}>
        <CircularProgress aria-label="Đang tải cảnh báo tự động" />
      </Stack>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <EmptyContent
        filled
        title="Tính năng chưa sẵn sàng trên máy chủ"
        description="Máy chủ chưa được cập nhật phần cảnh báo tự động. Vui lòng thử lại sau."
        sx={{ py: 10 }}
      />
    );
  }

  if (state.status === 'error') {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={load}>
            Thử lại
          </Button>
        }
      >
        {state.message}
      </Alert>
    );
  }

  if (state.rules.length === 0) {
    return <EmptyContent filled title="Chưa có cảnh báo tự động nào" sx={{ py: 10 }} />;
  }

  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      <Alert severity="info">
        Hệ thống tự kiểm tra các tình huống dưới đây và báo cho{' '}
        <strong>mọi Admin của cửa hàng</strong> qua chuông thông báo và nhóm Messenger nội bộ{' '}
        <strong>“Cảnh báo hệ thống”</strong>. Bật/tắt từng cảnh báo, chọn kênh gửi và chỉnh ngưỡng
        cho phù hợp với cửa hàng.
      </Alert>

      {groupRulesByArea(state.rules).map(({ area, rules }) => (
        <Box key={area.key} component="section">
          <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
            {area.title}
          </Typography>

          <Stack spacing={2}>
            {rules.map((rule) => (
              <AutomationRuleCard key={rule.code} rule={rule} onSaved={handleSaved} />
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
