import axios, { endpoints } from 'src/utils/axios';
import {
  IUser,
  IUpdateUserRequest,
  IUpdateProfileRequest,
  IChangeUserStatusRequest,
  IResetPasswordRequest,
  IChangePasswordRequest,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

// Admin endpoints

export async function getAllUsers(): Promise<IUser[]> {
  const response = await axios.get<IUser[]>(endpoints.users.list);
  return response.data;
}

export async function getUserById(id: string): Promise<IUser> {
  const response = await axios.get<IUser>(endpoints.users.details(id));
  return response.data;
}

export async function updateUser(id: string, data: IUpdateUserRequest): Promise<void> {
  await axios.put(endpoints.users.update(id), data);
}

export async function setSchedulingPriority(id: string, priority: number): Promise<void> {
  await axios.put(endpoints.users.schedulingPriority(id), { priority });
}

export async function deleteUser(id: string): Promise<void> {
  await axios.delete(endpoints.users.delete(id));
}

export async function changeUserStatus(id: string, data: IChangeUserStatusRequest): Promise<void> {
  await axios.patch(endpoints.users.changeStatus(id), data);
}

export async function resetUserPassword(id: string, data: IResetPasswordRequest): Promise<void> {
  await axios.post(endpoints.users.resetPassword(id), data);
}

// Self-service endpoints

export async function getCurrentUser(): Promise<IUser> {
  const response = await axios.get<IUser>(endpoints.users.me);
  return response.data;
}

export async function updateMyProfile(data: IUpdateProfileRequest): Promise<void> {
  await axios.put(endpoints.users.updateProfile, data);
}

export async function changeMyPassword(data: IChangePasswordRequest): Promise<void> {
  await axios.post(endpoints.users.changePassword, data);
}

export async function uploadUserIdCard(
  id: string,
  idCardFront?: File,
  idCardBack?: File
): Promise<{ frontObjectKey?: string; backObjectKey?: string }> {
  const formData = new FormData();
  if (idCardFront) formData.append('idCardFront', idCardFront);
  if (idCardBack)  formData.append('idCardBack',  idCardBack);
  const res = await axios.post<{ frontObjectKey?: string; backObjectKey?: string }>(
    endpoints.users.uploadIdCard(id),
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data;
}

export async function uploadMyIdCard(
  idCardFront?: File,
  idCardBack?: File
): Promise<{ frontObjectKey?: string; backObjectKey?: string }> {
  const formData = new FormData();
  if (idCardFront) formData.append('idCardFront', idCardFront);
  if (idCardBack)  formData.append('idCardBack',  idCardBack);
  const res = await axios.post<{ frontObjectKey?: string; backObjectKey?: string }>(
    endpoints.users.uploadMyIdCard,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data;
}

export async function uploadMyAvatar(file: File): Promise<{ objectKey: string }> {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await axios.post<{ objectKey: string }>(endpoints.users.uploadAvatar, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}
