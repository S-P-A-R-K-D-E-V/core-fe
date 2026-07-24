import * as zod from 'zod';

import { parseDateStr, toDateStr } from 'src/utils/format-time';

import type { ICleaningTaskTemplate } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// zod schema + helpers for the checklist tuần (CleaningTaskTemplate) edit
// dialog, kept in their own module (no MUI/Next imports) so unit tests can
// import them without dragging in the whole component tree.
// ----------------------------------------------------------------------

export const CleaningTemplateSchema = zod
  .object({
    dayOfWeek: zod.string().min(1),
    cleaningBlock: zod.string().min(1),
    name: zod.string().min(1, 'Tên đầu việc là bắt buộc'),
    area: zod.string().optional(),
    sortOrder: zod.number(),
    isActive: zod.boolean(),
    fromDate: zod.string().min(1, 'Ngày bắt đầu áp dụng là bắt buộc'),
    toDate: zod.string().optional(),
    shiftTemplateIds: zod.array(zod.string()).min(1, 'Chọn ít nhất 1 ca áp dụng'),
  })
  .refine((data) => !data.toDate || data.toDate >= data.fromDate, {
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
    path: ['toDate'],
  });

export type CleaningTemplateSchemaType = zod.infer<typeof CleaningTemplateSchema>;

export const DEFAULT_CLEANING_TEMPLATE_VALUES: CleaningTemplateSchemaType = {
  dayOfWeek: 'Monday',
  cleaningBlock: 'Morning',
  name: '',
  area: '',
  sortOrder: 0,
  isActive: true,
  fromDate: toDateStr(new Date()),
  toDate: '',
  shiftTemplateIds: [],
};

// Normalizes a possibly-malformed legacy date string into the canonical
// 'yyyy-MM-dd' the DatePicker/backend expect, by round-tripping it through
// the same parse/format helpers used elsewhere in the app for this exact
// purpose (src/utils/format-time.ts), instead of passing the raw API
// string straight into form state.
export function normalizeDateStr(value: string | null | undefined): string {
  return toDateStr(parseDateStr(value));
}

export function templateToFormValues(template: ICleaningTaskTemplate): CleaningTemplateSchemaType {
  return {
    dayOfWeek: template.dayOfWeek,
    cleaningBlock: template.cleaningBlock,
    name: template.name,
    area: template.area || '',
    sortOrder: template.sortOrder,
    isActive: template.isActive,
    fromDate: normalizeDateStr(template.fromDate),
    toDate: normalizeDateStr(template.toDate),
    shiftTemplateIds: template.shiftTemplateIds || [],
  };
}
