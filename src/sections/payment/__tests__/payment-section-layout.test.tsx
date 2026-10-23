import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { paths } from 'src/routes/paths';

// ----------------------------------------------------------------------
// Mục Thanh toán: một tiêu đề + thanh tab (mỗi tab một route con), chỉ hiện tab vai trò được xem; tab đang mở theo
// đường dẫn.
// ----------------------------------------------------------------------

const nav = vi.hoisted(() => ({ pathname: '/dashboard/payment/reconciliation', push: vi.fn() }));
vi.mock('src/routes/hooks', () => ({
  useRouter: () => ({ push: nav.push, replace: vi.fn() }),
  usePathname: () => nav.pathname,
}));

const auth = vi.hoisted(() => ({ user: { role: 'Admin', roles: ['Admin'] } as any }));
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => ({ user: auth.user }) }));
vi.mock('src/components/settings', () => ({ useSettingsContext: () => ({ themeStretch: false }) }));
vi.mock('src/components/iconify', () => ({ default: () => null }));
vi.mock('src/components/custom-breadcrumbs', () => ({
  default: ({ heading, links }: { heading: string; links: { name: string }[] }) => (
    <div>
      <h1>{heading}</h1>
      <span>{links.map((l) => l.name).join(' / ')}</span>
    </div>
  ),
}));

// Imported after the mocks above.
import PaymentSectionLayout from '../view/payment-section-layout';
import { paymentPageOf } from '../payment-pages';

const renderLayout = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <PaymentSectionLayout>
        <p>nội dung trang</p>
      </PaymentSectionLayout>
    </ThemeProvider>
  );

afterEach(() => {
  vi.clearAllMocks();
  nav.pathname = paths.dashboard.payment.reconciliation;
  auth.user = { role: 'Admin', roles: ['Admin'] };
});

describe('PaymentSectionLayout', () => {
  it('chủ cửa hàng: ba tab, tab theo đường dẫn, bấm tab mở route con', async () => {
    const user = userEvent.setup();
    nav.pathname = paths.dashboard.payment.settings;
    renderLayout();

    expect(screen.getByRole('heading', { name: 'Thanh toán' })).toBeInTheDocument();
    expect(screen.getByText('Dashboard / Thanh toán / Cài đặt')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Đối soát',
      'Đơn online',
      'Cài đặt',
    ]);
    expect(screen.getByRole('tab', { name: 'Cài đặt' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('nội dung trang')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Đơn online' }));
    expect(nav.push).toHaveBeenCalledWith(paths.dashboard.payment.onlineOrders);
  });

  it('quản lý: chỉ đối soát và đơn online', () => {
    auth.user = { role: 'Manager', roles: ['Manager'] };
    renderLayout();

    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Đối soát',
      'Đơn online',
    ]);
  });

  it('nhân viên: chỉ đơn online (không hiện thanh tab một mục)', () => {
    auth.user = { role: 'Staff', roles: ['Staff'] };
    nav.pathname = paths.dashboard.payment.onlineOrders;
    renderLayout();

    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.getByText('Dashboard / Thanh toán / Đơn online')).toBeInTheDocument();
  });

  it('trang con theo tiền tố đường dẫn', () => {
    expect(paymentPageOf(`${paths.dashboard.payment.onlineOrders}/abc`)?.value).toBe(
      'online-orders'
    );
    expect(paymentPageOf(paths.dashboard.payment.root)).toBeUndefined();
    expect(paymentPageOf(null)).toBeUndefined();
  });
});
