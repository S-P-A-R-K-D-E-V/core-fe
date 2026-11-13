import type { BranchType } from 'src/store/working-branch-store';

// ----------------------------------------------------------------------
// Cây menu quản trị: module (thanh ngang) → nhóm con (cột trong mega-menu) → trang. Mỗi trang có khoá ổn định (`key`):
// ghim, "Menu theo vai trò" và gần đây lưu theo khoá, không theo đường dẫn — đổi đường dẫn không làm mất cấu hình.
// Tài liệu: docs/cici/plans/admin-nav-restructure-plan.md.
// ----------------------------------------------------------------------

/** Điều kiện để thấy một nút của cây (module / nhóm / trang / hành động). Không khai báo = không giới hạn. */
export type NavRule = {
  /** Có MỘT vai trò trong danh sách (gộp đủ vai trò, như API). */
  roles?: readonly string[];
  /** Có MỘT trong các quyền (mã Core-be PermissionCatalog). Admin luôn đủ quyền. */
  permissions?: readonly string[];
  /** Có ĐỦ các quyền. */
  allPermissions?: readonly string[];
  /** Ẩn khi người dùng có MỘT trong các quyền này — lối vào "của mình" nhường chỗ cho lối vào quản lý. */
  exceptPermissions?: readonly string[];
  /** Tính năng cửa hàng đang bật (mảng = bật MỘT TRONG các khoá). */
  featureKey?: string | readonly string[];
  /** Tính năng chủ cửa hàng tắt trên web với người này (src/auth/platform-features.ts). */
  platformFeature?: string;
  /** Chỉ hiện khi loại chi nhánh nằm trong phạm vi của người dùng (menuBranchTypes). */
  branchType?: BranchType;
};

/** Hành động tạo mới gắn với một trang: nút "+" trong menu, lệnh trong ô tìm nhanh. */
export type NavAction = NavRule & {
  title: string;
  path: string;
  keywords?: string;
};

export type NavPage = NavRule & {
  key: string;
  title: string;
  path: string;
  /** Đường dẫn khác cũng thuộc trang này (tô đậm khi đang mở). */
  match?: readonly string[];
  /** Chỉ coi là đang mở khi trùng đúng đường dẫn (trang gốc có trang con riêng trong menu). */
  exact?: boolean;
  /** Từ khoá tìm nhanh (không dấu), vd "nhap hang phieu nhap". */
  keywords?: string;
  actions?: readonly NavAction[];
  /** Không ẩn được với chủ cửa hàng trong "Menu theo vai trò" (tránh tự khoá mình). */
  locked?: boolean;
};

export type NavGroup = NavRule & {
  key: string;
  title: string;
  /** Nhóm "Thiết lập": luôn ở cuối module, hiện gọn một hàng trong mega-menu. */
  setup?: boolean;
  pages: readonly NavPage[];
};

export type NavModule = NavRule & {
  key: string;
  title: string;
  /** Iconify (solar:*). */
  icon: string;
  /** Module chỉ có một nhóm, hiện từng trang thẳng trên thanh (vd máy quầy). */
  flat?: boolean;
  groups: readonly NavGroup[];
};

/** Mọi thứ cần để lọc menu cho một người. */
export type NavAccess = {
  roles: readonly string[];
  permissions?: readonly string[];
  blockedFeatures?: readonly string[];
  enabledFeatures: readonly string[];
  /** null = không thu hẹp theo loại chi nhánh (chủ cửa hàng). */
  branchTypes: readonly BranchType[] | null;
};

/** "Menu theo vai trò" đã gộp cho người đang đăng nhập (GET /users/me → navMenu). */
export type NavMenuPolicy = {
  hiddenKeys: readonly string[];
  pinnedKeys: readonly string[];
  homeKey?: string | null;
  hideFromSearch?: boolean;
};

/** Một trang đã làm phẳng — cho ô tìm nhanh, ghim, gần đây, breadcrumb. */
export type NavFlatPage = {
  key: string;
  title: string;
  path: string;
  match?: readonly string[];
  exact?: boolean;
  keywords?: string;
  actions: readonly NavAction[];
  moduleKey: string;
  moduleTitle: string;
  moduleIcon: string;
  groupTitle: string;
};

/** Cây đã lọc cho người đang đăng nhập. */
export type NavTree = {
  /** Module nghiệp vụ trên thanh ngang. */
  modules: NavModule[];
  /** ⚙ Cài đặt (null = không có mục nào). */
  settings: NavModule | null;
  /** Cá nhân (null = không có mục nào, vd máy quầy). */
  me: NavModule | null;
  /** Mọi trang thấy được trong menu. */
  pages: NavFlatPage[];
  /** Trang tìm được bằng ô tìm nhanh: gồm cả trang chủ cửa hàng ẩn khỏi menu theo vai trò (vẫn có quyền). */
  searchable: NavFlatPage[];
  /** Ghim mặc định của vai trò (chủ cửa hàng chọn). */
  rolePins: string[];
  /** Trang mở đầu của vai trò. */
  homeKey: string | null;
  counter: boolean;
};
