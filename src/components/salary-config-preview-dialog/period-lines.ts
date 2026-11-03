import type { ISalaryConfigPeriodSummary, ISalaryConfigPreviewItem } from 'src/types/corecms-api';

/** Các mức lương theo khoảng ngày khi kỳ có nhiều hơn một mức; null = chỉ một mức, hiện như cũ. */
export function periodLines(item: ISalaryConfigPreviewItem): ISalaryConfigPeriodSummary[] | null {
  return item.periodConfigs && item.periodConfigs.length > 1 ? item.periodConfigs : null;
}

/** yyyy-MM-dd → dd/MM. */
export const shortDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
