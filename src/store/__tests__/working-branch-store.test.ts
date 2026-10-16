import { beforeEach, describe, expect, it } from 'vitest';

import type { IBranchLocation } from 'src/types/corecms-api';

import {
  pickBranch,
  branchTypeOf,
  activeBranches,
  canSwitchBranch,
  menuBranchTypes,
  parseStoredBranch,
  useWorkingBranch,
  WORKING_BRANCH_KEY,
  LEGACY_FNB_BRANCH_KEY,
} from '../working-branch-store';

// ----------------------------------------------------------------------
// Chi nhánh đang làm việc trên web: lựa chọn nằm trong phạm vi được phân công, nhớ trên trình duyệt, tự lấy chi
// nhánh đầu tiên khi chưa chọn / chi nhánh đã chọn không còn, và quy tắc loại chi nhánh dùng để lọc menu.
// ----------------------------------------------------------------------

const api = (id: string, over: Partial<IBranchLocation> = {}): IBranchLocation => ({
  id,
  branchName: `Chi nhánh ${id}`,
  geofenceRadius: 100,
  isActive: true,
  ...over,
});

const store = () => useWorkingBranch.getState();
const saved = () => parseStoredBranch(window.localStorage.getItem(WORKING_BRANCH_KEY));

/** Mở lại trang: bộ nhớ trống, dữ liệu trên trình duyệt còn nguyên. */
const reopen = () => useWorkingBranch.setState({ hydrated: false, branch: null, options: null, lock: null });

beforeEach(() => {
  window.localStorage.clear();
  reopen();
});

describe('đọc danh sách chi nhánh', () => {
  it('loại hình: chỉ "fnb" (không phân biệt hoa thường) là F&B; thiếu / lạ → retail', () => {
    expect(branchTypeOf('fnb')).toBe('fnb');
    expect(branchTypeOf(' FnB ')).toBe('fnb');
    expect(branchTypeOf('retail')).toBe('retail');
    [undefined, null, '', 'cafe', 3, {}].forEach((v) => expect(branchTypeOf(v)).toBe('retail'));
  });

  it('chỉ lấy chi nhánh đang hoạt động, giữ thứ tự API', () => {
    const list = [api('b1'), api('b2', { isActive: false }), api('b3', { businessType: 'fnb' })];
    expect(activeBranches(list)).toEqual([
      { id: 'b1', name: 'Chi nhánh b1', type: 'retail' },
      { id: 'b3', name: 'Chi nhánh b3', type: 'fnb' },
    ]);
    expect(activeBranches(null)).toEqual([]);
    expect(activeBranches({ items: [] } as any)).toEqual([]);
  });

  it('phạm vi được phân công: chỉ các chi nhánh trong branchIds; mọi chi nhánh / không có phạm vi → không lọc', () => {
    const list = [api('b1'), api('b2'), api('b3')];
    const ids = (scope?: any) => activeBranches(list, scope).map((b) => b.id);

    expect(ids({ allBranches: false, branchIds: ['b2'] })).toEqual(['b2']);
    expect(ids({ allBranches: true, branchIds: [] })).toEqual(['b1', 'b2', 'b3']);
    expect(ids(null)).toEqual(['b1', 'b2', 'b3']);
  });
});

describe('chọn chi nhánh dùng tiếp', () => {
  const options = activeBranches([api('b1'), api('b2', { businessType: 'fnb' })]);

  it('chi nhánh đã nhớ còn trong lựa chọn → giữ, lấy tên và loại hình mới nhất', () => {
    expect(pickBranch({ id: 'b2', name: 'Tên cũ', type: 'retail' }, options)).toEqual({
      id: 'b2',
      name: 'Chi nhánh b2',
      type: 'fnb',
    });
  });

  it('chưa chọn / chi nhánh đã nhớ không còn → chi nhánh đầu tiên', () => {
    expect(pickBranch(null, options)?.id).toBe('b1');
    expect(pickBranch({ id: 'b9', name: 'Đã đóng', type: 'retail' }, options)?.id).toBe('b1');
  });

  it('chưa chọn nhưng màn F&B cũ từng nhớ một chi nhánh → dùng chi nhánh đó', () => {
    expect(pickBranch(null, options, 'b2')?.id).toBe('b2');
    expect(pickBranch(null, options, 'khong-con')?.id).toBe('b1');
  });

  it('không có chi nhánh nào → không có chi nhánh', () => {
    expect(pickBranch({ id: 'b1', name: 'x', type: 'retail' }, [])).toBeNull();
  });
});

