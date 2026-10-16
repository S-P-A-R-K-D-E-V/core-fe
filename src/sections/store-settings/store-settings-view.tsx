'use client';

import { useState } from 'react';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';
import { useRouter } from 'src/routes/hooks';

import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import AgentKeysTab from './agent-keys-tab';
import BankAccountsTab from './bank-accounts-tab';
import StoreBrandingTab from './store-branding-tab';
import PaymentConnectionsTab from './payment-connections-tab';
import KiotVietConnectionTab from './kiotviet-connection-tab';
import CustomerDisplayTab from './customer-display-tab';
import PlatformFeaturesTab from './platform-features-tab';

// ----------------------------------------------------------------------

const TABS = [
  { value: 'branding', label: 'Thông tin cửa hàng', icon: 'solar:shop-bold' },
  { value: 'kiotviet', label: 'Kết nối KiotViet', icon: 'solar:link-round-bold' },
  { value: 'bank-accounts', label: 'Tài khoản ngân hàng', icon: 'solar:wallet-money-bold' },
  { value: 'payment', label: 'Thanh toán', icon: 'solar:card-transfer-bold' },
  { value: 'customer-display', label: 'Màn hình khách', icon: 'solar:monitor-bold' },
  // Mở trang riêng Thiết bị cửa hàng (máy quầy, kiosk, camera — quản lý cũng vào được).
  { value: 'devices', label: 'Thiết bị cửa hàng', icon: 'solar:monitor-smartphone-bold' },
  // Giới hạn tính năng theo nền tảng + vai trò (vd chấm công chỉ trên app với nhân viên).
  { value: 'platform-features', label: 'Tính năng web / app', icon: 'solar:smartphone-2-bold' },
  { value: 'agent-keys', label: 'Kết nối MCP & khoá API', icon: 'solar:key-bold' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

export default function StoreSettingsView() {
  const settings = useSettingsContext();
  const [tab, setTab] = useState<TabValue>('branding');
  const router = useRouter();

  return (
    <Container maxWidth={settings.themeStretch ? false : 'lg'}>
      <CustomBreadcrumbs
        heading="Cài đặt cửa hàng"
        links={[{ name: 'Dashboard', href: paths.dashboard.root }, { name: 'Cài đặt cửa hàng' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Tabs
        value={tab}
        onChange={(_, v) => (v === 'devices' ? router.push(paths.dashboard.storeSettings.devices) : setTab(v))}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: { xs: 3, md: 5 } }}
      >
        {TABS.map((t) => (
          <Tab key={t.value} value={t.value} label={t.label} icon={<Iconify icon={t.icon} width={24} />} />
        ))}
      </Tabs>

      {tab === 'branding' && <StoreBrandingTab />}
      {tab === 'kiotviet' && <KiotVietConnectionTab />}
      {tab === 'bank-accounts' && <BankAccountsTab />}
      {tab === 'payment' && <PaymentConnectionsTab />}
      {tab === 'customer-display' && <CustomerDisplayTab />}
      {tab === 'platform-features' && <PlatformFeaturesTab />}
      {tab === 'agent-keys' && <AgentKeysTab />}
    </Container>
  );
}
