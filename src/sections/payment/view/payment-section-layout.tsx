'use client';

import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Container from '@mui/material/Container';

import { paths } from 'src/routes/paths';
import { useRouter, usePathname } from 'src/routes/hooks';

import { useAuthContext } from 'src/auth/hooks';
import { hasAnyRole, getUserRoles } from 'src/auth/roles';

import Iconify from 'src/components/iconify';
import { useSettingsContext } from 'src/components/settings';
import CustomBreadcrumbs from 'src/components/custom-breadcrumbs';

import { PAYMENT_PAGES, paymentPageOf } from '../payment-pages';

// ----------------------------------------------------------------------
// Khung chung của mục Thanh toán: tiêu đề + thanh tab (mỗi tab một route con, chỉ hiện tab vai trò được xem), nội dung
// trang con bên dưới. Trang con tự chặn thêm theo vai trò (RoleBasedGuard) — route cũng chặn ở route-roles.
// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export default function PaymentSectionLayout({ children }: Props) {
  const settings = useSettingsContext();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthContext();

  const roles = getUserRoles(user);
  const pages = PAYMENT_PAGES.filter((p) => hasAnyRole(roles, p.roles));
  const current = paymentPageOf(pathname);

  return (
    <Container maxWidth={settings.themeStretch ? false : 'xl'}>
      <CustomBreadcrumbs
        heading="Thanh toán"
        links={[
          { name: 'Dashboard', href: paths.dashboard.root },
          { name: 'Thanh toán', href: paths.dashboard.payment.root },
          ...(current ? [{ name: current.title }] : []),
        ]}
        sx={{ mb: 3 }}
      />

      {pages.length > 1 && (
        <Tabs
          value={current && pages.includes(current) ? current.value : false}
          onChange={(_, value) => {
            const target = pages.find((p) => p.value === value);
            if (target) router.push(target.path);
          }}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{ mb: 3 }}
        >
          {pages.map((p) => (
            <Tab
              key={p.value}
              value={p.value}
              label={p.title}
              icon={<Iconify icon={p.icon} width={24} />}
            />
          ))}
        </Tabs>
      )}

      {children}
    </Container>
  );
}
