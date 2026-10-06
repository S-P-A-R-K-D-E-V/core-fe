import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IStoreBranding } from 'src/api/store-settings';

// ----------------------------------------------------------------------
// Cài đặt cửa hàng → Thông tin cửa hàng: ba ô của phiếu thanh toán (Số điện thoại, Mã số thuế, Lời chào
// cuối hoá đơn) lưu qua PUT /store-settings/branding sẵn có. Core-be cũ không trả và bỏ qua ba field
// này — các ô cũ vẫn phải lưu bình thường.
// ----------------------------------------------------------------------

const getStoreBranding = vi.fn();
const saveStoreBranding = vi.fn();
const uploadStoreLogo = vi.fn();
vi.mock('src/api/store-settings', () => ({
  getStoreBranding: (...args: any[]) => getStoreBranding(...args),
  saveStoreBranding: (...args: any[]) => saveStoreBranding(...args),
  uploadStoreLogo: (...args: any[]) => uploadStoreLogo(...args),
}));

// Trả về CÙNG một đối tượng mỗi lần render: effect tải dữ liệu phụ thuộc enqueueSnackbar.
const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => snackbar,
}));

// Imported after the mocks above so the tab picks up the mocked modules.
import StoreBrandingTab from '../store-branding-tab';

// Đúng tám field mà core-be cũ trả về
const OLDER_FIELDS = {
  storeName: 'CiCi Accessories',
  logoUrl: null,
  primaryColor: '#D81B60',
  shortDescription: 'Phụ kiện thời trang',
  address: '12 Nguyễn Trãi, Quận 1',
  messengerLink: null,
  zaloLink: 'https://zalo.me/0901234567',
  contactInfoJson: null,
} satisfies IStoreBranding;

const renderTab = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <StoreBrandingTab />
    </ThemeProvider>
  );

const phoneInput = () => screen.getByRole('textbox', { name: 'Số điện thoại' });
const taxInput = () => screen.getByRole('textbox', { name: 'Mã số thuế' });
const footerInput = () => screen.getByRole('textbox', { name: 'Lời chào cuối hoá đơn' });
const saveButton = () => screen.getByRole('button', { name: 'Lưu thay đổi' });

/** Chờ form tải xong (các ô hết bị khoá). */
const loaded = () => waitFor(() => expect(phoneInput()).toBeEnabled());

afterEach(() => {
  vi.clearAllMocks();
});

