import { describe, expect, it } from 'vitest';

import {
  withRequired,
  requiredLabels,
  withoutDependents,
} from 'src/sections/role/permission-dependencies';

// ----------------------------------------------------------------------
// Quyền phải có kèm (requires của GET /permissions/catalog): chọn quyền ghi tự chọn quyền xem, bỏ quyền xem bỏ luôn quyền ghi.
// ----------------------------------------------------------------------

const catalog = {
  groups: [
    {
      key: 'expense',
      label: 'Chi phí',
      permissions: [
        { code: 'expense.read', label: 'Xem chi phí', requires: [] },
        { code: 'expense.create', label: 'Thêm chi phí', requires: ['expense.read'] },
        { code: 'expense.delete', label: 'Xoá chi phí', requires: ['expense.read'] },
      ],
    },
    {
      key: 'analytics',
      label: 'Báo cáo',
      // BE cũ chưa trả requires.
      permissions: [{ code: 'analytics.revenue.read', label: 'Doanh thu' }],
    },
  ],
};

describe('permission dependencies', () => {
  it('chọn quyền ghi thì tự chọn quyền xem', () => {
    expect(withRequired([], ['expense.create'], catalog).sort()).toEqual([
      'expense.create',
      'expense.read',
    ]);
    expect(withRequired(['analytics.revenue.read'], ['analytics.revenue.read'], catalog)).toEqual([
      'analytics.revenue.read',
    ]);
  });

  it('bỏ quyền xem thì bỏ luôn các quyền đang cần nó, giữ quyền khác', () => {
    expect(
      withoutDependents(
        ['expense.read', 'expense.create', 'expense.delete', 'analytics.revenue.read'],
        ['expense.read'],
        catalog
      )
    ).toEqual(['analytics.revenue.read']);
    expect(
      withoutDependents(['expense.read', 'expense.create'], ['expense.create'], catalog)
    ).toEqual(['expense.read']);
  });

  it('nhãn quyền cần kèm', () => {
    expect(requiredLabels('expense.delete', catalog)).toEqual(['Xem chi phí']);
    expect(requiredLabels('analytics.revenue.read', catalog)).toEqual([]);
  });
});
