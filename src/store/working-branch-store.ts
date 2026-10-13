import { create } from 'zustand';

import type { IBranchScope, IBranchLocation } from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Chi nhánh đang làm việc của TRÌNH DUYỆT này (cùng mô hình với app — features/branch/working-branch.ts):
//   - lựa chọn = chi nhánh đang hoạt động (GET /branches) trong phạm vi được phân công (GET /users/me → branchScope;
//     Admin / chưa phân công = mọi chi nhánh);
//   - chi nhánh đã nhớ còn trong lựa chọn → giữ (lấy lại tên / loại hình mới nhất); chưa chọn hoặc không còn →
//     chi nhánh đầu tiên. Khác app ở chỗ này: web không hỏi, vì nút đổi chi nhánh luôn nằm trên header;
//   - đúng một lựa chọn (nhân viên được phân công một chi nhánh) → không đổi được.
// Mỗi chi nhánh đúng một loại hình ("retail" | "fnb") — loại hình quyết định mục menu theo loại và các màn F&B.
// Nhớ trong localStorage; mỗi cửa hàng một tên miền nên không tách khoá theo cửa hàng.
// ----------------------------------------------------------------------

export type BranchType = 'retail' | 'fnb';

export type WorkingBranch = { id: string; name: string; type: BranchType };

export const WORKING_BRANCH_KEY = 'working-branch';

/** Khoá cũ của các màn F&B (chỉ lưu id) — đọc khi chưa có lựa chọn mới để người đang bán F&B không bị đổi chi nhánh. */
export const LEGACY_FNB_BRANCH_KEY = 'fnb.pos.branchId';

/** Loại hình từ API; core-be cũ không trả, giá trị lạ → "retail" (F&B chỉ bật khi API nói rõ "fnb"). */
export function branchTypeOf(value: unknown): BranchType {
  return typeof value === 'string' && value.trim().toLowerCase() === 'fnb' ? 'fnb' : 'retail';
}

/**
 * Các chi nhánh ĐANG HOẠT ĐỘNG mà người dùng được làm, giữ thứ tự API trả. Không có phạm vi / phạm vi mọi chi
 * nhánh → không lọc.
 */
export function activeBranches(
  list: readonly IBranchLocation[] | null | undefined,
  scope?: IBranchScope | null
): WorkingBranch[] {
  const allowed = scope && !scope.allBranches ? new Set(scope.branchIds) : null;
  return (Array.isArray(list) ? list : [])
    .filter((b) => !!b && typeof b.id === 'string' && b.isActive !== false && (!allowed || allowed.has(b.id)))
    .map((b) => ({ id: b.id, name: b.branchName, type: branchTypeOf(b.businessType) }));
}

/** Chi nhánh dùng tiếp sau khi có danh sách lựa chọn: cái đã nhớ → cái các màn F&B từng nhớ → cái đầu tiên. */
export function pickBranch(
  stored: WorkingBranch | null,
  options: readonly WorkingBranch[],
  legacyId?: string | null
): WorkingBranch | null {
  return (
    (stored && options.find((b) => b.id === stored.id)) ||
    (legacyId && options.find((b) => b.id === legacyId)) ||
    options[0] ||
    null
  );
}

/** Đọc chi nhánh đã lưu; hỏng / sai dạng → null. */
export function parseStoredBranch(raw: string | null | undefined): WorkingBranch | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<WorkingBranch> | null;
    if (!v || typeof v !== 'object' || typeof v.id !== 'string' || !v.id) return null;
    return { id: v.id, name: typeof v.name === 'string' ? v.name : '', type: branchTypeOf(v.type) };
  } catch {
    return null;
  }
}

/** Đổi được chi nhánh không: có từ hai chi nhánh để chọn. */
export const canSwitchBranch = (options: readonly WorkingBranch[] | null | undefined) =>
  (options?.length ?? 0) > 1;

/**
 * Các loại chi nhánh dùng để lọc mục menu gắn loại (vd các mục F&B); null = không thu hẹp.
 *   - Chủ cửa hàng (Admin): không thu hẹp.
 *   - Quản lý: mọi loại có trong các chi nhánh họ được làm (chưa hỏi xong danh sách → loại của chi nhánh đã nhớ).
 *   - Còn lại (nhân viên): đúng loại của chi nhánh đang làm việc.
 */
export function menuBranchTypes(
  role: string | undefined,
  branch: WorkingBranch | null,
  options: readonly WorkingBranch[] | null
): BranchType[] | null {
  if (role === 'Admin') return null;
  const own = branch ? [branch.type] : [];
  if (role === 'Manager' && options) return Array.from(new Set(options.map((b) => b.type)));
  return own;
}

// ----------------------------------------------------------------------

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persist(branch: WorkingBranch | null) {
  try {
    if (branch) window.localStorage.setItem(WORKING_BRANCH_KEY, JSON.stringify(branch));
    else window.localStorage.removeItem(WORKING_BRANCH_KEY);
  } catch {
    // bỏ qua — lần mở sau chọn lại chi nhánh đầu tiên
  }
}

const sameBranch = (a: WorkingBranch | null, b: WorkingBranch | null) =>
  a === b || (!!a && !!b && a.id === b.id && a.name === b.name && a.type === b.type);

type WorkingBranchState = {
  /** Đã đọc chi nhánh đã nhớ trên trình duyệt. */
  hydrated: boolean;
  branch: WorkingBranch | null;
  /** Lựa chọn theo lần hỏi GET /branches gần nhất; null = chưa hỏi xong. */
  options: WorkingBranch[] | null;
  /** Lý do đang khoá đổi chi nhánh (đơn đang mở, máy in phiếu đang chạy…); null = đổi được. */
  lock: string | null;
  /** Đọc chi nhánh đã nhớ và bỏ danh sách lựa chọn cũ (mở trang / đổi tài khoản). */
  hydrate: () => void;
  /** Đối chiếu với kết quả GET /branches, trong phạm vi chi nhánh của người dùng. */
  reconcile: (list: readonly IBranchLocation[] | null | undefined, scope?: IBranchScope | null) => void;
  /** Không hỏi được GET /branches: dùng tiếp chi nhánh đã nhớ, không ghi đè bản lưu. */
  reconcileFailed: () => void;
  /** Người dùng chọn 1 chi nhánh trong `options`; đang khoá thì bỏ qua. */
  select: (id: string) => void;
  setLock: (reason: string | null) => void;
};

export const useWorkingBranch = create<WorkingBranchState>((set, get) => ({
  hydrated: false,
  branch: null,
  options: null,
  lock: null,

  hydrate() {
    set({ hydrated: true, branch: parseStoredBranch(readStorage(WORKING_BRANCH_KEY)), options: null });
  },

  reconcile(list, scope) {
    const s = get();
    if (!s.hydrated) return;
    const options = activeBranches(list, scope);
    const branch = pickBranch(s.branch, options, s.branch ? null : readStorage(LEGACY_FNB_BRANCH_KEY));
    set({ branch, options });
    if (!sameBranch(s.branch, branch)) persist(branch);
  },

  reconcileFailed() {
    const s = get();
    if (!s.hydrated || s.options) return;
    set({ options: s.branch ? [s.branch] : [] });
  },

  select(id) {
    const s = get();
    const picked = s.options?.find((b) => b.id === id);
    if (!picked || s.lock) return;
    set({ branch: picked });
    persist(picked);
  },

  setLock(reason) {
    set({ lock: reason });
  },
}));
