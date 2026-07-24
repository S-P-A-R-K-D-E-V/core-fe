import { describe, expect, it } from 'vitest';

import {
  CleaningTemplateSchema,
  templateToFormValues,
} from 'src/sections/cleaning/cleaning-template-schema';

import type { ICleaningTaskTemplate } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Regression coverage for the checklist tuần edit dialog rewrite:
//   - zod schema replacing the old ad-hoc `if (...)` checks in handleSubmit
//   - fromDate/toDate normalization applied when opening the dialog for edit
// ----------------------------------------------------------------------

const VALID_VALUES = {
  dayOfWeek: 'Monday',
  cleaningBlock: 'Morning',
  name: 'Lau sàn',
  area: 'Tầng 1',
  sortOrder: 0,
  isActive: true,
  fromDate: '2026-07-20',
  toDate: '',
  shiftTemplateIds: ['shift-1'],
};

describe('CleaningTemplateSchema', () => {
  it('accepts a fully valid payload', () => {
    const result = CleaningTemplateSchema.safeParse(VALID_VALUES);
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = CleaningTemplateSchema.safeParse({ ...VALID_VALUES, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty fromDate', () => {
    const result = CleaningTemplateSchema.safeParse({ ...VALID_VALUES, fromDate: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty shiftTemplateIds (the new required many-to-many link)', () => {
    const result = CleaningTemplateSchema.safeParse({ ...VALID_VALUES, shiftTemplateIds: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'shiftTemplateIds');
      expect(issue).toBeDefined();
    }
  });

  it('rejects toDate earlier than fromDate', () => {
    const result = CleaningTemplateSchema.safeParse({
      ...VALID_VALUES,
      fromDate: '2026-07-20',
      toDate: '2026-07-10',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'toDate');
      expect(issue?.message).toMatch(/sau ngày bắt đầu/);
    }
  });

  it('accepts toDate equal to fromDate', () => {
    const result = CleaningTemplateSchema.safeParse({
      ...VALID_VALUES,
      fromDate: '2026-07-20',
      toDate: '2026-07-20',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty toDate (vô thời hạn)', () => {
    const result = CleaningTemplateSchema.safeParse({ ...VALID_VALUES, toDate: '' });
    expect(result.success).toBe(true);
  });
});

describe('templateToFormValues (date normalization on dialog open)', () => {
  const baseTemplate: ICleaningTaskTemplate = {
    id: 'tpl-1',
    dayOfWeek: 'Monday',
    cleaningBlock: 'Morning',
    name: 'Lau sàn',
    area: 'Tầng 1',
    sortOrder: 1,
    isActive: true,
    fromDate: '2026-07-20',
    toDate: '2026-08-01',
    shiftTemplateIds: ['shift-1', 'shift-2'],
  };

  it('keeps already-canonical yyyy-MM-dd dates unchanged', () => {
    const values = templateToFormValues(baseTemplate);
    expect(values.fromDate).toBe('2026-07-20');
    expect(values.toDate).toBe('2026-08-01');
  });

  it('normalizes a null/empty toDate to an empty string', () => {
    const values = templateToFormValues({ ...baseTemplate, toDate: null });
    expect(values.toDate).toBe('');
  });

  it('turns a garbage date string into an empty string rather than passing it through broken', () => {
    const values = templateToFormValues({ ...baseTemplate, fromDate: 'not-a-date' });
    expect(values.fromDate).toBe('');
  });

  it('carries over shiftTemplateIds so the multi-select pre-populates on edit', () => {
    const values = templateToFormValues(baseTemplate);
    expect(values.shiftTemplateIds).toEqual(['shift-1', 'shift-2']);
  });

  it('defaults shiftTemplateIds to an empty array when the API omits it', () => {
    const values = templateToFormValues({ ...baseTemplate, shiftTemplateIds: undefined as any });
    expect(values.shiftTemplateIds).toEqual([]);
  });
});
