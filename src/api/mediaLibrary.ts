import axios, { endpoints } from 'src/utils/axios';

import type {
  IPagedChatAttachmentMedia,
  IPagedCleaningPhotoMedia,
  IPagedUserAvatarMedia,
  IPagedUserIdCardMedia,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

export async function getCleaningPhotos(params: {
  fromDate?: string;
  toDate?: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<IPagedCleaningPhotoMedia> {
  const response = await axios.get<IPagedCleaningPhotoMedia>(endpoints.mediaLibrary.cleaningPhotos, { params });
  return response.data;
}

export async function deleteCleaningPhoto(id: string): Promise<void> {
  await axios.delete(endpoints.mediaLibrary.deleteCleaningPhoto(id));
}

export async function getChatAttachments(params: {
  fromDate?: string;
  toDate?: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<IPagedChatAttachmentMedia> {
  const response = await axios.get<IPagedChatAttachmentMedia>(endpoints.mediaLibrary.chatAttachments, { params });
  return response.data;
}

export async function deleteChatAttachment(messageId: string, objectKey: string): Promise<void> {
  await axios.post(endpoints.mediaLibrary.deleteChatAttachment, { messageId, objectKey });
}

export async function getUserAvatars(params: {
  search?: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<IPagedUserAvatarMedia> {
  const response = await axios.get<IPagedUserAvatarMedia>(endpoints.mediaLibrary.userAvatars, { params });
  return response.data;
}

export async function deleteUserAvatar(userId: string): Promise<void> {
  await axios.delete(endpoints.mediaLibrary.deleteUserAvatar(userId));
}

export async function getUserIdCards(params: {
  search?: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<IPagedUserIdCardMedia> {
  const response = await axios.get<IPagedUserIdCardMedia>(endpoints.mediaLibrary.userIdCards, { params });
  return response.data;
}

export async function deleteUserIdCard(userId: string, side: 'front' | 'back'): Promise<void> {
  await axios.delete(endpoints.mediaLibrary.deleteUserIdCard(userId), { params: { side } });
}
