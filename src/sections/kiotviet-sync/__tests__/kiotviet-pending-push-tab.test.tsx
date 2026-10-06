import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { createTheme, ThemeProvider } from '@mui/material/styles';

import type { IKiotVietFailedPushPagedResponse } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Tab "Đơn chờ đẩy" (GET kiotviet/push/failed + POST kiotviet/push/sales-orders/{id}/retry):
// cửa hàng không đẩy hoá đơn sang KiotViet (pushEnabled: false) vẫn thấy đơn lỗi cũ nhưng không có nút đẩy lại;
// lời từ chối của core-be ({ message, code, title, errorCodes }) hiện đúng câu của core-be.
// ----------------------------------------------------------------------

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar }),
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

vi.mock('src/components/label', () => ({
  default: ({ children }: any) => <span>{children}</span>,
}));

// fCurrency thật kéo theo src/locales → theme (next/font) không chạy được trong jsdom
vi.mock('src/utils/format-number', () => ({
  fCurrency: (value: number) => `${value}đ`,
}));

const getFailedPushes = vi.fn();
vi.mock('src/api/kiotviet', () => ({
  getFailedPushes: (...args: any[]) => getFailedPushes(...args),
}));

const retryPushSalesOrder = vi.fn();
vi.mock('src/api/sales-orders', () => ({
  retryPushSalesOrder: (...args: any[]) => retryPushSalesOrder(...args),
}));

// Imported after the mocks above so the tab picks up the mocked modules.
import KiotVietPendingPushTab from 'src/sections/kiotviet-sync/kiotviet-pending-push-tab';

// ----------------------------------------------------------------------

const RETRY = 'Đẩy lại lên KiotViet';
const PUSH_OFF_NOTICE = /Cửa hàng hiện không đẩy hoá đơn sang KiotViet/;

function failedPage(pushEnabled?: boolean): IKiotVietFailedPushPagedResponse {
  return {
    total: 1,
    page: 1,
    pageSize: 20,
    ...(pushEnabled === undefined ? {} : { pushEnabled }),
    data: [
      {
        id: 'so-1',
        code: 'HD-20261001-0007',
        total: 120000,
        customerName: 'Chị Lan',
        createdDate: '2026-10-01T03:00:00Z',
        kiotVietSyncStatus: 'Failed',
        kiotVietSyncAttempts: 3,
        kiotVietSyncError: 'Sản phẩm chưa liên kết KiotViet',
      },
    ],
  };
}

function renderTab() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <KiotVietPendingPushTab />
    </ThemeProvider>
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('KiotVietPendingPushTab', () => {
  it('cửa hàng đang đẩy hoá đơn: đơn lỗi có nút đẩy lại, không có ghi chú "không đẩy"', async () => {
    getFailedPushes.mockResolvedValue(failedPage(true));

    renderTab();

    expect(await screen.findByText('HD-20261001-0007')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: RETRY })).toBeInTheDocument();
    expect(screen.queryByText(PUSH_OFF_NOTICE)).not.toBeInTheDocument();
  });

  it('core-be cũ không trả pushEnabled: giữ nút đẩy lại như trước', async () => {
    getFailedPushes.mockResolvedValue(failedPage());

    renderTab();

    expect(await screen.findByRole('button', { name: RETRY })).toBeInTheDocument();
  });

  it('pushEnabled: false — vẫn liệt kê đơn lỗi cũ kèm ghi chú, KHÔNG có nút đẩy lại', async () => {
    getFailedPushes.mockResolvedValue(failedPage(false));

    renderTab();

    expect(await screen.findByText('HD-20261001-0007')).toBeInTheDocument();
    expect(screen.getByText('Sản phẩm chưa liên kết KiotViet')).toBeInTheDocument();
    expect(screen.getByText(PUSH_OFF_NOTICE)).toHaveTextContent('hãy nhập tay');
    expect(screen.queryByRole('button', { name: RETRY })).not.toBeInTheDocument();
  });

  it('đẩy lại bị 409 PushDisabled: hiện câu của core-be (không phải lỗi) rồi ẩn nút đẩy lại', async () => {
    const message = 'Cửa hàng không đẩy hoá đơn sang KiotViet — hoá đơn chỉ lưu trong hệ thống.';
    getFailedPushes.mockResolvedValue(failedPage(true));
    retryPushSalesOrder.mockRejectedValue({
      message,
      code: 'KiotVietSalesOrder.PushDisabled',
      title: message,
      errorCodes: ['KiotVietSalesOrder.PushDisabled'],
    });

    renderTab();
    await userEvent.click(await screen.findByRole('button', { name: RETRY }));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(message, { variant: 'info' }));
    expect(retryPushSalesOrder).toHaveBeenCalledWith('so-1');
    expect(screen.queryByRole('button', { name: RETRY })).not.toBeInTheDocument();
    expect(screen.getByText(PUSH_OFF_NOTICE)).toBeInTheDocument();
  });

  it('đẩy lại bị 400 theo trạng thái của đơn: hiện câu của core-be và tải lại danh sách', async () => {
    const message = 'Hoá đơn đang chờ đẩy sang KiotViet — hệ thống tự đẩy, không cần đẩy lại.';
    getFailedPushes.mockResolvedValueOnce(failedPage(true));
    getFailedPushes.mockResolvedValue({ ...failedPage(true), total: 0, data: [] });
    retryPushSalesOrder.mockRejectedValue({
      message,
      code: 'KiotVietSalesOrder.PushQueued',
      title: message,
      errorCodes: ['KiotVietSalesOrder.PushQueued'],
    });

    renderTab();
    await userEvent.click(await screen.findByRole('button', { name: RETRY }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith(message, { variant: 'error' })
    );
    await waitFor(() => expect(screen.queryByText('HD-20261001-0007')).not.toBeInTheDocument());
    expect(getFailedPushes).toHaveBeenCalledTimes(2);
  });
});
