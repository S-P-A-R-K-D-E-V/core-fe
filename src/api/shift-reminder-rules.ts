import axios, { endpoints } from 'src/utils/axios';
import {
  IShiftReminderRule,
  IShiftReminderPreview,
  IShiftReminderRulePayload,
  IUpdateShiftReminderRulePayload,
} from 'src/types/shift-reminder-rule';

// ======================================================================
// Shift Reminder Rules (Admin cấu hình nhắc lịch làm)
// ======================================================================

export async function getShiftReminderRules(isActive?: boolean): Promise<IShiftReminderRule[]> {
  const response = await axios.get<IShiftReminderRule[]>(endpoints.shiftReminderRules.list, {
    params: isActive === undefined ? undefined : { isActive },
  });
  return response.data;
}

export async function createShiftReminderRule(
  data: IShiftReminderRulePayload
): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.shiftReminderRules.create, data);
  return response.data;
}

export async function updateShiftReminderRule(
  id: string,
  data: IUpdateShiftReminderRulePayload
): Promise<void> {
  await axios.put(endpoints.shiftReminderRules.update(id), data);
}

export async function deactivateShiftReminderRule(id: string): Promise<void> {
  await axios.post(endpoints.shiftReminderRules.deactivate(id));
}

export async function previewShiftReminderRule(id: string): Promise<IShiftReminderPreview> {
  const response = await axios.get<IShiftReminderPreview>(endpoints.shiftReminderRules.preview(id));
  return response.data;
}

export async function sendTestShiftReminderRule(id: string, targetUserId?: string): Promise<void> {
  await axios.post(endpoints.shiftReminderRules.sendTest(id), targetUserId ? { targetUserId } : {});
}
