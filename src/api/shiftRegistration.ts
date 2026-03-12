import axios, { endpoints } from 'src/utils/axios';
import {
  IShiftRegistration,
  IRegisterShiftRequest,
  IUnregisterShiftRequest,
  IBulkRegisterShiftRequest,
} from 'src/types/corecms-api';

// ======================================================================
// Shift Registration - Đăng ký ca làm việc
// ======================================================================

export async function registerShift(data: IRegisterShiftRequest): Promise<IShiftRegistration> {
  const response = await axios.post<IShiftRegistration>(endpoints.shiftRegistrations.register, data);
  return response.data;
}

export async function unregisterShift(data: IUnregisterShiftRequest): Promise<void> {
  await axios.post(endpoints.shiftRegistrations.unregister, data);
}

export async function bulkRegisterShift(
  data: IBulkRegisterShiftRequest
): Promise<{ count: number; registrations: IShiftRegistration[] }> {
  const response = await axios.post<{ count: number; registrations: IShiftRegistration[] }>(
    endpoints.shiftRegistrations.bulkRegister,
    data
  );
  return response.data;
}

export async function getShiftRegistrations(
  fromDate: string,
  toDate: string,
  staffId?: string
): Promise<IShiftRegistration[]> {
  const params: any = { fromDate, toDate };
  if (staffId) params.staffId = staffId;
  const response = await axios.get<IShiftRegistration[]>(endpoints.shiftRegistrations.list, {
    params,
  });
  return response.data;
}

export async function getMyShiftRegistrations(
  fromDate: string,
  toDate: string
): Promise<IShiftRegistration[]> {
  const response = await axios.get<IShiftRegistration[]>(
    endpoints.shiftRegistrations.myRegistrations,
    { params: { fromDate, toDate } }
  );
  return response.data;
}
