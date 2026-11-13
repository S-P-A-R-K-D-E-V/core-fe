import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------
// "Menu theo vai trò" (Core-be /nav-menu-policies, chỉ Admin) và tuỳ chọn giao diện của chính mình
// (/users/me/ui-preferences/{key}). Khoá menu là chuỗi của web (layouts/dashboard/nav/nav-config.ts) — Core-be không
// biết cây menu. Ẩn menu chỉ là giao diện, không đổi quyền API.
// ----------------------------------------------------------------------

/** Vai trò hệ thống ("Admin" | "Manager" | "Staff") hoặc vai trò tuỳ chỉnh "custom:{id}". */
export type NavRoleCode = string;

export const customRoleCode = (id: string): NavRoleCode => `custom:${id}`;

export type NavMenuPolicyItem = {
  roleCode: NavRoleCode;
  hiddenKeys: string[];
  pinnedKeys: string[];
  homeKey: string | null;
  hideFromSearch: boolean;
  updatedAt?: string | null;
};

export type NavMenuPolicyRequest = Omit<NavMenuPolicyItem, 'roleCode' | 'updatedAt'>;

export async function getNavMenuPolicies(): Promise<NavMenuPolicyItem[]> {
  const res = await axios.get<NavMenuPolicyItem[]>(endpoints.navMenuPolicies.list);
  return res.data ?? [];
}

export async function saveNavMenuPolicy(
  roleCode: NavRoleCode,
  body: NavMenuPolicyRequest
): Promise<NavMenuPolicyItem> {
  const res = await axios.put<NavMenuPolicyItem>(endpoints.navMenuPolicies.item(roleCode), body);
  return res.data;
}

export async function resetNavMenuPolicy(roleCode: NavRoleCode): Promise<void> {
  await axios.delete(endpoints.navMenuPolicies.item(roleCode));
}

// ----------------------------------------------------------------------

export type UiPreferenceKey = 'nav.pins' | 'nav.layout';

/** Giá trị đã lưu; null khi chưa lưu (404). Lỗi khác ném ra để nơi gọi bỏ qua đồng bộ. */
export async function getUiPreference<T>(key: UiPreferenceKey): Promise<T | null> {
  try {
    const res = await axios.get<{ key: string; value: T }>(endpoints.users.uiPreference(key));
    return res.data?.value ?? null;
  } catch (error: any) {
    if (error?.status === 404 || error?.response?.status === 404 || error?.statusCode === 404)
      return null;
    throw error;
  }
}

export async function putUiPreference<T>(key: UiPreferenceKey, value: T): Promise<void> {
  await axios.put(endpoints.users.uiPreference(key), { value });
}
