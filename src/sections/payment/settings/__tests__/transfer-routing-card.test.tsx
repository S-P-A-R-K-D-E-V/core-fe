import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Tab "Tài khoản nhận theo kênh": ma trận tài khoản × kênh, thẻ từng kênh, ô Thử, lưu theo kênh.
// ----------------------------------------------------------------------

const api = vi.hoisted(() => ({
  getPaymentChannels: vi.fn(),
  updateTransferRouting: vi.fn(),
  loadPosBankAccounts: vi.fn(),
  getBranchLocations: vi.fn(),
  snack: vi.fn(),
}));

vi.mock('src/api/online-shop', () => ({
  getPaymentChannels: api.getPaymentChannels,
  updateTransferRouting: api.updateTransferRouting,
}));
vi.mock('src/api/attendance', () => ({ getBranchLocations: api.getBranchLocations }));
vi.mock('src/components/account-capability', () => ({
  loadPosBankAccounts: api.loadPosBankAccounts,
  AccountCapabilityTag: () => null,
  capabilityLabel: (c: { confirmation: string }) => (c.confirmation === 'auto' ? 'Tự xác nhận' : 'Tự kiểm tra tiền về'),
}));
vi.mock('src/components/iconify', () => ({ default: () => null }));
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar: api.snack }) }));

// Imported after the mocks above.
import TransferRoutingCard from 'src/sections/payment/settings/transfer-routing-card';

const account = (id: string, number: string, holder = 'VU XUAN BINH', isDefault = false) => ({
  id,
  shortName: 'MB',
  bankName: 'MB Bank',
  bin: '970422',
  accountNumber: number,
  accountHolder: holder,
  isDefault,
  isActive: true,
});
const cap = (confirmation: string) => ({ bankAccountId: '', confirmation, kind: null, provider: null, quota: null, reason: null });

const channels = (posTransfer: unknown = null) => ({
  paymentServiceEnabled: true,
  options: [],
  pos: { configured: true, enabled: ['cash', 'transfer:account'], transfer: posTransfer, branches: null },
  online: { configured: false, enabled: [], transfer: null },
});

function renderCard() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <TransferRoutingCard />
    </ThemeProvider>
  );
}

beforeEach(() => {
  api.loadPosBankAccounts.mockResolvedValue({
    accounts: [account('a', '2510199966668', 'VU XUAN BINH', true), account('d', '681809200068', 'PHAM THUY MAI'), account('f', 'VQRQAMUXX7318')],
    capabilities: { a: cap('auto'), d: cap('auto'), f: cap('manual') },
  });
  api.getBranchLocations.mockResolvedValue([{ id: 'br1', branchName: 'Chùa Láng', geofenceRadius: 100, isActive: true }]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TransferRoutingCard', () => {
  it('chưa cấu hình: quầy "thu ngân chọn"; chọn Ưu tiên rồi lưu gửi danh sách + dự phòng', async () => {
    api.getPaymentChannels.mockResolvedValue(channels());
    api.updateTransferRouting.mockImplementation(async (_c: string, transfer: unknown) => channels(transfer));

    renderCard();

    const posCard = (await screen.findAllByText('Quầy · mọi chi nhánh')).at(-1)!.closest('.MuiCard-root') as HTMLElement;
    expect(within(posCard).getByRole('button', { name: 'Thu ngân tự chọn' })).toHaveAttribute('aria-pressed', 'true');

    const user = userEvent.setup();
    await user.click(within(posCard).getByRole('button', { name: 'Ưu tiên theo thứ tự' }));
    // Ô Thử: hoá đơn mặc định vào tài khoản đầu.
    expect(within(posCard).getByText(/→ MB …6668/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(api.updateTransferRouting).toHaveBeenCalledTimes(1));
    const [channel, transfer] = api.updateTransferRouting.mock.calls[0];
    expect(channel).toBe('pos');
    expect(transfer).toMatchObject({ strategy: 'priority', accounts: [{ id: 'a' }, { id: 'd' }], fallbackId: 'f', cashierOverride: 'pool' });
  });

  it('ma trận đánh số thứ tự, tài khoản tay không dùng cho online, tài khoản chủ khác bị đánh dấu', async () => {
    api.getPaymentChannels.mockResolvedValue(
      channels({ strategy: 'priority', accounts: [{ id: 'a' }], fallbackId: 'f', cashierOverride: 'pool', rules: [] })
    );

    renderCard();

    expect(await screen.findByText('①')).toBeInTheDocument();
    expect(screen.getAllByText('Dự phòng').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/chủ khác/).length).toBeGreaterThan(0);
    // Hàng tài khoản xác nhận tay (…7318): ô Bán online là "—".
    const manualRow = screen.getAllByText('MB …7318')[0].closest('tr') as HTMLElement;
    expect(within(manualRow).getByText('—')).toBeInTheDocument();
  });
});
