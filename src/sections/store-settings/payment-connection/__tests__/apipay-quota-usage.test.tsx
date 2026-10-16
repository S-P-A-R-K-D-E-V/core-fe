import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IPaymentQuotaUsage } from 'src/types/payment-service';

// ----------------------------------------------------------------------
// Hạn mức gói ApiPay trên thẻ kết nối: dòng "Đã dùng X / Y GD · chu kỳ … · còn Z", màu thanh theo trạng thái, cảnh báo
// khi sắp hết / đã vượt (ApiPay vẫn chạy, trừ phí vượt), ghi chú ước tính; tải lại khi đổi hạn mức bằng Cập nhật.
// ----------------------------------------------------------------------

const getPaymentConnectionUsage = vi.fn();
vi.mock('src/api/payment-settings', () => ({
  getPaymentConnectionUsage: (...args: any[]) => getPaymentConnectionUsage(...args),
}));

// Imported after the mocks above.
import ApiPayQuotaUsage from '../apipay-quota-usage';
import { hasQuota, cycleDayMonth, quotaUsageView } from '../utils';

const usage = (u: Partial<IPaymentQuotaUsage> = {}): IPaymentQuotaUsage => ({
  cycleStart: '2026-10-15',
  cycleEnd: '2026-11-15',
  used: 12,
  quota: 60,
  remaining: 48,
  status: 'ok',
  connections: 1,
  ...u,
});

const wrap = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

afterEach(() => {
  vi.clearAllMocks();
});

describe('quotaUsageView', () => {
  it('dòng tóm tắt theo chu kỳ của ApiPay (ngày bắt đầu → ngày bắt đầu chu kỳ sau)', () => {
    const view = quotaUsageView(usage());
    expect(view.summary).toBe('Đã dùng 12 / 60 GD · chu kỳ 15/10 → 15/11 · còn 48');
    expect([view.percent, view.color, view.warning]).toEqual([20, 'primary', null]);
    expect(view.note).toBe(
      'Ước tính từ giao dịch đã ghi nhận — số chính xác xem my.apipay.vn → Tổng quan.'
    );
  });

  it('≥ 80% → vàng + nhắc phí vượt; vượt → đỏ, thanh đầy, "vượt N" thay "còn"', () => {
    const warning = quotaUsageView(usage({ used: 49, remaining: 11, status: 'warning' }));
    expect([warning.percent, warning.color]).toEqual([82, 'warning']);
    expect(warning.warning).toMatch(/Sắp hết hạn mức gói.*350đ\/GD/);

    const over = quotaUsageView(usage({ used: 75, remaining: 0, status: 'exceeded' }));
    expect(over.summary).toBe('Đã dùng 75 / 60 GD · chu kỳ 15/10 → 15/11 · vượt 15');
    expect([over.percent, over.color]).toEqual([100, 'error']);
    expect(over.warning).toMatch(/ApiPay vẫn báo tiền về bình thường.*số dư trả trước/);
  });

  it('nhiều kết nối cùng tài khoản ApiPay → ghi chú cộng chung', () => {
    expect(quotaUsageView(usage({ connections: 2 })).note).toMatch(
      /Cộng chung 2 kết nối dùng cùng tài khoản ApiPay\.$/
    );
  });

  it('chỉ ApiPay có hạn mức; ngày đọc thẳng chuỗi', () => {
    expect(hasQuota({ provider: 'apipay' })).toBe(true);
    expect(hasQuota({ provider: 'sepay' })).toBe(false);
    expect(cycleDayMonth('2026-01-31')).toBe('31/01');
    expect(cycleDayMonth('lạ')).toBe('lạ');
  });
});

describe('ApiPayQuotaUsage', () => {
  it('hiện số liệu, cảnh báo và mở Cập nhật để sửa hạn mức', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    getPaymentConnectionUsage.mockResolvedValue(
      usage({ used: 49, remaining: 11, status: 'warning', connections: 2 })
    );

    wrap(<ApiPayQuotaUsage connection={{ id: 'c-apipay' }} onEdit={onEdit} />);

    expect(
      await screen.findByText('Đã dùng 49 / 60 GD · chu kỳ 15/10 → 15/11 · còn 11', { exact: false })
    ).toBeInTheDocument();
    expect(getPaymentConnectionUsage).toHaveBeenCalledWith('c-apipay');
    expect(screen.getByRole('progressbar', { name: 'Hạn mức gói ApiPay đã dùng' })).toHaveAttribute(
      'aria-valuenow',
      '82'
    );
    expect(screen.getByText(/Sắp hết hạn mức gói/)).toBeInTheDocument();
    expect(screen.getByText(/my\.apipay\.vn → Tổng quan.*Cộng chung 2 kết nối/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sửa hạn mức' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('tải lại khi đổi hạn mức / ngày chu kỳ; lỗi chỉ hiện một dòng nhỏ', async () => {
    getPaymentConnectionUsage.mockResolvedValueOnce(usage());
    const { rerender } = wrap(
      <ApiPayQuotaUsage connection={{ id: 'c1', publicSettings: { monthlyQuota: '60' } }} />
    );
    await screen.findByText(/còn 48/);
    expect(screen.queryByRole('button', { name: 'Sửa hạn mức' })).not.toBeInTheDocument();

    getPaymentConnectionUsage.mockRejectedValueOnce({ message: 'Không kết nối được dịch vụ thanh toán' });
    rerender(
      <ThemeProvider theme={createTheme()}>
        <ApiPayQuotaUsage connection={{ id: 'c1', publicSettings: { monthlyQuota: '300' } }} />
      </ThemeProvider>
    );

    await waitFor(() => expect(getPaymentConnectionUsage).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Không kết nối được dịch vụ thanh toán/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
