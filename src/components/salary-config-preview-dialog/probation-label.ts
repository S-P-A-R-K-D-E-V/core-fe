import type { IPayRegimeSettings } from 'src/types/corecms-api';

/**
 * Cột "Hệ số TV" của hộp thoại xem trước. Từ kỳ cửa hàng đặt mức sàn lương thử việc, bảng lương bỏ hệ số thử việc và lấy
 * lương giờ không thấp hơn mức sàn (core-be ProbationPayRule) — hiện mức sàn thay cho hệ số để không gây hiểu nhầm.
 */
export function probationLabel(
  probationRate: number | null | undefined,
  regime: Pick<IPayRegimeSettings, 'probationHourlyFloor' | 'probationHourlyFloorFrom'> | null | undefined,
  periodFrom: string
): string {
  const floor = regime?.probationHourlyFloor;
  const floorFrom = regime?.probationHourlyFloorFrom;
  if (floor != null && floorFrom && periodFrom >= floorFrom) {
    return `Sàn ${new Intl.NumberFormat('vi-VN').format(floor)}đ/giờ`;
  }
  return probationRate != null ? `${(probationRate * 100).toFixed(0)}%` : '100%';
}
