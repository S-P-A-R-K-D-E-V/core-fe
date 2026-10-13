import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Nút chi nhánh đang làm việc trên header: hiện tên + loại hình; có từ hai chi nhánh thì bấm để đổi, chỉ một chi
// nhánh thì chỉ hiển thị; màn đang có việc dở khoá nút. Dòng báo ở màn F&B cho chuyển sang chi nhánh F&B.
// ----------------------------------------------------------------------

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

// Imported after the mock above so the components pick up the mocked module.
import { useWorkingBranch } from 'src/store/working-branch-store';

import FnbBranchNotice from 'src/sections/fnb-pos/fnb-branch-notice';

import BranchSwitcher from '../branch-switcher';

const retail = { id: 'b1', name: 'Cửa hàng Chùa Láng', type: 'retail' as const };
const fnb = { id: 'b2', name: 'Quầy cà phê', type: 'fnb' as const };

const working = (branch: typeof retail | typeof fnb | null, options: (typeof retail | typeof fnb)[] | null) =>
  useWorkingBranch.setState({ hydrated: true, branch, options, lock: null });

const show = (ui: React.ReactElement) => render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

const switcher = () => screen.queryByRole('button', { name: /Chi nhánh làm việc/ });

afterEach(() => {
  window.localStorage.clear();
  useWorkingBranch.setState({ hydrated: false, branch: null, options: null, lock: null });
});

describe('BranchSwitcher', () => {
  it('chưa có chi nhánh đang làm việc → không hiện gì', () => {
    show(<BranchSwitcher />);
    expect(switcher()).toBeNull();
  });

  it('một chi nhánh: hiện tên và loại hình, không bấm được', () => {
    working(retail, [retail]);
    show(<BranchSwitcher />);

    expect(switcher()).toBeDisabled();
    expect(screen.getByText('Cửa hàng Chùa Láng')).toBeInTheDocument();
    expect(screen.getByText('Bán lẻ')).toBeInTheDocument();
  });

  it('nhiều chi nhánh: bấm để mở danh sách, chọn chi nhánh khác thì đổi và nhớ', async () => {
    const user = userEvent.setup();
    working(retail, [retail, fnb]);
    show(<BranchSwitcher />);

    await user.click(switcher()!);
    await user.click(screen.getByRole('menuitem', { name: /Quầy cà phê/ }));

    expect(useWorkingBranch.getState().branch).toEqual(fnb);
    expect(switcher()).toHaveAccessibleName('Chi nhánh làm việc: Quầy cà phê');
    expect(screen.getByText('F&B')).toBeInTheDocument();
  });

  it('màn đang có việc dở khoá nút', () => {
    working(fnb, [retail, fnb]);
    useWorkingBranch.setState({ lock: 'Đang mở đơn' });
    show(<BranchSwitcher />);

    expect(switcher()).toBeDisabled();
  });
});

describe('FnbBranchNotice', () => {
  it('đang ở chi nhánh F&B, hoặc chưa hỏi xong danh sách chi nhánh → không hiện gì', () => {
    working(fnb, [retail, fnb]);
    const { container, unmount } = show(<FnbBranchNotice />);
    expect(container).toBeEmptyDOMElement();
    unmount();

    working(retail, null);
    expect(show(<FnbBranchNotice />).container).toBeEmptyDOMElement();
  });

  it('đang ở chi nhánh bán lẻ, có chi nhánh F&B được làm → bấm để chuyển sang', async () => {
    const user = userEvent.setup();
    working(retail, [retail, fnb]);
    show(<FnbBranchNotice />);

    expect(screen.getByText(/Cửa hàng Chùa Láng.*không phải F&B/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Chuyển sang Quầy cà phê' }));

    expect(useWorkingBranch.getState().branch).toEqual(fnb);
  });

  it('không có chi nhánh F&B nào được làm → báo chưa được phân công', () => {
    working(retail, [retail]);
    show(<FnbBranchNotice />);

    expect(screen.getByText(/Chưa có chi nhánh F&B nào bạn được làm/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
