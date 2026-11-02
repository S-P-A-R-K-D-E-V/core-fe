import axios, { endpoints } from 'src/utils/axios';

import type { ICostForecast, CostForecastPeriod, IPayrollCostSetting } from 'src/types/cost-forecast';

// ----------------------------------------------------------------------
// Chi phí nhân sự dự kiến — Core-be /payroll/cost-forecast, cần payroll.cost-forecast.read (Admin). date = ngày bất kỳ trong kỳ.
// ----------------------------------------------------------------------

export async function getCostForecast(period: CostForecastPeriod, date: string): Promise<ICostForecast> {
  const response = await axios.get<ICostForecast>(endpoints.payroll.costForecast, { params: { period, date } });
  return response.data;
}

export async function getCostSettings(): Promise<IPayrollCostSetting> {
  const response = await axios.get<IPayrollCostSetting>(endpoints.payroll.costForecastSettings);
  return response.data;
}

export async function saveCostSettings(body: {
  employerInsurancePct: number;
  insuranceMinMonthlyWage: number | null;
  effectiveFrom: string;
}): Promise<IPayrollCostSetting> {
  const response = await axios.put<IPayrollCostSetting>(endpoints.payroll.costForecastSettings, body);
  return response.data;
}
