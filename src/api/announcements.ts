import axios, { endpoints } from 'src/utils/axios';

import type {
  IAnnouncement,
  ISaveAnnouncement,
  IAnnouncementSaved,
  IAnnouncementStaff,
  IPendingAnnouncement,
  IAnnouncementReceipts,
} from 'src/types/announcement';

// ----------------------------------------------------------------------
// Popup thông báo — Core-be /announcements. pending, seen, ack: mọi nhân viên; còn lại cần hr.announcement.manage (Admin).
// ----------------------------------------------------------------------

export async function getPendingAnnouncements(): Promise<IPendingAnnouncement[]> {
  const response = await axios.get<IPendingAnnouncement[]>(endpoints.announcements.pending);
  return response.data;
}

export async function markAnnouncementSeen(id: string): Promise<void> {
  await axios.post(endpoints.announcements.seen(id));
}

export async function acknowledgeAnnouncement(id: string): Promise<void> {
  await axios.post(endpoints.announcements.ack(id));
}

export async function getAnnouncements(): Promise<IAnnouncement[]> {
  const response = await axios.get<IAnnouncement[]>(endpoints.announcements.list);
  return response.data;
}

export async function getAnnouncementStaff(): Promise<IAnnouncementStaff[]> {
  const response = await axios.get<IAnnouncementStaff[]>(endpoints.announcements.audience);
  return response.data;
}

export async function saveAnnouncement(id: string | null, body: ISaveAnnouncement): Promise<IAnnouncementSaved> {
  const response = id
    ? await axios.put<IAnnouncementSaved>(endpoints.announcements.detail(id), body)
    : await axios.post<IAnnouncementSaved>(endpoints.announcements.list, body);
  return response.data;
}

/** Xoá mềm: không hiện nữa, giữ lại ai đã đọc. */
export async function deleteAnnouncement(id: string): Promise<void> {
  await axios.delete(endpoints.announcements.detail(id));
}

export async function getAnnouncementReceipts(id: string): Promise<IAnnouncementReceipts> {
  const response = await axios.get<IAnnouncementReceipts>(endpoints.announcements.receipts(id));
  return response.data;
}
