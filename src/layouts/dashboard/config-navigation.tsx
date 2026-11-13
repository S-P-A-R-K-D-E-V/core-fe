import { useMemo } from 'react';

import { useCounterSession } from 'src/sections/counter/counter-scope';

import { useStoreBrand } from 'src/components/branding';

import { useAuthContext } from 'src/auth/hooks';
import { getUserRoles, normalizeRoles } from 'src/auth/roles';

import { menuBranchTypes, useWorkingBranch } from 'src/store/working-branch-store';

import { filterModule, filterModules, flattenModules } from './nav/nav-filter';
import {
  buildMeModule,
  buildCounterModule,
  buildSettingsModule,
  buildBusinessModules,
} from './nav/nav-config';

import type { NavTree, NavAccess, NavMenuPolicy } from './nav/nav-types';

// ----------------------------------------------------------------------
// Dữ liệu menu quản trị cho người đang đăng nhập: cây module đã lọc theo tính năng cửa hàng, loại chi nhánh, tính năng
// web/app, vai trò + quyền (Core-be), và "Menu theo vai trò" (GET /users/me → navMenu). Dùng chung cho thanh ngang,
// thanh bên, ngăn kéo mobile, ô tìm nhanh, ghim và trang mở đầu. Cây đầy đủ: ./nav/nav-config.ts.
// ----------------------------------------------------------------------

function cleanPolicy(raw: unknown): NavMenuPolicy | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<NavMenuPolicy>;
  const list = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return {
    hiddenKeys: list(value.hiddenKeys),
    pinnedKeys: list(value.pinnedKeys),
    homeKey: typeof value.homeKey === 'string' ? value.homeKey : null,
    hideFromSearch: value.hideFromSearch === true,
  };
}

/**
 * `roles`: mọi vai trò của người dùng — chưa có vai trò (đang nạp) → cây đầy đủ chưa lọc.
 * `permissions`: quyền hiệu lực (GET /users/me); Admin luôn đủ quyền.
 * `navMenu`: "Menu theo vai trò" đã gộp (GET /users/me).
 */
export function useNavModules(
  roles?: string | readonly string[],
  enabledFeatures?: readonly string[],
  permissions?: readonly string[],
  blockedFeatures?: readonly string[],
  navMenu?: unknown
): NavTree {
  // Khoá chuỗi cho deps: mảng tạo mới mỗi lần render.
  const rolesKey = normalizeRoles(roles as string[] | undefined).join('|');
  const featuresKey = (enabledFeatures ?? []).join('|');
  const permissionsKey = permissions ? permissions.join('|') : '\u0000';
  const blockedKey = (blockedFeatures ?? []).join('|');
  const policyKey = JSON.stringify(navMenu ?? null);

  const { isCiCi } = useStoreBrand();
  const branch = useWorkingBranch((s) => s.branch);
  const branchOptions = useWorkingBranch((s) => s.options);
  const counter = useCounterSession();

  return useMemo(() => {
    const userRoles = rolesKey ? rolesKey.split('|') : [];
    const business = buildBusinessModules();
    const settingsModule = buildSettingsModule(isCiCi);
    const meModule = buildMeModule();

    // Chưa nạp xong người dùng (SplashScreen đang hiện): trả cây đầy đủ.
    if (userRoles.length === 0) {
      const all = [...business, settingsModule, meModule];
      const pages = flattenModules(all);
      return {
        modules: business,
        settings: settingsModule,
        me: meModule,
        pages,
        searchable: pages,
        rolePins: [],
        homeKey: null,
        counter,
      };
    }

    const access: NavAccess = {
      roles: userRoles,
      permissions:
        permissionsKey === '\u0000' ? undefined : permissionsKey.split('|').filter(Boolean),
      blockedFeatures: blockedKey ? blockedKey.split('|') : [],
      // Chưa nạp /users/me → coi như chưa bật gì, tránh nháy hiện rồi ẩn khi cửa hàng tắt tính năng.
      enabledFeatures: featuresKey ? featuresKey.split('|') : [],
      branchTypes: menuBranchTypes(userRoles, branch, branchOptions),
    };

    // Máy quầy: chỉ bán hàng — không lọc theo vai trò (ai đăng nhập cũng vậy), vẫn lọc theo tính năng và chi nhánh.
    if (counter) {
      const counterAccess: NavAccess = { ...access, roles: ['Admin'], permissions: undefined };
      const module = filterModule(buildCounterModule(), counterAccess);
      const pages = flattenModules([module]);
      return {
        modules: module ? [module] : [],
        settings: null,
        me: null,
        pages,
        searchable: pages,
        rolePins: [],
        homeKey: pages[0]?.key ?? null,
        counter,
      };
    }

    const policy = cleanPolicy(JSON.parse(policyKey));
    const modules = filterModules(business, access, { policy });
    const settings = filterModule(settingsModule, access, { policy });
    const me = filterModule(meModule, access, { policy });
    const pages = flattenModules([...modules, settings, me]);

    // Ô tìm nhanh: mục chủ cửa hàng ẩn khỏi menu vẫn tìm được (người này vẫn có quyền), trừ khi chọn ẩn cả tìm kiếm.
    const searchable = policy?.hideFromSearch
      ? pages
      : flattenModules([
          ...filterModules(business, access, { ignorePolicy: true }),
          filterModule(settingsModule, access, { ignorePolicy: true }),
          filterModule(meModule, access, { ignorePolicy: true }),
        ]);

    const visibleKeys = new Set(pages.map((p) => p.key));
    return {
      modules,
      settings,
      me,
      pages,
      searchable,
      rolePins: (policy?.pinnedKeys ?? []).filter((key) => visibleKeys.has(key)),
      homeKey: policy?.homeKey && visibleKeys.has(policy.homeKey) ? policy.homeKey : null,
      counter,
    };
  }, [
    rolesKey,
    featuresKey,
    permissionsKey,
    blockedKey,
    policyKey,
    isCiCi,
    branch,
    branchOptions,
    counter,
  ]);
}

/** Cây menu của người đang đăng nhập. */
export function useNavTree(): NavTree {
  const { user } = useAuthContext();
  return useNavModules(
    getUserRoles(user),
    user?.enabledFeatures,
    user?.permissions,
    user?.blockedFeatures,
    user?.navMenu
  );
}
