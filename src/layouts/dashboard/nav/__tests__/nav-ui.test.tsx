import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Giao diện menu mới: thanh module ngang + mega-menu, ngăn kéo menu, ghim, ô tìm nhanh Ctrl K (gõ không dấu).
// ----------------------------------------------------------------------

const ALL = [
  'commerce.retail.pos',
  'commerce.retail.inventory',
  'workforce.shift-scheduling',
  'workforce.attendance',
  'payroll.core',
];

vi.mock('src/components/branding', () => ({ useStoreBrand: () => ({ isCiCi: true }) }));
vi.mock('src/sections/counter/counter-scope', () => ({ useCounterSession: () => false }));
vi.mock('src/components/iconify', () => ({ default: () => null }));
vi.mock('src/components/logo', () => ({ default: () => <span>logo</span> }));
vi.mock('src/components/scrollbar', () => ({ default: ({ children }: any) => <div>{children}</div> }));

const push = vi.fn();
vi.mock('src/routes/hooks', () => ({
  useRouter: () => ({ push, replace: push }),
  usePathname: () => '/dashboard/pos/purchase-order/abc/edit',
}));
vi.mock('src/routes/components', () => ({
  RouterLink: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: { id: 'u1', roles: ['Admin'], enabledFeatures: ALL } }),
}));

// Imported after the mocks above.
import Searchbar from 'src/layouts/common/searchbar';
import NavSidebar from 'src/layouts/dashboard/nav/nav-sidebar';
import NavModuleBar from 'src/layouts/dashboard/nav/nav-module-bar';
import { useNavModules } from 'src/layouts/dashboard/config-navigation';

import { useNavPrefs } from 'src/store/nav-prefs-store';
import { useCommandPalette } from 'src/layouts/dashboard/nav/command-palette-store';

beforeAll(() => {
  // jsdom không có ResizeObserver.
  (globalThis as any).ResizeObserver ??= class {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
});

afterEach(() => {
  vi.clearAllMocks();
  useNavPrefs.setState({ pins: [], recent: [], dirty: false, legacyPaths: null });
  useCommandPalette.setState({ open: false });
});

const theme = createTheme();

function Bar() {
  const tree = useNavModules('Admin', ALL);
  return <NavModuleBar tree={tree} />;
}

function Drawer() {
  const tree = useNavModules('Admin', ALL);
  return <NavSidebar tree={tree} variant="drawer" />;
}

describe('thanh module ngang', () => {
  it('bấm module mở mega-menu chia nhóm, có hàng Thiết lập và nút "+"', async () => {
    render(
      <ThemeProvider theme={theme}>
        <Bar />
      </ThemeProvider>
    );

    // Trang đang mở (sửa phiếu nhập) thuộc module Mua hàng.
    const nav = screen.getByRole('navigation', { name: 'Menu chính' });
    await userEvent.click(within(nav).getAllByRole('button', { name: /Nhân viên/ })[0]);

    expect(await screen.findByRole('link', { name: 'Danh sách nhân viên' })).toHaveAttribute('href', '/dashboard/user/list');
    expect(screen.getByText('Ca làm')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mẫu ca' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Thêm nhân viên' })).toHaveAttribute('href', '/dashboard/user/new');
  });

  it('ghim một trang từ mega-menu', async () => {
    render(
      <ThemeProvider theme={theme}>
        <Bar />
      </ThemeProvider>
    );
    const nav = screen.getByRole('navigation', { name: 'Menu chính' });
    await userEvent.click(within(nav).getAllByRole('button', { name: /Sổ quỹ/ })[0]);
    const row = (await screen.findByRole('link', { name: 'Kiểm quầy' })).parentElement!;
    await userEvent.click(within(row).getByRole('button', { name: 'Ghim' }));
    expect(useNavPrefs.getState().pins).toEqual(['cash.shift']);
  });
});

describe('ngăn kéo menu', () => {
  it('Cá nhân đứng đầu; module đang mở tự bung; ghim hiện ở trên', () => {
    useNavPrefs.setState({ pins: ['me.payroll'] });
    render(
      <ThemeProvider theme={theme}>
        <Drawer />
      </ThemeProvider>
    );

    const modules = screen.getAllByRole('button', { expanded: false }).concat(screen.getAllByRole('button', { expanded: true }));
    expect(modules.length).toBeGreaterThan(3);
    expect(screen.getByText('Đã ghim')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Lương của tôi' }).length).toBeGreaterThan(0);
    // Mua hàng (trang đang mở) đã bung.
    expect(screen.getByRole('link', { name: 'Phiếu nhập hàng' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('ô tìm nhanh', () => {
  it('Ctrl K mở, gõ không dấu ra trang và lệnh, Enter mở trang', async () => {
    render(
      <ThemeProvider theme={theme}>
        <Searchbar />
      </ThemeProvider>
    );

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    });
    const input = await screen.findByRole('textbox', { name: 'Tìm trang, lệnh' });
    await userEvent.type(input, 'phieu nhap');

    expect(screen.getByText('Trang')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tạo phiếu nhập/ })).toBeInTheDocument();

    await userEvent.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/dashboard/pos/purchase-order/list');
  });

  it('tìm theo từ khoá: "kiem tien" ra Kiểm quầy', async () => {
    render(
      <ThemeProvider theme={theme}>
        <Searchbar />
      </ThemeProvider>
    );
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', metaKey: true }));
    });
    await userEvent.type(await screen.findByRole('textbox', { name: 'Tìm trang, lệnh' }), 'kiem tien');
    await userEvent.keyboard('{Enter}');
    expect(push).toHaveBeenCalledWith('/dashboard/shift-cash');
  });
});
