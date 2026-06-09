import axios, { endpoints } from 'src/utils/axios';

export interface IShiftAuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  actionType: string;
  entityType: string;
  entityId: string;
  affectedStaffIds: string[];
  shiftDate: string;
  needType?: string;
  oldData?: string;   // JSON string
  newData?: string;   // JSON string
  note?: string;
  timestamp: string;
}

export async function getShiftAuditLogs(params: {
  from?: string;        // yyyy-MM-dd — lọc theo Timestamp (ưu tiên)
  to?: string;          // yyyy-MM-dd
  date?: string;        // legacy: single ShiftDate
  staffId?: string;
  actionType?: string;
  limit?: number;
}): Promise<IShiftAuditLog[]> {
  const response = await axios.get<IShiftAuditLog[]>(endpoints.shiftAudit.list, { params });
  return response.data;
}
