import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { ISalesOrderReceipt, IKiotVietBankAccount } from 'src/types/corecms-api';

import { ORDER_ID, normalReceipt, cancelledReceipt, transferQrReceipt } from './receipt-fixtures';

// ----------------------------------------------------------------------
// Hộp thoại "In hoá đơn": tải phiếu, xem trước đúng tài liệu sẽ in, chọn khổ giấy 80 / 58 mm (nhớ theo
// trình duyệt), chọn tài khoản nhận cho mã QR khi core-be chưa xác định được, báo rõ khi core-be cũ
// chưa hỗ trợ.
// ----------------------------------------------------------------------

const getSalesOrderReceipt = vi.fn();
vi.mock('src/api/sales-orders', () => ({
  getSalesOrderReceipt: (...args: any[]) => getSalesOrderReceipt(...args),
}));

const getBankAccounts = vi.fn();
vi.mock('src/api/bank-accounts', () => ({
  getBankAccounts: (...args: any[]) => getBankAccounts(...args),
}));

const printHtmlDocument = vi.fn((_html: string) => Promise.resolve());
vi.mock('src/utils/print-html', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/utils/print-html')>()),
  printHtmlDocument: (html: string) => printHtmlDocument(html),
}));

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar }),
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

// Imported after the mocks above so the dialog picks up the mocked modules.
import ReceiptPrintDialog from '../receipt-print-dialog';
import { RECEIPT_SETTINGS_STORAGE_KEY } from '../receipt-settings';

const VCB: IKiotVietBankAccount = {
  id: 'acc-vcb',
  shortName: 'Vietcombank',
  bin: '970436',
  accountNumber: '0123456789',
  description: 'Tài khoản cửa hàng',
};
const TCB: IKiotVietBankAccount = {
  id: 'acc-tcb',
  shortName: 'Techcombank',
  bin: '970407',
  accountNumber: '19001234567',
};
// Thiếu BIN → không tạo được VietQR, không được đưa ra cho chọn
const NO_BIN: IKiotVietBankAccount = {
  id: 'acc-cash',
  shortName: 'Quỹ khác',
  accountNumber: '555',
};

/** Hoá đơn còn 50.000đ nhưng core-be chưa xác định được tài khoản nhận. */
const unpaidWithoutQr = (): ISalesOrderReceipt => ({ ...transferQrReceipt(), transferQr: null });

function renderDialog(props: { open?: boolean; orderId?: string | null } = {}) {
  const onClose = vi.fn();
  const view = render(
    <ThemeProvider theme={createTheme()}>
      <ReceiptPrintDialog
        open={props.open ?? true}
        onClose={onClose}
        orderId={props.orderId ?? ORDER_ID}
      />
    </ThemeProvider>
  );
  return { onClose, ...view };
}

const PREVIEW = 'Xem trước phiếu thanh toán';

async function previewHtml() {
  const frame = await screen.findByTitle(PREVIEW);
  return frame.getAttribute('srcdoc') ?? '';
}

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

const printButton = () => screen.getByRole('button', { name: 'In hoá đơn' });

const savedSettings = () =>
  JSON.parse(window.localStorage.getItem(RECEIPT_SETTINGS_STORAGE_KEY) as string);

async function choose(user: ReturnType<typeof userEvent.setup>, field: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
}

const ACCOUNT_FIELD = 'Tài khoản nhận chuyển khoản';

