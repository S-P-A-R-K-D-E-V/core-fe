import axios, { endpoints } from 'src/utils/axios';
import {
  IRole,
  IPermission,
  ICreateRoleRequest,
  IUpdateRoleRequest,
  IAssignRoleRequest,
  IUserPermissions,
} from 'src/types/corecms-api';

// -------------------------------------------------------
// Roles API
// -------------------------------------------------------

export async function getAllRoles(): Promise<IRole[]> {
  const response = await axios.get<IRole[]>(endpoints.roles.list);
  return response.data;
}

export async function getRoleById(id: string): Promise<IRole> {
  const response = await axios.get<IRole>(endpoints.roles.details(id));
  return response.data;
}

export async function createRole(data: ICreateRoleRequest): Promise<{ id: string }> {
  const response = await axios.post<{ id: string }>(endpoints.roles.create, data);
  return response.data;
}

export async function updateRole(id: string, data: IUpdateRoleRequest): Promise<void> {
  await axios.put(endpoints.roles.update(id), data);
}

export async function deleteRole(id: string): Promise<void> {
  await axios.delete(endpoints.roles.delete(id));
}

export async function assignRoles(data: IAssignRoleRequest): Promise<void> {
  await axios.post(endpoints.roles.assign, data);
}

// -------------------------------------------------------
// Permissions API
// -------------------------------------------------------

export async function getAllPermissions(): Promise<IPermission[]> {
  const response = await axios.get<IPermission[]>(endpoints.permissions.list);
  return response.data;
}

export async function getUserPermissions(userId: string): Promise<IUserPermissions> {
  const response = await axios.get<IUserPermissions>(endpoints.permissions.userPermissions(userId));
  return response.data;
}

export async function getMyPermissions(): Promise<IUserPermissions> {
  const response = await axios.get<IUserPermissions>(endpoints.permissions.myPermissions);
  return response.data;
}
