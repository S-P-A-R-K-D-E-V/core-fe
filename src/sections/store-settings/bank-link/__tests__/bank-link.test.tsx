import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IBankLink, IBankLinkBank } from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Đăng ký báo có kiểu KiotViet: ngân hàng → số TK, chủ TK, loại TK, CCCD / MST, SĐT, đồng ý → OTP → thành công; gửi lại
// mã; MB chưa mở; huỷ đăng ký cần CCCD + SĐT + OTP. Không có ô khoá ngân hàng nào.
// ----------------------------------------------------------------------

const getBankLinkBanks = vi.fn();
const getBankLinks = vi.fn();
const registerBankLink = vi.fn();
const confirmBankLink = vi.fn();
const revokeBankLink = vi.fn();
const cancelBankLinkRevoke = vi.fn();
vi.mock('src/api/payment-settings', () => ({
  getBankLinkBanks: (...args: any[]) => getBankLinkBanks(...args),
  getBankLinks: (...args: any[]) => getBankLinks(...args),
  registerBankLink: (...args: any[]) => registerBankLink(...args),
  confirmBankLink: (...args: any[]) => confirmBankLink(...args),
  revokeBankLink: (...args: any[]) => revokeBankLink(...args),
  cancelBankLinkRevoke: (...args: any[]) => cancelBankLinkRevoke(...args),
}));

const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => snackbar }));
vi.mock('src/components/iconify', () => ({ default: () => null }));

// Imported after the mocks above.
import BankLinkCard from '../bank-link-card';
import BankLinkRegisterDialog from '../bank-link-register-dialog';
import {
  identityError,
  sortBankLinks,
  formatCountdown,
  registerFormErrors,
  resendSecondsLeft,
  EMPTY_REGISTER_FORM,
} from '../utils';

const BANKS: IBankLinkBank[] = [
  {
    code: 'vietinbank',
    bin: '970415',
    name: 'VietinBank',
    available: true,
    accountTypes: ['individual', 'household', 'business'],
    consent: 'Tôi đồng ý để VietinBank cung cấp thông tin giao dịch của tài khoản cho SPARK.',
  },
  {
    code: 'mbbank',
    bin: '970422',
    name: 'MB',
    available: false,
    unavailableReason: 'MB chưa cấp quyền API đăng ký nhận biến động số dư (101/104) cho SPARK',
    accountTypes: ['individual', 'household', 'business'],
    consent: 'Tôi đồng ý để MB cung cấp thông tin giao dịch.',
  },
];

const link = (over: Partial<IBankLink> = {}): IBankLink => ({
  id: 'l-1',
  bank: 'vietinbank',
  bin: '970415',
  bankName: 'VietinBank',
  accountNumber: '103885549137',
  accountName: 'HO KINH DOANH CICI',
  accountType: 'household',
  status: 'otp_required',
  maskedMobile: '037*****15',
  otpSentAt: new Date().toISOString(),
  createdAt: '2026-10-21T08:00:00Z',
  ...over,
});

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

