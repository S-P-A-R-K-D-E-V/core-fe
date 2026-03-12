import axios, { endpoints } from 'src/utils/axios';
import {
  ICheckinFaceRequest,
  ICheckinFaceResponse,
  INotificationConfig,
  ICreateNotificationConfigRequest,
  IUpdateNotificationConfigRequest,
} from 'src/types/corecms-api';

// ── Checkin Face ──

export async function checkinFace(data: ICheckinFaceRequest): Promise<ICheckinFaceResponse> {
  const response = await axios.post<ICheckinFaceResponse>(endpoints.checkinFace.face, data);
  return response.data;
}

// ── Notification Config ──

export async function getNotificationConfigs(): Promise<INotificationConfig[]> {
  const response = await axios.get<INotificationConfig[]>(endpoints.notificationConfig.list);
  return response.data;
}

export async function createNotificationConfig(
  data: ICreateNotificationConfigRequest
): Promise<INotificationConfig> {
  const response = await axios.post<INotificationConfig>(endpoints.notificationConfig.create, data);
  return response.data;
}

export async function updateNotificationConfig(
  id: string,
  data: IUpdateNotificationConfigRequest
): Promise<INotificationConfig> {
  const response = await axios.put<INotificationConfig>(endpoints.notificationConfig.update(id), data);
  return response.data;
}
