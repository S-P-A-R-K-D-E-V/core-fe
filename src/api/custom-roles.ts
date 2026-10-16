import axios, { endpoints } from 'src/utils/axios';

import type {
  ICustomRole,
  IPermissionCatalog,
  ICustomRoleRequest,
  IUserRoleAssignment,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// Vai trò tuỳ chỉnh của cửa hàng (Core-be /custom-roles, chỉ Admin) + danh mục quyền (/permissions/catalog).
// ----------------------------------------------------------------------

export async function getPermissionCatalog(): Promise<IPermissionCatalog> {
  const response = await axios.get<IPermissionCatalog>(endpoints.permissions.catalog);
  return response.data;
}

export async function getCustomRoles(): Promise<ICustomRole[]> {
  const response = await axios.get<ICustomRole[]>(endpoints.customRoles.list);
  return response.data;
}

export async function createCustomRole(data: ICustomRoleRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.customRoles.create, data);
  return response.data;
}

export async function updateCustomRole(id: string, data: ICustomRoleRequest): Promise<void> {
  await axios.put(endpoints.customRoles.update(id), data);
}

export async function deleteCustomRole(id: string): Promise<void> {
  await axios.delete(endpoints.customRoles.delete(id));
}

export async function getUserRoleAssignment(userId: string): Promise<IUserRoleAssignment> {
  const response = await axios.get<IUserRoleAssignment>(endpoints.customRoles.userAssignment(userId));
  return response.data;
}

export async function setUserCustomRoles(userId: string, customRoleIds: string[]): Promise<void> {
  await axios.put(endpoints.customRoles.userAssignment(userId), { customRoleIds });
}

/** Tên hiển thị của vai trò hệ thống / vai trò gốc. */
export const SYSTEM_ROLE_LABELS: Record<string, string> = {
  Admin: 'Chủ cửa hàng (Admin)',
  Manager: 'Quản lý (Manager)',
  Staff: 'Nhân viên (Staff)',
  User: 'Người dùng (User)',
};
