// ----------------------------------------------------------------------
// Khiếu nại phiếu lương (Quy chế Điều 12.3): nhân viên gửi trong 3 ngày làm việc kể từ ngày nhận phiếu, quản lý trả lời trong
// 3 ngày làm việc. Khiếu nại không tự đổi tiền — có sai sót thì tính lại bảng lương như thường.
// ----------------------------------------------------------------------

export type PayrollComplaintStatus = 'Pending' | 'Accepted' | 'Rejected' | 'Withdrawn';

export const PAYROLL_COMPLAINT_STATUS_LABEL: Record<PayrollComplaintStatus, string> = {
  Pending: 'Chờ trả lời',
  Accepted: 'Có sai sót',
  Rejected: 'Phiếu đúng',
  Withdrawn: 'Đã rút',
};

export interface IPayrollComplaint {
  id: string;
  staffId: string;
  staffName: string;
  payrollRecordId: string;
  fromDate: string;
  toDate: string;
  totalSalaryAtFiling: number;
  content: string;
  status: PayrollComplaintStatus;
  /** Hạn trả lời (ngày, giờ VN). */
  replyDueOn: string;
  /** Còn chờ mà đã quá hạn trả lời. */
  isOverdue: boolean;
  reply?: string | null;
  repliedAt?: string | null;
  createdAt: string;
}

/** Hạn khiếu nại của một phiếu lương. */
export interface IPayrollComplaintWindow {
  receivedOn: string;
  deadline: string;
  isOpen: boolean;
  pendingComplaintId?: string | null;
}
