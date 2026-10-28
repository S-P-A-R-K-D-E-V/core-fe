import axios, { endpoints } from 'src/utils/axios';

import type {
  IBonusOrder,
  IBonusProgram,
  IMyBonusProgram,
  ISaveBonusProgram,
  IBonusProgramMonth,
} from 'src/types/bonus-program';

// ----------------------------------------------------------------------
// Chương trình thưởng theo đơn (Quy chế Điều 4, 14a.4) — Core-be /bonus-programs. Trừ /mine, mọi lời gọi cần
// payroll.bonus-program.manage (Admin).
// ----------------------------------------------------------------------

export async function getBonusPrograms(): Promise<IBonusProgram[]> {
  const response = await axios.get<IBonusProgram[]>(endpoints.bonusPrograms.list);
  return response.data;
}

export async function saveBonusProgram(id: string | null, body: ISaveBonusProgram): Promise<IBonusProgram> {
  const response = id
    ? await axios.put<IBonusProgram>(endpoints.bonusPrograms.detail(id), body)
    : await axios.post<IBonusProgram>(endpoints.bonusPrograms.list, body);
  return response.data;
}

/** month = ngày bất kỳ trong tháng (yyyy-MM-dd). */
export async function getBonusProgramMonth(id: string, month: string): Promise<IBonusProgramMonth> {
  const response = await axios.get<IBonusProgramMonth>(endpoints.bonusPrograms.month(id), { params: { month } });
  return response.data;
}

export async function getBonusOrders(from: string, to: string): Promise<IBonusOrder[]> {
  const response = await axios.get<IBonusOrder[]>(endpoints.bonusPrograms.orders, { params: { from, to } });
  return response.data;
}

/** closerUserId = null → người chốt mặc định. */
export async function setBonusOrderAttribution(
  salesOrderId: string,
  body: { isOnline: boolean; closerUserId: string | null; note?: string | null }
): Promise<IBonusOrder> {
  const response = await axios.put<IBonusOrder>(endpoints.bonusPrograms.order(salesOrderId), body);
  return response.data;
}

export async function getMyBonusPrograms(month?: string): Promise<IMyBonusProgram[]> {
  const response = await axios.get<IMyBonusProgram[]>(endpoints.bonusPrograms.mine, { params: { month } });
  return response.data;
}

/** Xoá hẳn chương trình — phiếu lương đã chốt giữ nguyên; kỳ chưa chốt tính lại thì không còn khoản thưởng này. */
export async function deleteBonusProgram(id: string): Promise<void> {
  await axios.delete(endpoints.bonusPrograms.detail(id));
}
