import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type {
  IApiPayLinkResult,
  IPaymentConnection,
  IApiPayBanksResponse,
} from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Liên kết ngân hàng qua ApiPay: form → OTP → số VA + tài khoản cho POS; kích hoạt thủ công; lỗi ApiPay; thẻ danh sách
// tài khoản đã liên kết (Dùng tài khoản này, tự gắn khi kích hoạt xong).
// ----------------------------------------------------------------------

const getApiPayAvailableBanks = vi.fn();
const getApiPayLinkedBanks = vi.fn();
const linkApiPayBank = vi.fn();
const confirmApiPayBankOtp = vi.fn();
const selectApiPayBank = vi.fn();
vi.mock('src/api/payment-settings', () => ({
  getApiPayAvailableBanks: (...args: any[]) => getApiPayAvailableBanks(...args),
  getApiPayLinkedBanks: (...args: any[]) => getApiPayLinkedBanks(...args),
  linkApiPayBank: (...args: any[]) => linkApiPayBank(...args),
  confirmApiPayBankOtp: (...args: any[]) => confirmApiPayBankOtp(...args),
  selectApiPayBank: (...args: any[]) => selectApiPayBank(...args),
}));

const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => snackbar,
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

// Imported after the mocks above.
import ApiPayBankLinkCard from '../apipay-bank-link-card';
import ApiPayBankLinkDialog from '../apipay-bank-link-dialog';

const CONNECTION: IPaymentConnection = {
  id: 'c-apipay',
  provider: 'apipay',
  kind: 'bank_feed',
  displayName: 'ApiPay cửa hàng',
  status: 'active',
  webhookUrl: 'https://pay/webhooks/apipay/tok',
  createdAt: '2026-10-15T00:00:00Z',
  publicSettings: { environment: 'test' },
};

const BANKS = [
  { bin: '970422', code: 'MBB', name: 'MB Bank', shortName: 'MBB' },
  { bin: '970416', code: 'ACB', name: 'ACB', shortName: 'ACB' },
  { bin: '970423', code: 'TPB', name: 'TPBank', shortName: 'TPB' },
];

const ACTIVE: IApiPayLinkResult = {
  status: 'active',
  message: 'Xác nhận ngân hàng thành công',
  publicId: 'bnk_1',
  vaNumber: 'DAT001',
  connection: {
    ...CONNECTION,
    bankAccount: { bin: '970422', accountNumber: 'DAT001', accountName: 'PHAM THANH DAT' },
  },
  applied: {
    publicId: 'bnk_1',
    bin: '970422',
    bankName: 'MB Bank',
    bankShortName: 'MBB',
    accountNumber: 'DAT001',
    accountName: 'PHAM THANH DAT',
    originalAccountNumber: '24550721',
    virtualAccount: true,
  },
  coreBankAccount: { id: 'acc-1', created: true, isDefault: true },
};

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

async function pick(user: ReturnType<typeof userEvent.setup>, label: string, option: RegExp) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
}

afterEach(() => {
  vi.clearAllMocks();
});

