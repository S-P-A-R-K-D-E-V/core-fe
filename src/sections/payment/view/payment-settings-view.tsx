'use client';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';

import { useRouter, useSearchParams } from 'src/routes/hooks';

import Iconify from 'src/components/iconify';

import BankAccountsTab from 'src/sections/store-settings/bank-accounts-tab';
import PaymentConnectionsTab from 'src/sections/store-settings/payment-connections-tab';

import PaymentChannelsCard from '../settings/payment-channels-card';
import OnlineShopSettingsCard from '../settings/online-shop-settings-card';
import { paymentSettingsHref, paymentSettingsTabOf, PAYMENT_SETTINGS_TABS } from '../payment-pages';

// ----------------------------------------------------------------------
// Thanh toán → Cài đặt (chủ cửa hàng): một chỗ cho mọi cấu hình thanh toán — phương thức tích chọn theo kênh (POS /
// Online), bán online & giao hàng (nhận tại cửa hàng, hãng vận chuyển, cách tính phí ship), tài khoản ngân hàng nhận tiền,
// báo có & kết nối S Payment (ApiPay, ngân hàng trực tiếp, payOS...). Tab nằm trên URL (?tab=) để thông báo / link mở đúng.
// ----------------------------------------------------------------------

export default function PaymentSettingsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = paymentSettingsTabOf(searchParams.get('tab'));

  return (
    <Stack spacing={3}>
      <Tabs
        value={tab}
        onChange={(_, value) => router.replace(paymentSettingsHref(value))}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ borderBottom: (theme) => `1px dashed ${theme.palette.divider}` }}
      >
        {PAYMENT_SETTINGS_TABS.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            label={t.label}
            iconPosition="start"
            icon={<Iconify icon={t.icon} width={20} />}
          />
        ))}
      </Tabs>

      {tab === 'channels' && (
        <PaymentChannelsCard onOpenConnections={() => router.replace(paymentSettingsHref('connections'))} />
      )}
      {tab === 'online' && <OnlineShopSettingsCard />}
      {tab === 'accounts' && <BankAccountsTab />}
      {tab === 'connections' && <PaymentConnectionsTab />}
    </Stack>
  );
}