beforeEach(() => {
  window.localStorage.clear();
  getSalesOrderReceipt.mockResolvedValue(normalReceipt());
  getBankAccounts.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('ReceiptPrintDialog', () => {
  it('đóng thì không tải gì; mở thì tải phiếu của đúng hoá đơn và hiện xem trước', async () => {
    const closed = renderDialog({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getSalesOrderReceipt).not.toHaveBeenCalled();
    closed.unmount();

    renderDialog();

    expect(
      screen.getByRole('progressbar', { name: 'Đang tải phiếu thanh toán' })
    ).toBeInTheDocument();
    expect(printButton()).toBeDisabled();

    const html = await previewHtml();
    expect(getSalesOrderReceipt).toHaveBeenCalledTimes(1);
    expect(getSalesOrderReceipt).toHaveBeenCalledWith(ORDER_ID);
    expect(
      screen.getByRole('heading', { name: /In hoá đơn HD-20261006-0001/ })
    ).toBeInTheDocument();

    const doc = parse(html);
    expect(doc.querySelector('.tl')?.textContent).toBe('PHIẾU THANH TOÁN');
    expect(doc.querySelectorAll('.it')).toHaveLength(2);
    expect(html).toContain('@page{size:80mm ');
    // hoá đơn đã trả đủ → không hỏi tài khoản, không gọi danh sách tài khoản
    expect(getBankAccounts).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: ACCOUNT_FIELD })).not.toBeInTheDocument();
  });

  it('không có id hoá đơn thì không mở', () => {
    render(
      <ThemeProvider theme={createTheme()}>
        <ReceiptPrintDialog open onClose={vi.fn()} orderId={null} />
      </ThemeProvider>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getSalesOrderReceipt).not.toHaveBeenCalled();
  });

  it('nút In nhận focus khi phiếu sẵn sàng và gửi ĐÚNG tài liệu đang xem trước vào lệnh in', async () => {
    const user = userEvent.setup({ delay: null });
    renderDialog();
    const html = await previewHtml();

    await waitFor(() => expect(printButton()).toHaveFocus());
    await user.keyboard('{Enter}');

    expect(printHtmlDocument).toHaveBeenCalledTimes(1);
    expect(printHtmlDocument).toHaveBeenCalledWith(html);
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it('khổ giấy mặc định 80 mm; chọn 58 mm thì xem trước / bản in đổi khổ và lựa chọn được nhớ', async () => {
    const user = userEvent.setup({ delay: null });
    const first = renderDialog();
    await previewHtml();

    expect(screen.getByRole('button', { name: '80 mm' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '58 mm' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Trang in 80 × \d+ mm/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '58 mm' }));

    const narrow = await previewHtml();
    expect(narrow).toContain('@page{size:58mm ');
    expect(narrow).toContain('.rc{width:48mm;');
    expect(screen.getByText(/Trang in 58 × \d+ mm/)).toBeInTheDocument();
    expect(savedSettings()).toEqual({ paperWidth: 58, bankAccountId: null });

    await user.click(printButton());
    expect(printHtmlDocument).toHaveBeenCalledWith(narrow);

    // bấm lại nút đang chọn không bỏ chọn khổ giấy
    await user.click(screen.getByRole('button', { name: '58 mm' }));
    expect(screen.getByRole('button', { name: '58 mm' })).toHaveAttribute('aria-pressed', 'true');

    // mở lại (cả ở hoá đơn khác): vẫn 58 mm
    first.unmount();
    renderDialog();
    expect(await previewHtml()).toContain('@page{size:58mm ');
    expect(screen.getByRole('button', { name: '58 mm' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('core-be cũ (404): báo "Máy chủ chưa hỗ trợ in hoá đơn", không in được; Thử lại tải lại phiếu', async () => {
    const user = userEvent.setup({ delay: null });
    getSalesOrderReceipt.mockRejectedValueOnce(new Error('Máy chủ chưa hỗ trợ in hoá đơn'));
    renderDialog();

    expect(await screen.findByRole('alert')).toHaveTextContent('Máy chủ chưa hỗ trợ in hoá đơn');
    expect(screen.queryByTitle(PREVIEW)).not.toBeInTheDocument();
    expect(printButton()).toBeDisabled();
    expect(printHtmlDocument).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await previewHtml()).toContain('HD-20261006-0001');
    expect(getSalesOrderReceipt).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(printButton()).toBeEnabled();
  });

  it('lỗi của core-be hiện đúng câu trong body; lỗi không có nội dung hiện câu chung', async () => {
    getSalesOrderReceipt.mockRejectedValueOnce({
      error: 'feature_disabled',
      message: 'Cửa hàng chưa bật tính năng bán hàng tại quầy.',
      featureKey: 'commerce.retail.pos',
    });
    const first = renderDialog();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cửa hàng chưa bật tính năng bán hàng tại quầy.'
    );
    first.unmount();

    getSalesOrderReceipt.mockRejectedValueOnce('Something went wrong');
    renderDialog();
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được phiếu thanh toán');
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
  });

  it('core-be đã tự chọn tài khoản nhận: in luôn mã QR, không hỏi tài khoản', async () => {
    getSalesOrderReceipt.mockResolvedValue(transferQrReceipt());
    renderDialog();

    const doc = parse(await previewHtml());
    expect(doc.querySelectorAll('svg.qc')).toHaveLength(1);
    expect(getBankAccounts).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: ACCOUNT_FIELD })).not.toBeInTheDocument();
  });

  it('còn tiền phải trả, chưa có mã QR, cửa hàng có nhiều tài khoản: cho chọn tài khoản rồi tải lại phiếu kèm bankAccountId', async () => {
    const user = userEvent.setup({ delay: null });
    getBankAccounts.mockResolvedValue([VCB, NO_BIN, TCB]);
    getSalesOrderReceipt.mockImplementation((_id: string, bankAccountId?: string) =>
      Promise.resolve(bankAccountId ? transferQrReceipt() : unpaidWithoutQr())
    );
    renderDialog();

    // chưa chọn: xem trước không có mã QR, vẫn in được
    expect(parse(await previewHtml()).querySelector('svg')).toBeNull();
    expect(getBankAccounts).toHaveBeenCalledTimes(1);
    expect(printButton()).toBeEnabled();
    expect(
      screen.getByText(
        /Hoá đơn còn 50\.000đ chưa trả — chọn tài khoản để in kèm mã QR chuyển khoản\./
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: ACCOUNT_FIELD }));
    const options = (await screen.findAllByRole('option')).map((option) => option.textContent);
    // tài khoản thiếu BIN không có trong danh sách
    expect(options).toEqual([
      'Không in mã QR',
      'Vietcombank - 0123456789 (Tài khoản cửa hàng)',
      'Techcombank - 19001234567',
    ]);
    await user.click(screen.getByRole('option', { name: 'Techcombank - 19001234567' }));

    await waitFor(() => expect(getSalesOrderReceipt).toHaveBeenLastCalledWith(ORDER_ID, 'acc-tcb'));
    await waitFor(async () =>
      expect(parse(await previewHtml()).querySelectorAll('svg.qc')).toHaveLength(1)
    );
    expect(savedSettings()).toEqual({ paperWidth: 80, bankAccountId: 'acc-tcb' });

    // bỏ chọn → về phiếu không có mã QR, không gọi lại core-be
    const callsBefore = getSalesOrderReceipt.mock.calls.length;
    await choose(user, ACCOUNT_FIELD, 'Không in mã QR');
    await waitFor(async () => expect(parse(await previewHtml()).querySelector('svg')).toBeNull());
    expect(getSalesOrderReceipt.mock.calls.length).toBe(callsBefore);
    expect(savedSettings()).toEqual({ paperWidth: 80, bankAccountId: null });
  });

  it('tài khoản đã chọn lần trước được dùng lại cho hoá đơn sau', async () => {
    window.localStorage.setItem(
      RECEIPT_SETTINGS_STORAGE_KEY,
      JSON.stringify({ paperWidth: 80, bankAccountId: 'acc-vcb' })
    );
    getBankAccounts.mockResolvedValue([VCB, TCB]);
    getSalesOrderReceipt.mockImplementation((_id: string, bankAccountId?: string) =>
      Promise.resolve(bankAccountId ? transferQrReceipt() : unpaidWithoutQr())
    );
    renderDialog();

    expect(parse(await previewHtml()).querySelectorAll('svg.qc')).toHaveLength(1);
    expect(getSalesOrderReceipt.mock.calls).toEqual([[ORDER_ID], [ORDER_ID, 'acc-vcb']]);
    expect(screen.getByRole('combobox', { name: ACCOUNT_FIELD })).toHaveTextContent(
      'Vietcombank - 0123456789 (Tài khoản cửa hàng)'
    );
  });

  it('tài khoản đã nhớ không còn trong danh sách thì không tự dùng', async () => {
    window.localStorage.setItem(
      RECEIPT_SETTINGS_STORAGE_KEY,
      JSON.stringify({ paperWidth: 80, bankAccountId: 'acc-da-xoa' })
    );
    getBankAccounts.mockResolvedValue([VCB, TCB]);
    getSalesOrderReceipt.mockResolvedValue(unpaidWithoutQr());
    renderDialog();

    expect(parse(await previewHtml()).querySelector('svg')).toBeNull();
    expect(getSalesOrderReceipt.mock.calls).toEqual([[ORDER_ID]]);
    expect(screen.getByRole('combobox', { name: ACCOUNT_FIELD })).toHaveTextContent(
      'Không in mã QR'
    );
  });

  it('core-be không tạo được mã QR cho tài khoản đã chọn: báo rõ, vẫn in phiếu không có mã', async () => {
    const user = userEvent.setup({ delay: null });
    getBankAccounts.mockResolvedValue([VCB, TCB]);
    getSalesOrderReceipt.mockResolvedValue(unpaidWithoutQr());
    renderDialog();
    await previewHtml();

    await choose(user, ACCOUNT_FIELD, 'Techcombank - 19001234567');

    expect(await screen.findByText(/Tài khoản này không tạo được mã QR/)).toBeInTheDocument();
    expect(parse(await previewHtml()).querySelector('svg')).toBeNull();
    expect(printButton()).toBeEnabled();
  });

  it('còn tiền phải trả nhưng không có tài khoản nào dùng được (hoặc không tải được danh sách): in không có mã QR', async () => {
    getSalesOrderReceipt.mockResolvedValue(unpaidWithoutQr());
    getBankAccounts.mockResolvedValue([NO_BIN]);
    const first = renderDialog();
    expect(parse(await previewHtml()).querySelector('svg')).toBeNull();
    expect(screen.queryByRole('combobox', { name: ACCOUNT_FIELD })).not.toBeInTheDocument();
    expect(printButton()).toBeEnabled();
    first.unmount();

    getBankAccounts.mockRejectedValue('Something went wrong');
    renderDialog();
    expect(parse(await previewHtml()).querySelector('svg')).toBeNull();
    expect(screen.queryByRole('combobox', { name: ACCOUNT_FIELD })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hoá đơn đã huỷ: xem trước có chữ ĐÃ HUỶ, không hỏi tài khoản dù còn tiền chưa trả', async () => {
    getSalesOrderReceipt.mockResolvedValue(cancelledReceipt());
    getBankAccounts.mockResolvedValue([VCB, TCB]);
    renderDialog();

    const doc = parse(await previewHtml());
    expect(doc.querySelector('.cx')?.textContent).toBe('ĐÃ HUỶ');
    expect(getBankAccounts).not.toHaveBeenCalled();
    expect(screen.queryByRole('combobox', { name: ACCOUNT_FIELD })).not.toBeInTheDocument();
  });

  it('trình duyệt không mở được hộp thoại in: báo lỗi, hộp thoại vẫn mở', async () => {
    const user = userEvent.setup({ delay: null });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    printHtmlDocument.mockRejectedValueOnce(new Error('Không mở được khung in.'));
    const { onClose } = renderDialog();
    await previewHtml();

    await user.click(printButton());

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Không mở được hộp thoại in của trình duyệt', {
        variant: 'error',
      })
    );
    expect(onClose).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('nút Đóng gọi onClose', async () => {
    const user = userEvent.setup({ delay: null });
    const { onClose } = renderDialog();
    await previewHtml();

    await user.click(screen.getByRole('button', { name: 'Đóng' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