describe('StoreBrandingTab — thông tin in trên phiếu thanh toán', () => {
  it('hiện ba ô với giá trị đang lưu và giới hạn độ dài của core-be (50 / 20 / 200 ký tự)', async () => {
    getStoreBranding.mockResolvedValue({
      ...OLDER_FIELDS,
      phone: '0901 234 567',
      taxCode: '0312345678',
      receiptFooter: 'Cảm ơn quý khách!',
    });
    renderTab();
    await loaded();

    expect(phoneInput()).toHaveValue('0901 234 567');
    expect(phoneInput()).toHaveAttribute('maxlength', '50');
    expect(taxInput()).toHaveValue('0312345678');
    expect(taxInput()).toHaveAttribute('maxlength', '20');
    expect(footerInput()).toHaveValue('Cảm ơn quý khách!');
    expect(footerInput()).toHaveAttribute('maxlength', '200');
    expect(screen.getByText('17/200 ký tự')).toBeInTheDocument();
    // các ô cũ vẫn như trước
    expect(screen.getByRole('textbox', { name: 'Tên cửa hàng' })).toHaveValue('CiCi Accessories');
    expect(screen.getByRole('textbox', { name: 'Địa chỉ' })).toHaveValue('12 Nguyễn Trãi, Quận 1');
  });

  it('nhập ba ô rồi lưu: gửi đủ tám field cũ và ba field mới trong cùng một PUT', async () => {
    const user = userEvent.setup({ delay: null });
    getStoreBranding.mockResolvedValue({
      ...OLDER_FIELDS,
      phone: null,
      taxCode: null,
      receiptFooter: null,
    });
    saveStoreBranding.mockResolvedValue(undefined);
    renderTab();
    await loaded();

    await user.type(phoneInput(), '0901 234 567');
    await user.type(taxInput(), '0312345678');
    await user.type(footerInput(), 'Cảm ơn quý khách, hẹn gặp lại!');
    await user.click(saveButton());

    await waitFor(() => expect(saveStoreBranding).toHaveBeenCalledTimes(1));
    expect(saveStoreBranding).toHaveBeenCalledWith({
      ...OLDER_FIELDS,
      phone: '0901 234 567',
      taxCode: '0312345678',
      receiptFooter: 'Cảm ơn quý khách, hẹn gặp lại!',
    });
    expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith('Đã lưu thông tin cửa hàng');
  });

  it('xoá trắng một ô đang có giá trị: gửi null để core-be xoá (không bỏ key)', async () => {
    const user = userEvent.setup({ delay: null });
    getStoreBranding.mockResolvedValue({
      ...OLDER_FIELDS,
      phone: '0901 234 567',
      taxCode: '0312345678',
      receiptFooter: 'Cảm ơn quý khách!',
    });
    saveStoreBranding.mockResolvedValue(undefined);
    renderTab();
    await loaded();

    await user.clear(taxInput());
    await user.click(saveButton());

    await waitFor(() => expect(saveStoreBranding).toHaveBeenCalledTimes(1));
    const sent = saveStoreBranding.mock.calls[0][0];
    expect(sent).toHaveProperty('taxCode', null);
    expect(sent.phone).toBe('0901 234 567');
    expect(sent.receiptFooter).toBe('Cảm ơn quý khách!');
  });

  it('core-be cũ (không trả ba field): ba ô trống, các ô cũ vẫn lưu được với đúng giá trị', async () => {
    const user = userEvent.setup({ delay: null });
    getStoreBranding.mockResolvedValue({ ...OLDER_FIELDS });
    saveStoreBranding.mockResolvedValue(undefined);
    renderTab();
    await loaded();

    expect(phoneInput()).toHaveValue('');
    expect(taxInput()).toHaveValue('');
    expect(footerInput()).toHaveValue('');

    const name = screen.getByRole('textbox', { name: 'Tên cửa hàng' });
    await user.clear(name);
    await user.type(name, 'CiCi Quận 1');
    await user.click(saveButton());

    await waitFor(() => expect(saveStoreBranding).toHaveBeenCalledTimes(1));
    const sent = saveStoreBranding.mock.calls[0][0];
    // tám field cũ được gửi đủ như trước (ghi đè toàn bộ)
    expect(sent).toMatchObject({ ...OLDER_FIELDS, storeName: 'CiCi Quận 1' });
    Object.keys(OLDER_FIELDS).forEach((key) => expect(sent).toHaveProperty(key));
    // ba field mới chỉ là key thừa với core-be cũ
    expect(sent.phone).toBeNull();
    expect(sent.taxCode).toBeNull();
    expect(sent.receiptFooter).toBeNull();
  });

  it('không tải được dữ liệu: không gửi ba field mới (để core-be giữ giá trị đang lưu) trừ khi đã nhập', async () => {
    const user = userEvent.setup({ delay: null });
    getStoreBranding.mockRejectedValue({ title: 'Lỗi máy chủ' });
    saveStoreBranding.mockResolvedValue(undefined);
    renderTab();
    await loaded();
    expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith('Lỗi máy chủ', { variant: 'error' });

    await user.type(screen.getByRole('textbox', { name: 'Tên cửa hàng' }), 'CiCi');
    await user.click(saveButton());

    await waitFor(() => expect(saveStoreBranding).toHaveBeenCalledTimes(1));
    const first = saveStoreBranding.mock.calls[0][0];
    expect(first.storeName).toBe('CiCi');
    expect(first).not.toHaveProperty('phone');
    expect(first).not.toHaveProperty('taxCode');
    expect(first).not.toHaveProperty('receiptFooter');

    await user.type(phoneInput(), '0901234567');
    await user.click(saveButton());

    await waitFor(() => expect(saveStoreBranding).toHaveBeenCalledTimes(2));
    expect(saveStoreBranding.mock.calls[1][0]).toMatchObject({
      phone: '0901234567',
      taxCode: null,
      receiptFooter: null,
    });
  });

  it('core-be từ chối (400): hiện đúng câu lỗi của field', async () => {
    const user = userEvent.setup({ delay: null });
    getStoreBranding.mockResolvedValue({
      ...OLDER_FIELDS,
      phone: null,
      taxCode: null,
      receiptFooter: null,
    });
    saveStoreBranding.mockRejectedValue({
      title: 'Mã số thuế tối đa 20 ký tự.',
      detail: 'Mã số thuế tối đa 20 ký tự.',
      status: 400,
      errors: { TaxCode: ['Mã số thuế tối đa 20 ký tự.'] },
    });
    renderTab();
    await loaded();

    await user.click(saveButton());

    await waitFor(() =>
      expect(snackbar.enqueueSnackbar).toHaveBeenCalledWith('Mã số thuế tối đa 20 ký tự.', {
        variant: 'error',
      })
    );
  });
});
