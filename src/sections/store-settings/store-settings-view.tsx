'use client';

import { useState } from 'react';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';

import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import AgentKeysTab from './agent-keys-tab';
import StoreBrandingTab from './store-branding-tab';
import KiotVietConnectionTab from './kiotviet-connection-tab';

// ----------------------------------------------------------------------

const TABS = [
  { value: 'branding', label: 'Thông tin cửa hàng', icon: 'solar:shop-bold' },
  { value: 'kiotviet', label: 'Kết nối KiotViet', icon: 'solar:link-round-bold' },
  { value: 'agent-keys', label: 'Khoá API cho trợ lý AI', icon: 'solar:key-bold' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

export default function StoreSettingsView() {
  const settings = useSettingsContext();
  const [tab, setTab] = useState<TabValue>('branding');

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Cài đặt cửa hàng"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Cài đặt cửa hàng' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: { xs: 3, md: 5 } }}>
        {TABS.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} icon={<Iconify icon={t.icon} width={24} />} />
        ))}
      </Tabs>

      {tab === 'branding' && <StoreBrandingTab />}
      {tab === 'kiotviet' && <KiotVietConnectionTab />}
      {tab === 'agent-keys' && <AgentKeysTab />}
    </Container>
  );
}
