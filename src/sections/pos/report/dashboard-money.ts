import type { IOperatingCostBreakdown } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Số tiền của Dashboard tài chính. Chi phí vận hành lấy từ /reports/operating-cost (cùng bộ ước tính với Điểm hoà vốn,
// có lương theo bảng lương), không phải báo cáo chi phí đã nhập — báo cáo chi phí không có lương nếu chưa nhập lương
// thành khoản chi, nên lợi nhuận ròng bị thổi lên.
// ----------------------------------------------------------------------

export type DashboardMoney = {
  /** Chi phí vận hành của khoảng ngày, gồm lương. */
  operatingCost: number;
  /** Phần lương trong chi phí vận hành. */
  laborCost: number;
  /** Lợi nhuận ròng = lãi gộp − chi phí vận hành (gồm lương). */
  netProfit: number;
};

export function dashboardMoney(
  grossProfit: number | undefined,
  operatingCost: Pick<IOperatingCostBreakdown, 'total' | 'laborCost'> | null | undefined
): DashboardMoney {
  const cost = operatingCost?.total ?? 0;
  return {
    operatingCost: cost,
    laborCost: operatingCost?.laborCost ?? 0,
    netProfit: (grossProfit ?? 0) - cost,
  };
}