describe('store chi nhánh đang làm việc', () => {
  it('một chi nhánh: tự chọn, nhớ xuống trình duyệt, không đổi được', () => {
    store().hydrate();
    expect(store()).toMatchObject({ hydrated: true, branch: null, options: null });

    store().reconcile([api('b1')]);
    expect(store().branch).toEqual({ id: 'b1', name: 'Chi nhánh b1', type: 'retail' });
    expect(saved()).toEqual({ id: 'b1', name: 'Chi nhánh b1', type: 'retail' });
    expect(canSwitchBranch(store().options)).toBe(false);
  });

  it('nhiều chi nhánh: lấy chi nhánh đầu, đổi được; chọn xong thì nhớ, mở lại có ngay trước khi hỏi mạng', () => {
    store().hydrate();
    store().reconcile([api('b1'), api('b2', { businessType: 'fnb' })]);
    expect(store().branch?.id).toBe('b1');
    expect(canSwitchBranch(store().options)).toBe(true);

    store().select('khong-co'); // id lạ → bỏ qua
    expect(store().branch?.id).toBe('b1');

    store().select('b2');
    expect(store().branch).toEqual({ id: 'b2', name: 'Chi nhánh b2', type: 'fnb' });

    reopen();
    store().hydrate();
    expect(store().branch).toEqual({ id: 'b2', name: 'Chi nhánh b2', type: 'fnb' });
    expect(store().options).toBeNull(); // chưa hỏi lại GET /branches
  });

  it('nhân viên được phân công một chi nhánh: chỉ thấy chi nhánh đó dù trình duyệt đang nhớ chi nhánh khác', () => {
    window.localStorage.setItem(WORKING_BRANCH_KEY, JSON.stringify({ id: 'b1', name: 'x', type: 'retail' }));
    store().hydrate();
    store().reconcile([api('b1'), api('b2', { businessType: 'fnb' })], { allBranches: false, branchIds: ['b2'] });

    expect(store().branch).toMatchObject({ id: 'b2', type: 'fnb' });
    expect(store().options?.map((b) => b.id)).toEqual(['b2']);
    expect(saved()?.id).toBe('b2');
  });

  it('chưa có lựa chọn mới: lấy chi nhánh các màn F&B cũ đã nhớ', () => {
    window.localStorage.setItem(LEGACY_FNB_BRANCH_KEY, 'b2');
    store().hydrate();
    store().reconcile([api('b1'), api('b2', { businessType: 'fnb' })]);

    expect(store().branch?.id).toBe('b2');
  });

  it('chưa đọc bản lưu thì chưa đối chiếu (không ghi đè chi nhánh đã nhớ bằng chi nhánh đầu tiên)', () => {
    window.localStorage.setItem(WORKING_BRANCH_KEY, JSON.stringify({ id: 'b2', name: 'x', type: 'fnb' }));
    store().reconcile([api('b1'), api('b2')]);

    expect(store().branch).toBeNull();
    expect(saved()?.id).toBe('b2');
  });

  it('không hỏi được danh sách chi nhánh: dùng tiếp chi nhánh đã nhớ, không xoá bản lưu', () => {
    window.localStorage.setItem(WORKING_BRANCH_KEY, JSON.stringify({ id: 'b2', name: 'Quầy', type: 'fnb' }));
    store().hydrate();
    store().reconcileFailed();

    expect(store().branch?.id).toBe('b2');
    expect(store().options?.map((b) => b.id)).toEqual(['b2']);
    expect(saved()?.id).toBe('b2');
  });

  it('đang khoá (đơn đang mở, máy in đang chạy) thì không đổi được chi nhánh', () => {
    store().hydrate();
    store().reconcile([api('b1'), api('b2')]);

    store().setLock('Đang mở đơn');
    store().select('b2');
    expect(store().branch?.id).toBe('b1');

    store().setLock(null);
    store().select('b2');
    expect(store().branch?.id).toBe('b2');
  });

  it('bản lưu hỏng → coi như chưa chọn', () => {
    window.localStorage.setItem(WORKING_BRANCH_KEY, '{hỏng');
    store().hydrate();
    expect(store().branch).toBeNull();
  });
});

describe('loại chi nhánh dùng để lọc menu', () => {
  const retail = { id: 'b1', name: 'Cửa hàng', type: 'retail' as const };
  const fnb = { id: 'b2', name: 'Quầy cà phê', type: 'fnb' as const };

  it('chủ cửa hàng: không thu hẹp', () => {
    expect(menuBranchTypes('Admin', retail, [retail, fnb])).toBeNull();
    expect(menuBranchTypes('Admin', null, null)).toBeNull();
  });

  it('nhân viên: đúng loại của chi nhánh đang làm việc; chưa có chi nhánh → không loại nào', () => {
    expect(menuBranchTypes('Staff', retail, [retail, fnb])).toEqual(['retail']);
    expect(menuBranchTypes('Staff', fnb, [retail, fnb])).toEqual(['fnb']);
    expect(menuBranchTypes('Staff', null, null)).toEqual([]);
  });

  it('quản lý: mọi loại trong các chi nhánh được làm, không phụ thuộc chi nhánh đang chọn', () => {
    expect(menuBranchTypes('Manager', retail, [retail, fnb])).toEqual(['retail', 'fnb']);
    expect(menuBranchTypes('Manager', retail, [retail])).toEqual(['retail']);
    // Chưa hỏi xong danh sách → tạm theo chi nhánh đã nhớ.
    expect(menuBranchTypes('Manager', fnb, null)).toEqual(['fnb']);
  });

  it('nhiều vai trò: theo vai trò rộng nhất', () => {
    expect(menuBranchTypes(['Staff', 'Admin'], retail, [retail, fnb])).toBeNull();
    expect(menuBranchTypes(['Staff', 'Manager'], retail, [retail, fnb])).toEqual(['retail', 'fnb']);
    expect(menuBranchTypes(undefined, retail, [retail, fnb])).toEqual(['retail']);
  });
});