async function pick(user: ReturnType<typeof userEvent.setup>, label: string, option: RegExp) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('utils', () => {
  it('kiểm CCCD cho cá nhân, MST / ĐKKD cho hộ kinh doanh', () => {
    expect(identityError('individual', '0012 0300 4567')).toBeUndefined();
    expect(identityError('individual', '12345')).toBeDefined();
    expect(identityError('household', '0109876543-001')).toBeUndefined();
    expect(identityError('household', '')).toMatch(/Mã số thuế/i);
  });

  it('form thiếu thì báo từng ô, không nhắc lại giá trị', () => {
    const errors = registerFormErrors({ ...EMPTY_REGISTER_FORM, mobile: '09123' });
    expect(Object.keys(errors).sort()).toEqual(
      ['accountName', 'accountNumber', 'accountType', 'bank', 'identity', 'mobile'].sort()
    );
    expect(errors.mobile).not.toContain('09123');
  });

  it('đếm ngược gửi lại OTP 2 phút', () => {
    const sent = '2026-10-21T08:00:00Z';
    expect(resendSecondsLeft(sent, Date.parse(sent) + 30_000)).toBe(90);
    expect(resendSecondsLeft(sent, Date.parse(sent) + 200_000)).toBe(0);
    expect(formatCountdown(90)).toBe('1:30');
  });

  it('đã báo có lên trước', () => {
    const sorted = sortBankLinks([
      link({ id: 'a', status: 'otp_required' }),
      link({ id: 'b', status: 'active' }),
      link({ id: 'c', status: 'revoking' }),
    ]);
    expect(sorted.map((l) => l.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('BankLinkRegisterDialog', { timeout: 20000 }, () => {
  it('đăng ký đã chuẩn hoá → OTP → thành công, không có ô khoá ngân hàng', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    getBankLinkBanks.mockResolvedValue(BANKS);
    registerBankLink.mockResolvedValue(link());
    confirmBankLink.mockResolvedValue(
      link({ status: 'active', coreBankAccount: { id: 'acc-1', created: true, isDefault: false } })
    );

    wrap(<BankLinkRegisterDialog open onClose={vi.fn()} onChanged={onChanged} />);

    await waitFor(() => expect(getBankLinkBanks).toHaveBeenCalled());
    expect(screen.queryByLabelText(/Client ID|secret|Provider ID|\.pfx/i)).toBeNull();
    await pick(user, 'Ngân hàng', /VietinBank/);
    await user.type(screen.getByLabelText('Số tài khoản'), '1038 8554 9137');
    await user.type(screen.getByLabelText('Chủ tài khoản'), 'Hộ kinh doanh CiCi');
    await pick(user, 'Loại tài khoản', /Hộ kinh doanh/);
    await user.type(screen.getByLabelText('Mã số thuế / Số ĐKKD'), '0109876543');
    await user.type(screen.getByLabelText('Số điện thoại'), '+84 372 812 115');

    const submit = screen.getByRole('button', { name: 'Đăng ký' });
    expect(submit).toBeDisabled(); // chưa tick đồng ý
    expect(screen.getByText(/VietinBank cung cấp thông tin giao dịch/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    await user.click(submit);

    await waitFor(() =>
      expect(registerBankLink).toHaveBeenCalledWith({
        bank: 'vietinbank',
        accountNumber: '103885549137',
        accountName: 'HO KINH DOANH CICI',
        accountType: 'household',
        identity: '0109876543',
        mobile: '0372812115',
        policyAgree: true,
      })
    );
    expect(await screen.findByText(/037\*\*\*\*\*15/)).toBeInTheDocument();
    // Vừa gửi mã: chưa cho gửi lại.
    expect(screen.getByRole('button', { name: /Gửi lại mã \(/ })).toBeDisabled();

    await user.type(screen.getByLabelText('Mã OTP'), '246810');
    await user.click(screen.getByRole('button', { name: 'Xác nhận' }));

    await waitFor(() => expect(confirmBankLink).toHaveBeenCalledWith('l-1', '246810'));
    expect(await screen.findByText(/Đăng ký dịch vụ thành công/)).toBeInTheDocument();
    expect(screen.getByText(/Đã thêm vào Tài khoản ngân hàng/)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  it('gửi lại mã sau khi hết đếm ngược = đăng ký lại cùng thông tin', async () => {
    const user = userEvent.setup();
    getBankLinkBanks.mockResolvedValue(BANKS);
    registerBankLink.mockResolvedValue(link({ otpSentAt: '2020-01-01T00:00:00Z' }));

    wrap(
      <BankLinkRegisterDialog
        open
        preset={{
          bank: 'vietinbank',
          accountNumber: '103885549137',
          accountName: 'HO KINH DOANH CICI',
        }}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />
    );
    await waitFor(() => expect(getBankLinkBanks).toHaveBeenCalled());
    expect(screen.getByLabelText('Số tài khoản')).toHaveValue('103885549137');
    await pick(user, 'Loại tài khoản', /Cá nhân/);
    await user.type(screen.getByLabelText('Số CCCD / CMND / Hộ chiếu'), '001203004567');
    await user.type(screen.getByLabelText('Số điện thoại'), '0372812115');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));

    await user.click(await screen.findByRole('button', { name: 'Gửi lại mã' }));
    await waitFor(() => expect(registerBankLink).toHaveBeenCalledTimes(2));
    expect(registerBankLink.mock.calls[1][0]).toEqual(registerBankLink.mock.calls[0][0]);
  });

  it('ngân hàng chưa mở thì không gửi được, lỗi ngân hàng hiện ra', async () => {
    const user = userEvent.setup();
    getBankLinkBanks.mockResolvedValue(BANKS);

    wrap(
      <BankLinkRegisterDialog
        open
        preset={{ bank: 'mbbank' }}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />
    );
    expect(await screen.findByText(/MB chưa cấp quyền/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByRole('button', { name: 'Đăng ký' })).toBeDisabled();

    registerBankLink.mockRejectedValue({ title: 'VietinBank: So dien thoai khong khop' });
    await pick(user, 'Ngân hàng', /VietinBank/);
    await user.type(screen.getByLabelText('Số tài khoản'), '103885549137');
    await user.type(screen.getByLabelText('Chủ tài khoản'), 'CICI');
    await pick(user, 'Loại tài khoản', /Cá nhân/);
    await user.type(screen.getByLabelText('Số CCCD / CMND / Hộ chiếu'), '001203004567');
    await user.type(screen.getByLabelText('Số điện thoại'), '0372812115');
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }));
    await waitFor(() => expect(registerBankLink).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Đăng ký' })).toBeInTheDocument(); // vẫn ở form
  });
});

describe('BankLinkCard', { timeout: 20000 }, () => {
  it('thẻ tài khoản đã báo có, huỷ cần CCCD + SĐT rồi OTP', async () => {
    const user = userEvent.setup();
    getBankLinks.mockResolvedValue([link({ status: 'active' })]);
    getBankLinkBanks.mockResolvedValue(BANKS);
    revokeBankLink.mockResolvedValue(link({ status: 'revoking' }));
    confirmBankLink.mockResolvedValue(link({ status: 'revoked' }));

    wrap(<BankLinkCard />);

    expect(await screen.findByText('Đã báo có')).toBeInTheDocument();
    expect(screen.getByText('103885549137')).toBeInTheDocument();
    expect(screen.getByText(/MB chưa cấp quyền/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Huỷ đăng ký' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Gửi yêu cầu huỷ' }));
    expect(revokeBankLink).not.toHaveBeenCalled(); // chưa nhập MST / SĐT
    await user.type(within(dialog).getByLabelText('Mã số thuế / Số ĐKKD'), '0109876543');
    await user.type(within(dialog).getByLabelText('Số điện thoại'), '0372812115');
    await user.click(within(dialog).getByRole('button', { name: 'Gửi yêu cầu huỷ' }));

    await waitFor(() =>
      expect(revokeBankLink).toHaveBeenCalledWith('l-1', {
        identity: '0109876543',
        mobile: '0372812115',
      })
    );
    await user.type(await within(dialog).findByLabelText('Mã OTP'), '135790');
    await user.click(within(dialog).getByRole('button', { name: 'Xác nhận huỷ' }));
    await waitFor(() => expect(confirmBankLink).toHaveBeenCalledWith('l-1', '135790'));
    expect(await within(dialog).findByText(/Đã huỷ báo có/)).toBeInTheDocument();
  });
});
