import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Link mời nhân viên (core-be StaffInvitesController). Mã link chỉ trả MỘT lần lúc tạo — server giữ SHA-256.

export type StaffInviteRole = 'Staff' | 'Manager';
export type StaffInviteStatus = 'Pending' | 'Accepted' | 'Revoked' | 'Expired';

export type StaffInvite = {
  id: string;
  role: StaffInviteRole;
  status: StaffInviteStatus;
  branchIds: string[];
  email: string | null;
  note: string | null;
  expiresAt: string;
  createdAt: string;
  createdByName: string | null;
  acceptedAt: string | null;
  acceptedBy: { id: string; name: string; email: string } | null;
  revokedAt: string | null;
};

export type CreateStaffInviteInput = {
  role: StaffInviteRole;
  branchIds?: string[];
  email?: string;
  note?: string;
  expiresInHours: number;
};

export type StaffInvitePreview = {
  storeName: string;
  role: StaffInviteRole;
  status: StaffInviteStatus;
  expiresAt: string;
  emailHint: string | null;
  branchNames: string[];
};

export async function createStaffInvite(input: CreateStaffInviteInput): Promise<{ token: string; invite: StaffInvite }> {
  const res = await axios.post(endpoints.staffInvites.root, input);
  return res.data;
}

export async function listStaffInvites(): Promise<StaffInvite[]> {
  const res = await axios.get<StaffInvite[]>(endpoints.staffInvites.root);
  return res.data;
}

export async function revokeStaffInvite(id: string): Promise<void> {
  await axios.delete(endpoints.staffInvites.revoke(id));
}

/** Xem trước link (ẩn danh) — trang /invite/[token]. */
export async function previewStaffInvite(token: string): Promise<StaffInvitePreview> {
  const res = await axios.post<StaffInvitePreview>(endpoints.staffInvites.preview, { token });
  return res.data;
}

/** Link mời trên tên miền cửa hàng đang mở. */
export function staffInviteUrl(token: string, origin = typeof window === 'undefined' ? '' : window.location.origin) {
  return `${origin}/invite/${token}`;
}

export const STAFF_INVITE_ROLE_LABEL: Record<StaffInviteRole, string> = {
  Staff: 'Nhân viên',
  Manager: 'Quản lý',
};

export const STAFF_INVITE_STATUS_LABEL: Record<StaffInviteStatus, string> = {
  Pending: 'Chờ nhận',
  Accepted: 'Đã nhận',
  Revoked: 'Đã thu hồi',
  Expired: 'Hết hạn',
};
