import { describe, expect, it } from 'vitest';

import type {
  IPrintTemplate,
  IPrintTemplateList,
  IPrintTemplateAssignment,
} from 'src/types/print-template';

import { resolveAppliedTemplate } from '../print-template-resolve';

// ----------------------------------------------------------------------
// Chọn mẫu áp dụng: (kênh, phương thức) → (kênh, *) → (*, phương thức) → (*, *) → mẫu hệ thống.
// ----------------------------------------------------------------------

const template = (id: string, kind: IPrintTemplate['kind'] = 'receipt'): IPrintTemplate => ({
  id,
  kind,
  name: id,
  content: '',
  settings: '{}',
  createdAt: '2026-10-29T00:00:00Z',
  updatedAt: null,
});

const cell = (
  channel: IPrintTemplateAssignment['channel'],
  paymentMethod: IPrintTemplateAssignment['paymentMethod'],
  templateId: string,
  kind: IPrintTemplateAssignment['kind'] = 'receipt'
): IPrintTemplateAssignment => ({ kind, channel, paymentMethod, templateId });

const list: IPrintTemplateList = {
  templates: [
    template('default'),
    template('pos'),
    template('transfer'),
    template('pos-card'),
    template('tem', 'label'),
  ],
  assignments: [
    cell('*', '*', 'default'),
    cell('pos', '*', 'pos'),
    cell('*', 'transfer', 'transfer'),
    cell('pos', 'card', 'pos-card'),
    cell('online', 'cash', 'deleted-template'),
    cell('*', '*', 'tem', 'label'),
  ],
};

const resolved = (channel?: string | null, method?: string | null) =>
  resolveAppliedTemplate(list, 'receipt', channel, method)?.id ?? null;

describe('resolveAppliedTemplate', () => {
  it('picks the most specific cell first', () => {
    expect(resolved('pos', 'card')).toBe('pos-card');
    expect(resolved('pos', 'cash')).toBe('pos');
    expect(resolved('fnb', 'transfer')).toBe('transfer');
    expect(resolved('fnb', 'cash')).toBe('default');
  });

  it('treats unknown channels and methods as unknown, and skips cells of deleted templates', () => {
    expect(resolved(null, null)).toBe('default');
    expect(resolved('shopee', 'bitcoin')).toBe('default');
    expect(resolved('online', 'cash')).toBe('default');
  });

  it('returns null without templates and resolves labels by their single cell', () => {
    expect(
      resolveAppliedTemplate({ templates: [], assignments: [] }, 'receipt', 'pos', 'cash')
    ).toBeNull();
    expect(resolveAppliedTemplate(list, 'label', 'pos', 'cash')?.id).toBe('tem');
  });
});
