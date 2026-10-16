import axios, { endpoints } from 'src/utils/axios';
import { IRole, IAssignRoleRequest, IUserPermissions } from 'src/types/corecms-api';

// -------------------------------------------------------
// Vai trò hệ thống (danh mục chung: Admin/Manager/Staff/User) — chỉ đọc và gán. Vai trò riêng của cửa hàng: custom-roles.ts.
// -------------------------------------------------------

export async function getAllRoles(): Promise<IRole[]> {
  const response = await axios.get<IRole[]>(endpoints.roles.list);
  return response.data;
}

export async function assignRoles(data: IAssignRoleRequest): Promise<void> {
  await axios.post(endpoints.roles.assign, data);
}

// -------------------------------------------------------
// Permissions API
// -------------------------------------------------------

export async function getUserPermissions(userId: string): Promise<IUserPermissions> {
  const response = await axios.get<IUserPermissions>(endpoints.permissions.userPermissions(userId));
  return response.data;
}

export async function getMyPermissions(): Promise<IUserPermissions> {
  const response = await axios.get<IUserPermissions>(endpoints.permissions.myPermissions);
  return response.data;
}
