import axios, { endpoints } from 'src/utils/axios';
import {
  IShift,
  ICreateShiftRequest,
  IUpdateShiftRequest,
  IShiftTemplate,
  ICreateShiftTemplateRequest,
  IUpdateShiftTemplateRequest,
  IShiftSchedule,
  ICreateShiftScheduleRequest,
  IUpdateShiftScheduleRequest,
  ILockShiftScheduleRequest,
  IShiftAssignment,
  ICreateShiftAssignmentRequest,
  IBulkAssignShiftScheduleRequest,
  IManageShiftAssignmentsRequest,
  ISwapShiftAssignmentsRequest,
  IAttendanceLog,
  ICheckInRequest,
  ICheckOutRequest,
  IManualAttendanceAdjustmentRequest,
  IAdjustAttendanceTimeRequest,
  IAttendanceRequest,
  ICreateAttendanceRequestDto,
  IProcessAttendanceRequestDto,
  IAttendanceReport,
} from 'src/types/corecms-api';

// ======================================================================
// Shift Templates (Master Data)
// ======================================================================

export async function getAllShiftTemplates(): Promise<IShiftTemplate[]> {
  const response = await axios.get<IShiftTemplate[]>(endpoints.shiftTemplates.list);
  return response.data;
}

export async function getShiftTemplateById(id: string): Promise<IShiftTemplate> {
  const response = await axios.get<IShiftTemplate>(endpoints.shiftTemplates.details(id));
  return response.data;
}

export async function createShiftTemplate(data: ICreateShiftTemplateRequest): Promise<IShiftTemplate> {
  const response = await axios.post<IShiftTemplate>(endpoints.shiftTemplates.create, data);
  return response.data;
}

export async function updateShiftTemplate(id: string, data: IUpdateShiftTemplateRequest): Promise<IShiftTemplate> {
  const response = await axios.put<IShiftTemplate>(endpoints.shiftTemplates.update(id), data);
  return response.data;
}

export async function deleteShiftTemplate(id: string): Promise<void> {
  await axios.delete(endpoints.shiftTemplates.delete(id));
}

// ======================================================================
// Shift Schedules (Versioned + Locked)
// ======================================================================

export async function getShiftSchedulesByDateRange(fromDate: string, toDate: string): Promise<IShiftSchedule[]> {
  const response = await axios.get<IShiftSchedule[]>(endpoints.shiftSchedules.list, {
    params: { fromDate, toDate },
  });
  return response.data;
}

export async function getShiftScheduleById(id: string): Promise<IShiftSchedule> {
  const response = await axios.get<IShiftSchedule>(endpoints.shiftSchedules.details(id));
  return response.data;
}

export async function getShiftSchedulesByTemplate(templateId: string): Promise<IShiftSchedule[]> {
  const response = await axios.get<IShiftSchedule[]>(endpoints.shiftSchedules.byTemplate(templateId));
  return response.data;
}

export async function createShiftSchedule(data: ICreateShiftScheduleRequest): Promise<IShiftSchedule> {
  const response = await axios.post<IShiftSchedule>(endpoints.shiftSchedules.create, data);
  return response.data;
}

export async function updateShiftSchedule(id: string, data: IUpdateShiftScheduleRequest): Promise<IShiftSchedule> {
  const response = await axios.put<IShiftSchedule>(endpoints.shiftSchedules.update(id), data);
  return response.data;
}

export async function lockShiftSchedule(id: string, data: ILockShiftScheduleRequest): Promise<IShiftSchedule> {
  const response = await axios.put<IShiftSchedule>(endpoints.shiftSchedules.lock(id), data);
  return response.data;
}

// ======================================================================
// Shifts (Legacy - deprecated, use ShiftTemplate + ShiftSchedule)
// ======================================================================

export async function getAllShifts(): Promise<IShift[]> {
  const response = await axios.get<IShift[]>(endpoints.shifts.list);
  return response.data;
}

export async function getShiftById(id: string): Promise<IShift> {
  const response = await axios.get<IShift>(endpoints.shifts.details(id));
  return response.data;
}

export async function createShift(data: ICreateShiftRequest): Promise<IShift> {
  const response = await axios.post<IShift>(endpoints.shifts.create, data);
  return response.data;
}

export async function updateShift(id: string, data: IUpdateShiftRequest): Promise<IShift> {
  const response = await axios.put<IShift>(endpoints.shifts.update(id), data);
  return response.data;
}

export async function deleteShift(id: string): Promise<void> {
  await axios.delete(endpoints.shifts.delete(id));
}

// ======================================================================
// Shift Assignments (Updated to use ShiftSchedule)
// ======================================================================

export async function getShiftAssignments(
  fromDate: string,
  toDate: string,
  staffId?: string
): Promise<IShiftAssignment[]> {
  const params: any = { fromDate, toDate };
  if (staffId) params.staffId = staffId;
  const response = await axios.get<IShiftAssignment[]>(endpoints.shiftAssignments.list, { params });
  return response.data;
}

export async function getShiftAssignmentById(id: string): Promise<IShiftAssignment> {
  const response = await axios.get<IShiftAssignment>(endpoints.shiftAssignments.details(id));
  return response.data;
}

export async function getAssignmentsByStaffAndDate(
  staffId: string,
  date: string
): Promise<IShiftAssignment[]> {
  const response = await axios.get<IShiftAssignment[]>(
    endpoints.shiftAssignments.byStaffAndDate(staffId, date)
  );
  return response.data;
}

