import { hasAnyRole } from 'src/auth/roles';
import { hasPermission, hasAnyPermission, hasAllPermissions } from 'src/auth/permissions';

import type {
  NavRule,
  NavPage,
  NavModule,
  NavAccess,
  NavFlatPage,
  NavMenuPolicy,
} from './nav-types';

// ----------------------------------------------------------------------
// Lọc cây menu qua các lớp: (1) tính năng cửa hàng + loại chi nhánh + tính năng web/app, (2) vai trò / quyền RBAC,
// (3) "Menu theo vai trò" do chủ cửa hàng chọn. Lớp 3 chỉ ẩn bớt — không bao giờ làm hiện mục người đó không có quyền.
// ----------------------------------------------------------------------

/** Lớp 1 + 2 cho một nút. */
export function ruleAllows(rule: NavRule, access: NavAccess): boolean {
  const user = { roles: access.roles, permissions: access.permissions };
  if (!hasAnyRole(access.roles, rule.roles)) return false;
  if (!hasAnyPermission(user, rule.permissions) || !hasAllPermissions(user, rule.allPermissions))
    return false;
  if (rule.exceptPermissions?.some((code) => hasPermission(user, code))) return false;
  if (rule.platformFeature && access.blockedFeatures?.includes(rule.platformFeature)) return false;
  if (rule.branchType && access.branchTypes && !access.branchTypes.includes(rule.branchType))
    return false;
  if (rule.featureKey) {
    const keys = typeof rule.featureKey === 'string' ? [rule.featureKey] : rule.featureKey;
    if (!keys.some((key) => access.enabledFeatures.includes(key))) return false;
  }
  return true;
}

/** Trang khoá (vd Vai trò & quyền) không ẩn được với chủ cửa hàng. */
export function hiddenByPolicy(
  page: NavPage,
  policy: NavMenuPolicy | null | undefined,
  roles: readonly string[]
) {
  if (!policy?.hiddenKeys.length) return false;
  if (page.locked && roles.includes('Admin')) return false;
  return policy.hiddenKeys.includes(page.key);
}

type FilterOptions = { policy?: NavMenuPolicy | null; ignorePolicy?: boolean };

/** Lọc một module; trả null khi không còn trang nào. */
export function filterModule(
  module: NavModule,
  access: NavAccess,
  options: FilterOptions = {}
): NavModule | null {
  if (!ruleAllows(module, access)) return null;
  const groups = module.groups
    .filter((group) => ruleAllows(group, access))
    .map((group) => ({
      ...group,
      pages: group.pages
        .filter((page) => ruleAllows(page, access))
        .filter(
          (page) => options.ignorePolicy || !hiddenByPolicy(page, options.policy, access.roles)
        )
        .map((page) => ({
          ...page,
          actions: page.actions?.filter((action) => ruleAllows(action, access)),
        })),
    }))
    .filter((group) => group.pages.length > 0);
  return groups.length ? { ...module, groups } : null;
}

export function filterModules(
  modules: readonly NavModule[],
  access: NavAccess,
  options?: FilterOptions
): NavModule[] {
  return modules.map((m) => filterModule(m, access, options)).filter((m): m is NavModule => !!m);
}

/** Làm phẳng cây đã lọc (giữ thứ tự module → nhóm → trang). Khoá trùng chỉ giữ lần đầu. */
export function flattenModules(modules: readonly (NavModule | null)[]): NavFlatPage[] {
  const out: NavFlatPage[] = [];
  const seen = new Set<string>();
  modules.forEach((module) => {
    if (!module) return;
    module.groups.forEach((group) =>
      group.pages.forEach((page) => {
        if (seen.has(page.key)) return;
        seen.add(page.key);
        out.push({
          key: page.key,
          title: page.title,
          path: page.path,
          match: page.match,
          exact: page.exact,
          keywords: page.keywords,
          actions: page.actions ?? [],
          moduleKey: module.key,
          moduleTitle: module.title,
          moduleIcon: module.icon,
          groupTitle: group.title,
        });
      })
    );
  });
  return out;
}

// ----------------------------------------------------------------------

function stripQuery(path: string) {
  const i = path.indexOf('?');
  return i < 0 ? path : path.slice(0, i);
}

function trimSlash(path: string) {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/** Độ dài phần khớp của `pathname` với trang (0 = không khớp). Khớp theo tiền tố đoạn đường dẫn, dài nhất thắng. */
function matchLength(
  page: Pick<NavFlatPage, 'path' | 'match' | 'exact'>,
  pathname: string,
  search?: string
): number {
  const current = trimSlash(pathname);
  const pagePath = stripQuery(page.path);
  const pageQuery = page.path.includes('?') ? page.path.slice(page.path.indexOf('?')) : '';
  let best = 0;
  [page.path, ...(page.match ?? [])].forEach((candidate, index) => {
    const base = trimSlash(index === 0 ? pagePath : stripQuery(candidate));
    const exact = index === 0 && page.exact;
    // Trang mở theo tab (?tab=…): chỉ khớp khi đúng tab đó.
    if (index === 0 && pageQuery && !(search ?? '').includes(pageQuery.slice(1))) return;
    const ok = exact ? current === base : current === base || current.startsWith(`${base}/`);
    if (ok) best = Math.max(best, base.length + (pageQuery && index === 0 ? 1 : 0));
  });
  return best;
}

/** Trang đang mở: khớp dài nhất trong danh sách. */
export function findActivePage<T extends Pick<NavFlatPage, 'path' | 'match' | 'exact'>>(
  pages: readonly T[],
  pathname: string | null | undefined,
  search?: string
): T | null {
  if (!pathname) return null;
  let best: T | null = null;
  let bestLen = 0;
  pages.forEach((page) => {
    const len = matchLength(page, pathname, search);
    if (len > bestLen) {
      best = page;
      bestLen = len;
    }
  });
  return best;
}

/** Bỏ dấu tiếng Việt + chữ thường — để gõ "nhap hang" ra "Nhập hàng". */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}
