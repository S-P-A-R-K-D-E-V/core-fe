import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IBankAccountWithConnections } from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Mã VietQR của tài khoản (GET bank-accounts/{id}/vietqr): mở là QR tĩnh (không số tiền) kèm giải thích dán quầy;
// nhập số tiền / nội dung rồi "Cập nhật mã" thì hỏi lại kèm tham số.
// ----------------------------------------------------------------------

const getBankAccountVietQr = vi.fn();
vi.mock('src/api/bank-accounts', () => ({
  getBankAccountVietQr: (...args: any[]) => getBankAccountVietQr(...args),
}));

vi.mock('src/components/payment-qr-info', () => ({
  useQrImageSrc: (_url: unknown, payload?: string | null) =>
    payload ? `data:image/png;base64,${payload.length}` : undefined,
}));

const snackbar = { enqueueSnackbar: vi.fn() };
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => snackbar,
}));

// Imported after the mocks above.
import BankAccountVietQrDialog from '../bank-account-vietqr-dialog';

const ACCOUNT: IBankAccountWithConnections = {
  id: 'acc-1',
  bankName: 'Ngân hàng TMCP Á Châu',
  shortName: 'ACB',
  bin: '970416',
  accountNumber: '5566778899',
  accountHolder: 'NGUYEN VAN A',
  isDefault: true,
  isActive: true,
  isManagedByKiotViet: false,
  qrMode: 'vietqr',
  connections: [],
};

const qr = (amount: number | null, content: string | null) => ({
  bankAccountId: 'acc-1',
  bin: '970416',
  bankName: 'Ngân hàng TMCP Á Châu',
  accountNumber: '5566778899',
  accountName: 'NGUYEN VAN A',
  amount,
  content,
  payload: '000201010211',
  imageUrl: 'https://img.vietqr.io/image/970416-5566778899-compact2.png',
});

const renderDialog = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <BankAccountVietQrDialog account={ACCOUNT} storeName="CiCi" onClose={vi.fn()} />
    </ThemeProvider>
  );

afterEach(() => {
  vi.clearAllMocks();
});

describe('BankAccountVietQrDialog', () => {
  it('mở → QR tĩnh vẽ từ payload, giải thích in dán quầy', async () => {
    getBankAccountVietQr.mockResolvedValue(qr(null, null));
    renderDialog();

    expect(await screen.findByText('5566778899')).toBeInTheDocument();
    expect(getBankAccountVietQr).toHaveBeenCalledWith('acc-1', undefined);
    expect(screen.getByRole('img', { name: /Mã VietQR chuyển khoản/ })).toHaveAttribute(
      'src',
      'data:image/png;base64,12'
    );
    expect(screen.getByText(/khách quét rồi tự nhập số tiền/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Tải ảnh PNG' })).toBeEnabled();
  });

  it('nhập số tiền + nội dung → hỏi lại kèm tham số, hiện số tiền đã áp dụng', async () => {
    const user = userEvent.setup();
    getBankAccountVietQr
      .mockResolvedValueOnce(qr(null, null))
      .mockResolvedValueOnce(qr(125000, 'BAN 3'));
    renderDialog();
    await screen.findByText('5566778899');

    const apply = screen.getByRole('button', { name: 'Cập nhật mã' });
    expect(apply).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Số tiền' }), '125.000đ');
    await user.type(screen.getByRole('textbox', { name: 'Nội dung chuyển khoản' }), 'BAN 3');
    await user.click(apply);

    await waitFor(() =>
      expect(getBankAccountVietQr).toHaveBeenLastCalledWith('acc-1', {
        amount: 125000,
        content: 'BAN 3',
      })
    );
    expect(await screen.findByText(/125\.000 đ/, { selector: 'b' })).toBeInTheDocument();
    expect(screen.queryByText(/khách quét rồi tự nhập số tiền/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Về mã QR tĩnh' })).toBeInTheDocument();
  });
});
