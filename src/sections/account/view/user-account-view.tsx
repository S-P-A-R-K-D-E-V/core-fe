'use client';

import { useState, useCallback } from 'react';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';
import { useSearchParams } from 'src/routes/hooks';

import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import AccountGeneral from '../account-general';
import AccountLoginSessions from '../account-login-sessions';
import AccountChangePassword from '../account-change-password';
import AccountConnectedAccounts from '../account-connected-accounts';
import AccountDelete from '../account-delete';

// ----------------------------------------------------------------------

const TABS = [
  {
    value: 'general',
    label: 'General',
    icon: <Iconify icon="solar:user-id-bold" width={24} />,
  },
  {
    value: 'security',
    label: 'Security',
    icon: <Iconify icon="ic:round-vpn-key" width={24} />,
  },
  {
    value: 'connected',
    label: 'Connected',
    icon: <Iconify icon="solar:link-bold" width={24} />,
  },
];

// ----------------------------------------------------------------------

export default function AccountView() {
  const settings = useSettingsContext();

  const searchParams = useSearchParams();

  // ?tab=connected: trang auth chuyển về đây sau khi liên kết Google/Apple.
  const tabParam = searchParams.get('tab');
  const [currentTab, setCurrentTab] = useState(
    TABS.some((tab) => tab.value === tabParam) ? (tabParam as string) : 'general'
  );

  const handleChangeTab = useCallback((event: React.SyntheticEvent, newValue: string) => {
    setCurrentTab(newValue);
  }, []);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Account"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'User', href: paths.dashboard.user.root },
          { name: 'Account' },
        ]}
        sx={{
          mb: { xs: 3, md: 5 },
        }}
      />

      <Tabs
        value={currentTab}
        onChange={handleChangeTab}
        sx={{
          mb: { xs: 3, md: 5 },
        }}
      >
        {TABS.map((tab) => (
          <Tab key={tab.value} label={tab.label} icon={tab.icon} value={tab.value} />
        ))}
      </Tabs>

      {currentTab === 'general' && <AccountGeneral />}

      {currentTab === 'security' && (
        <>
          <AccountChangePassword />
          <AccountLoginSessions />
          <AccountDelete />
        </>
      )}

      {currentTab === 'connected' && <AccountConnectedAccounts />}
    </Container>
  );
}