export async function getAssignmentsByStaffAndDateRange(
  staffId: string,
  fromDate: string,
  toDate: string
): Promise<IShiftAssignment[]> {
  const response = await axios.get<IShiftAssignment[]>(
    endpoints.shiftAssignments.byStaffAndDateRange(staffId),
    { params: { fromDate, toDate } }
  );
  return response.data;
}

export async function getMySchedule(
  fromDate: string,
  toDate: string
): Promise<IShiftAssignment[]> {
  const response = await axios.get<IShiftAssignment[]>(endpoints.shiftAssignments.mySchedule, {
    params: { fromDate, toDate },
  });
  return response.data;
}

export async function createShiftAssignment(
  data: ICreateShiftAssignmentRequest
): Promise<IShiftAssignment> {
  const response = await axios.post<IShiftAssignment>(endpoints.shiftAssignments.create, data);
  return response.data;
}

export async function bulkAssignShiftSchedule(
  data: IBulkAssignShiftScheduleRequest
): Promise<{ count: number; assignments: IShiftAssignment[] }> {
  const response = await axios.post<{ count: number; assignments: IShiftAssignment[] }>(
    endpoints.shiftAssignments.bulkAssign,
    data
  );
  return response.data;
}

export async function manageShiftAssignments(
  data: IManageShiftAssignmentsRequest
): Promise<{ added: number; removed: number }> {
  const response = await axios.post<{ added: number; removed: number }>(
    endpoints.shiftAssignments.manageShift,
    data
  );
  return response.data;
}

export async function deleteShiftAssignment(id: string): Promise<void> {
  await axios.delete(endpoints.shiftAssignments.delete(id));
}

export async function swapShiftAssignments(
  data: ISwapShiftAssignmentsRequest
): Promise<{ success: boolean }> {
  const response = await axios.post<{ success: boolean }>(endpoints.shiftAssignments.swap, data);
  return response.data;
}

// ======================================================================
// Attendance - Check In/Out
// ======================================================================

export async function checkIn(data: ICheckInRequest): Promise<IAttendanceLog> {
  const response = await axios.post<IAttendanceLog>(endpoints.attendance.checkIn, data);
  return response.data;
}

export async function checkOut(data: ICheckOutRequest): Promise<IAttendanceLog> {
  const response = await axios.post<IAttendanceLog>(endpoints.attendance.checkOut, data);
  return response.data;
}

// ======================================================================
// Attendance Logs
// ======================================================================

export async function getAttendanceLogs(
  fromDate: string,
  toDate: string,
  staffId?: string
): Promise<IAttendanceLog[]> {
  const params: any = { fromDate, toDate };
  if (staffId) params.staffId = staffId;
  const response = await axios.get<IAttendanceLog[]>(endpoints.attendance.logs, { params });
  return response.data;
}

export async function getMyAttendanceLogs(
  fromDate: string,
  toDate: string
): Promise<IAttendanceLog[]> {
  const response = await axios.get<IAttendanceLog[]>(endpoints.attendance.myLogs, {
    params: { fromDate, toDate },
  });
  return response.data;
}

// ======================================================================
// Manual Adjustment
// ======================================================================

export async function manualAdjustment(
  data: IManualAttendanceAdjustmentRequest
): Promise<IAttendanceLog> {
  const response = await axios.post<IAttendanceLog>(
    endpoints.attendance.manualAdjustment,
    data
  );
  return response.data;
}

export async function adjustAttendanceTime(
  data: IAdjustAttendanceTimeRequest
): Promise<IAttendanceLog> {
  const response = await axios.put<IAttendanceLog>(
    endpoints.attendance.adjustTime,
    data
  );
  return response.data;
}

// ======================================================================
// Auto Close
// ======================================================================

export async function autoCloseShifts(date?: string): Promise<{ closedCount: number }> {
  const params: any = {};
  if (date) params.date = date;
  const response = await axios.post<{ closedCount: number }>(endpoints.attendance.autoClose, null, {
    params,
  });
  return response.data;
}

// ======================================================================
// Attendance Requests
// ======================================================================

export async function getAttendanceRequests(
  staffId?: string,
  status?: string
): Promise<IAttendanceRequest[]> {
  const params: any = {};
  if (staffId) params.staffId = staffId;
  if (status) params.status = status;
  const response = await axios.get<IAttendanceRequest[]>(endpoints.attendance.requests, { params });
  return response.data;
}

export async function getMyAttendanceRequests(): Promise<IAttendanceRequest[]> {
  const response = await axios.get<IAttendanceRequest[]>(endpoints.attendance.myRequests);
  return response.data;
}

export async function createAttendanceRequest(
  data: ICreateAttendanceRequestDto
): Promise<IAttendanceRequest> {
  const response = await axios.post<IAttendanceRequest>(endpoints.attendance.requests, data);
  return response.data;
}

export async function processAttendanceRequest(
  id: string,
  data: IProcessAttendanceRequestDto
): Promise<void> {
  await axios.patch(endpoints.attendance.processRequest(id), data);
}

// ======================================================================
// Reports
// ======================================================================

export async function getAttendanceReport(
  fromDate: string,
  toDate: string,
  staffId?: string
): Promise<IAttendanceReport> {
  const params: any = { fromDate, toDate };
  if (staffId) params.staffId = staffId;
  const response = await axios.get<IAttendanceReport>(endpoints.attendance.report, { params });
  return response.data;
}

export async function getMyAttendanceReport(
  fromDate: string,
  toDate: string
): Promise<IAttendanceReport> {
  const response = await axios.get<IAttendanceReport>(endpoints.attendance.myReport, {
    params: { fromDate, toDate },
  });
  return response.data;
}
