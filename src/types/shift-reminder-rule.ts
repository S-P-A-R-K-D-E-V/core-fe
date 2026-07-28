export type ShiftReminderAnchorType = 'ShiftStart' | 'ShiftEnd';

// Phải khớp CoreCms.Application.ShiftReminderRules.Common.ShiftReminderTemplateRenderer.SupportedPlaceholders
export const SHIFT_REMINDER_PLACEHOLDERS = [
  '{ShiftName}',
  '{StaffName}',
  '{StartTime}',
  '{EndTime}',
  '{Date}',
  '{OffsetAbs}',
] as const;

export type IShiftReminderRuleTemplateScope = {
  shiftTemplateId: string;
  shiftTemplateName: string;
};

export type IShiftReminderRule = {
  id: string;
  name: string;
  anchorEvent: ShiftReminderAnchorType;
  offsetMinutes: number; // âm = trước mốc, dương = sau mốc
  skipIfConsecutive: boolean;
  titleTemplate: string;
  messageTemplate: string;
  appliesToAllShiftTemplates: boolean;
  shiftTemplateScopes: IShiftReminderRuleTemplateScope[];
  isActive: boolean;
  createdAt: string;
};

export type IShiftReminderRulePayload = {
  name: string;
  anchorEvent: ShiftReminderAnchorType;
  offsetMinutes: number;
  skipIfConsecutive: boolean;
  titleTemplate: string;
  messageTemplate: string;
  appliesToAllShiftTemplates: boolean;
  shiftTemplateIds?: string[] | null;
};

export type IUpdateShiftReminderRulePayload = IShiftReminderRulePayload & {
  isActive: boolean;
};

export type IShiftReminderPreview = {
  title: string;
  message: string;
};