// Nhiều thao tác gõ / chọn: ~2–3 s một test, cho rộng khi cả bộ test chạy song song.
describe('ApiPayBankLinkDialog', { timeout: 20000 }, () => {
  it('gửi liên kết đã chuẩn hoá → OTP → hiện số VA và tài khoản đã thêm cho POS', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    getApiPayAvailableBanks.mockResolvedValue(BANKS);
    linkApiPayBank.mockResolvedValue({
      status: 'otp_required',
      message: 'Vui lòng nhập mã OTP để hoàn tất liên kết tài khoản ngân hàng',
      publicId: 'bnk_1',
      connection: CONNECTION,
    });
    confirmApiPayBankOtp.mockResolvedValue(ACTIVE);

    wrap(
      <ApiPayBankLinkDialog open connection={CONNECTION} onClose={vi.fn()} onChanged={onChanged} />
    );

    await waitFor(() => expect(getApiPayAvailableBanks).toHaveBeenCalledWith('c-apipay'));
    await pick(user, 'Ngân hàng', /MB Bank/);
    await pick(user, 'Loại tài khoản', /Cá nhân/);
    await user.type(screen.getByLabelText('Số tài khoản'), '2455 0721');
    await user.type(screen.getByLabelText('Tên chủ tài khoản'), 'Phạm Thanh Đạt');
    expect(screen.getByText('Gửi ApiPay: PHAM THANH DAT')).toBeInTheDocument();
    await user.type(screen.getByLabelText('SĐT đăng ký với ngân hàng'), '+84 858 838 502');
    await user.type(screen.getByLabelText(/Số CCCD/), '012345678901');

    const submit = screen.getByRole('button', { name: 'Gửi liên kết' });
    expect(submit).toBeDisabled(); // chưa đồng ý gửi thông tin cho ApiPay
    await user.click(screen.getByRole('checkbox'));
    await user.click(submit);

    await waitFor(() =>
      expect(linkApiPayBank).toHaveBeenCalledWith('c-apipay', {
        bankBin: '970422',
        bankName: 'MB Bank',
        accountType: 'personal-account',
        accountNumber: '24550721',
        accountName: 'PHAM THANH DAT',
        mobile: '0858838502',
        identity: '012345678901',
      })
    );

    expect(await screen.findByText(/Vui lòng nhập mã OTP/)).toBeInTheDocument();
    expect(onChanged).not.toHaveBeenCalled();

    // Gửi xong thì SĐT / CCCD bị xoá khỏi form: quay lại phải nhập lại, các ô khác giữ nguyên.
    await user.click(screen.getByRole('button', { name: 'Nhập lại thông tin' }));
    expect(screen.getByLabelText('SĐT đăng ký với ngân hàng')).toHaveValue('');
    expect(screen.getByLabelText(/Số CCCD/)).toHaveValue('');
    expect(screen.getByLabelText('Số tài khoản')).toHaveValue('2455 0721');
    await user.type(screen.getByLabelText('SĐT đăng ký với ngân hàng'), '0858838502');
    await user.type(screen.getByLabelText(/Số CCCD/), '012345678901');
    await user.click(screen.getByRole('button', { name: 'Gửi liên kết' }));
    expect(await screen.findByText(/Vui lòng nhập mã OTP/)).toBeInTheDocument();
    expect(linkApiPayBank).toHaveBeenCalledTimes(2);

    const confirm = screen.getByRole('button', { name: 'Xác nhận OTP' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText('Mã OTP'), '12a3456');
    expect(screen.getByLabelText('Mã OTP')).toHaveValue('123456');
    await user.click(confirm);

    await waitFor(() =>
      expect(confirmApiPayBankOtp).toHaveBeenCalledWith('c-apipay', {
        bankBin: '970422',
        accountNumber: '24550721',
        otp: '123456',
      })
    );
    expect(await screen.findByText('DAT001')).toBeInTheDocument();
    expect(screen.getByText(/Tài khoản ảo \(VA\) ApiPay của TK 24550721/)).toBeInTheDocument();
    expect(screen.getByText(/Đã thêm vào Tài khoản ngân hàng.*mặc định/)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('ACB cá nhân không hỏi CCCD; kích hoạt thủ công báo chờ ApiPay; lỗi ApiPay hiện trong hộp thoại', async () => {
    const user = userEvent.setup();
    getApiPayAvailableBanks.mockResolvedValue(BANKS);
    linkApiPayBank.mockRejectedValueOnce({
      title: 'ApiPay: Số điện thoại *** không khớp',
      status: 400,
    });
    linkApiPayBank.mockResolvedValueOnce({
      status: 'pending_activation',
      message:
        'Tài khoản đã được kết nối và đang chờ xác minh. Quá trình kích hoạt có thể mất đến 24 giờ.',
      publicId: 'bnk_tp',
      connection: CONNECTION,
    });

    wrap(
      <ApiPayBankLinkDialog open connection={CONNECTION} onClose={vi.fn()} onChanged={vi.fn()} />
    );

    await waitFor(() => expect(getApiPayAvailableBanks).toHaveBeenCalled());
    await pick(user, 'Ngân hàng', /ACB/);
    await pick(user, 'Loại tài khoản', /Cá nhân/);
    expect(screen.queryByRole('textbox', { name: /CCCD|Mã số thuế/ })).not.toBeInTheDocument();
    await pick(user, 'Loại tài khoản', /Hộ kinh doanh/);
    expect(screen.getByLabelText('Tên đăng nhập ACB OneBiz')).toBeInTheDocument();

    await pick(user, 'Ngân hàng', /TPBank/);
    await pick(user, 'Loại tài khoản', /Cá nhân/);
    expect(screen.getByText(/kích hoạt thủ công/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Số tài khoản'), '00012345678');
    await user.type(screen.getByLabelText('Tên chủ tài khoản'), 'NGUYEN VAN A');
    await user.type(screen.getByLabelText('SĐT đăng ký với ngân hàng'), '0858838502');
    await user.type(screen.getByLabelText(/Số CCCD/), '012345678901');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Gửi liên kết' }));

    expect(await screen.findByText('ApiPay: Số điện thoại *** không khớp')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Gửi liên kết' }));
    expect(await screen.findByText(/mất đến 24 giờ/)).toBeInTheDocument();
    expect(screen.getByText(/Kiểm tra lại/)).toBeInTheDocument();
  });

  it('thiếu thông tin thì báo từng ô, không gọi máy chủ', async () => {
    const user = userEvent.setup();
    getApiPayAvailableBanks.mockResolvedValue(BANKS);
    wrap(
      <ApiPayBankLinkDialog open connection={CONNECTION} onClose={vi.fn()} onChanged={vi.fn()} />
    );

    await waitFor(() => expect(getApiPayAvailableBanks).toHaveBeenCalled());
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Gửi liên kết' }));

    expect(screen.getByText('Chọn ngân hàng')).toBeInTheDocument();
    expect(screen.getByText('Nhập tên chủ tài khoản')).toBeInTheDocument();
    expect(linkApiPayBank).not.toHaveBeenCalled();
  });
});

describe('ApiPayBankLinkCard', () => {
  const listed = (over: Partial<IApiPayBanksResponse> = {}): IApiPayBanksResponse => ({
    banks: [
      {
        publicId: 'bnk_1',
        bankName: 'MB Bank',
        bankShortName: 'MBB',
        accountNumber: '24550721',
        accountName: 'PHAM THANH DAT',
        vaNumber: 'DAT001',
        status: 'active',
        manualActivationPending: false,
        inUse: false,
        pending: false,
      },
      {
        publicId: 'bnk_tp',
        bankName: 'TPBank',
        accountNumber: '00012345678',
        status: 'pending',
        manualActivationPending: true,
        inUse: false,
        pending: true,
      },
    ],
    connection: CONNECTION,
    ...over,
  });

  it('liệt kê tài khoản đã liên kết và dùng một tài khoản làm tài khoản nhận', async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    getApiPayLinkedBanks.mockResolvedValue(listed());
    selectApiPayBank.mockResolvedValue(ACTIVE);

    wrap(
      <ApiPayBankLinkCard
        connections={[CONNECTION, { ...CONNECTION, id: 'c-sepay', provider: 'sepay' }]}
        onChanged={onChanged}
      />
    );

    expect(await screen.findByText(/MB Bank · 24550721/)).toBeInTheDocument();
    expect(screen.getByText('Số VA in trên QR: DAT001 · PHAM THANH DAT')).toBeInTheDocument();
    expect(screen.getByText('Chờ ApiPay kích hoạt')).toBeInTheDocument();
    expect(screen.getByText('Tự gắn khi kích hoạt xong')).toBeInTheDocument();
    expect(screen.getByText(/ApiPay cửa hàng \(thử nghiệm\)/)).toBeInTheDocument();
    expect(getApiPayLinkedBanks).toHaveBeenCalledWith('c-apipay');

    const buttons = screen.getAllByRole('button', { name: 'Dùng tài khoản này' });
    expect(buttons).toHaveLength(1); // chỉ tài khoản đang hoạt động
    await user.click(buttons[0]);

    await waitFor(() => expect(selectApiPayBank).toHaveBeenCalledWith('c-apipay', 'bnk_1'));
    expect(onChanged).toHaveBeenCalled();
    expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith(
      expect.stringMatching(/DAT001.*Đã thêm vào Tài khoản ngân hàng/)
    );
  });

  it('tài khoản chờ kích hoạt đã xong → báo đã gắn và nơi gọi tải lại', async () => {
    const onChanged = vi.fn();
    getApiPayLinkedBanks.mockResolvedValue(
      listed({
        applied: ACTIVE.applied,
        coreBankAccount: { id: 'acc-1', created: true, isDefault: false },
      })
    );

    wrap(<ApiPayBankLinkCard connections={[CONNECTION]} onChanged={onChanged} />);

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith(
      expect.stringMatching(/DAT001 đã kích hoạt.*Đã thêm vào Tài khoản ngân hàng/)
    );
  });

  it('không có kết nối ApiPay: hướng dẫn ở tab Thanh toán, ẩn ở tab Tài khoản ngân hàng', () => {
    const { container, unmount } = wrap(
      <ApiPayBankLinkCard
        connections={[{ ...CONNECTION, provider: 'sepay' }]}
        hideWhenEmpty
        onChanged={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
    unmount();

    wrap(<ApiPayBankLinkCard connections={[]} onChanged={vi.fn()} />);
    expect(screen.getByText(/Chưa có kết nối ApiPay/)).toBeInTheDocument();
    expect(
      within(document.body).queryByRole('button', { name: 'Liên kết tài khoản mới' })
    ).not.toBeInTheDocument();
    expect(getApiPayLinkedBanks).not.toHaveBeenCalled();
  });
});
