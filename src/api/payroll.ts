import axios, { endpoints } from 'src/utils/axios';

import type {
  IBatchPayrollCalculationRequest,
  IBatchPayrollResponse,
  IBulkFinalizePayrollRequest,
  IBulkFinalizePayrollResponse,
  IFinalizePayrollRequest,
  IMarkPayrollPaidRequest,
  IPayrollCalculationRequest,
  IPayrollCycleDetailResponse,
  IPayrollPaymentDetail,
  IPayrollRecord,
  IPayrollShiftDetailResponse,
  IPreparePayrollPaymentResponse,
  ISalaryConfigPreviewItem,
  IWaivePenaltyRequest,
  IWaivePenaltyResponse,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

// Admin/Manager endpoints

export async function calculatePayroll(
  data: IPayrollCalculationRequest
): Promise<IPayrollRecord> {
  const response = await axios.post<IPayrollRecord>(endpoints.payroll.calculate, data);
  return response.data;
}

export async function generateBatchPayroll(
  data: IBatchPayrollCalculationRequest
): Promise<IBatchPayrollResponse> {
  const response = await axios.post<IBatchPayrollResponse>(endpoints.payroll.generateBatch, data);
  return response.data;
}

export async function getPayrollByCycle(cycleId: string): Promise<IPayrollCycleDetailResponse> {
  const response = await axios.get<IPayrollCycleDetailResponse>(endpoints.payroll.byCycle(cycleId));
  return response.data;
}

export async function recalculatePayrollByCycle(cycleId: string): Promise<IBatchPayrollResponse> {
  const response = await axios.post<IBatchPayrollResponse>(
    endpoints.payroll.recalculateCycle(cycleId)
  );
  return response.data;
}

export async function finalizePayroll(
  id: string,
  data: IFinalizePayrollRequest
): Promise<IPayrollRecord> {
  const response = await axios.put<IPayrollRecord>(endpoints.payroll.finalize(id), data);
  return response.data;
}

// Staff endpoints

export async function getMyPayroll(): Promise<IPayrollRecord[]> {
  const response = await axios.get<IPayrollRecord[]>(endpoints.payroll.myPayroll);
  return response.data;
}

// Shift details & penalty waivers

export async function getPayrollShiftDetails(
  payrollRecordId: string
): Promise<IPayrollShiftDetailResponse> {
  const response = await axios.get<IPayrollShiftDetailResponse>(
    endpoints.payroll.shiftDetails(payrollRecordId)
  );
  return response.data;
}

export async function waivePenalty(
  data: IWaivePenaltyRequest
): Promise<IWaivePenaltyResponse> {
  const response = await axios.post<IWaivePenaltyResponse>(endpoints.payroll.waivePenalty, data);
  return response.data;
}

export async function removeWaiver(waiverId: string): Promise<void> {
  await axios.delete(endpoints.payroll.removeWaiver(waiverId));
}

// ── New endpoints ────────────────────────────────────────────────────────

// ── Payment endpoints ────────────────────────────────────────────────────

export async function getPayrollPayment(id: string): Promise<IPayrollPaymentDetail | null> {
  const response = await axios.get<IPayrollPaymentDetail | null>(endpoints.payroll.payment(id));
  return response.data;
}

export async function preparePayrollPayment(id: string): Promise<IPreparePayrollPaymentResponse> {
  const response = await axios.post<IPreparePayrollPaymentResponse>(
    endpoints.payroll.paymentPrepare(id)
  );
  return response.data;
}

export async function markPayrollPaid(
  id: string,
  data: IMarkPayrollPaidRequest
): Promise<IPayrollPaymentDetail> {
  const response = await axios.post<IPayrollPaymentDetail>(endpoints.payroll.markPaid(id), data);
  return response.data;
}

// ── Salary config preview + bulk finalize ────────────────────────────────

export async function getSalaryConfigPreview(
  fromDate: string
): Promise<ISalaryConfigPreviewItem[]> {
  const response = await axios.get<ISalaryConfigPreviewItem[]>(
    endpoints.payroll.salaryConfigPreview,
    { params: { fromDate } }
  );
  return response.data;
}

export async function recalculatePayrollRecord(id: string): Promise<IPayrollRecord> {
  const response = await axios.post<IPayrollRecord>(endpoints.payroll.recalculateRecord(id));
  return response.data;
}

export async function bulkFinalizePayroll(
  data: IBulkFinalizePayrollRequest
): Promise<IBulkFinalizePayrollResponse> {
  const response = await axios.post<IBulkFinalizePayrollResponse>(
    endpoints.payroll.bulkFinalize,
    data
  );
  return response.data;
}
