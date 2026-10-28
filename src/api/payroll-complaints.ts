import axios, { endpoints } from 'src/utils/axios';

import type { IPayrollComplaint, PayrollComplaintStatus, IPayrollComplaintWindow } from 'src/types/payroll-complaint';

// ----------------------------------------------------------------------
// Khiếu nại phiếu lương (Quy chế Điều 12.3) — Core-be /payroll-complaints.
// ----------------------------------------------------------------------

export async function getMyPayrollComplaints(): Promise<IPayrollComplaint[]> {
  const response = await axios.get<IPayrollComplaint[]>(endpoints.payrollComplaints.mine);
  return response.data;
}

export async function getPayrollComplaintWindow(payrollRecordId: string): Promise<IPayrollComplaintWindow> {
  const response = await axios.get<IPayrollComplaintWindow>(endpoints.payrollComplaints.window(payrollRecordId));
  return response.data;
}

export async function filePayrollComplaint(payrollRecordId: string, content: string): Promise<IPayrollComplaint> {
  const response = await axios.post<IPayrollComplaint>(endpoints.payrollComplaints.list, { payrollRecordId, content });
  return response.data;
}

export async function withdrawPayrollComplaint(id: string): Promise<IPayrollComplaint> {
  const response = await axios.put<IPayrollComplaint>(endpoints.payrollComplaints.withdraw(id));
  return response.data;
}

/** Người có payroll.complaint.review. */
export async function getPayrollComplaints(status?: PayrollComplaintStatus): Promise<IPayrollComplaint[]> {
  const response = await axios.get<IPayrollComplaint[]>(endpoints.payrollComplaints.list, { params: { status } });
  return response.data;
}

export async function replyPayrollComplaint(
  id: string,
  outcome: 'Accepted' | 'Rejected',
  reply: string
): Promise<IPayrollComplaint> {
  const response = await axios.put<IPayrollComplaint>(endpoints.payrollComplaints.reply(id), { outcome, reply });
  return response.data;
}
