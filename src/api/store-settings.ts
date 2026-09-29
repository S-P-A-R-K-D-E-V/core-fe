import axios from 'src/utils/axios';

// ----------------------------------------------------------------------
// Cài đặt cửa hàng (chỉ Admin): thương hiệu, kết nối KiotViet riêng, khoá API cho agent/MCP.
// ----------------------------------------------------------------------

export interface IStoreBranding {
  storeName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  shortDescription: string | null;
  address: string | null;
  messengerLink: string | null;
  zaloLink: string | null;
  contactInfoJson: string | null;
}

export interface IKiotVietConnection {
  connected: boolean;
  /** "store": cửa hàng tự kết nối; "system": CiCi dùng cấu hình hệ thống (không ngắt ở đây). */
  source: 'store' | 'system';
  retailer: string | null;
  clientId: string | null;
  webhookReady: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
}

export interface IAgentKey {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  active: boolean;
}

export async function getStoreBranding(): Promise<IStoreBranding> {
  const res = await axios.get<IStoreBranding>('/store-settings/branding');
  return res.data;
}

export async function saveStoreBranding(data: IStoreBranding): Promise<void> {
  await axios.put('/store-settings/branding', data);
}

export async function getKiotVietConnection(): Promise<IKiotVietConnection> {
  const res = await axios.get<IKiotVietConnection>('/kiotviet/connection');
  return res.data;
}

export async function saveKiotVietConnection(data: {
  retailer: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ connection: IKiotVietConnection; branchCount: number }> {
  const res = await axios.put('/kiotviet/connection', data);
  return res.data;
}

export async function disconnectKiotViet(): Promise<void> {
  await axios.delete('/kiotviet/connection');
}

export async function listAgentKeys(): Promise<IAgentKey[]> {
  const res = await axios.get<IAgentKey[]>('/agent-keys');
  return res.data;
}

export async function getAgentPermissionCatalog(): Promise<{
  domains: string[];
  permissions: string[];
}> {
  const res = await axios.get('/agent-keys/permissions');
  return res.data;
}

export interface ICreatedAgentKey {
  key: string;
  details: IAgentKey;
}

/** Một phiên MCP (agent kết nối tới <tên miền cửa hàng>/api/mcp). */
export interface IMcpSession {
  id: string;
  keyName: string;
  keyPrefix: string;
  clientName: string | null;
  clientVersion: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastActivityAt: string;
  closedAt: string | null;
  callCount: number;
  errorCount: number;
}

export interface IMcpCall {
  id: string;
  tool: string;
  arguments: string | null;
  status: 'ok' | 'error' | 'denied' | 'needs_confirm' | string;
  httpStatus: number | null;
  error: string | null;
  durationMs: number;
  createdAt: string;
}

export async function listMcpSessions(): Promise<IMcpSession[]> {
  const res = await axios.get<IMcpSession[]>('/agent-keys/mcp-sessions');
  return res.data;
}

export async function listMcpCalls(sessionId: string): Promise<IMcpCall[]> {
  const res = await axios.get<IMcpCall[]>(`/agent-keys/mcp-sessions/${sessionId}/calls`);
  return res.data;
}

export async function createAgentKey(data: {
  name: string;
  permissions: string[];
  expiresInDays: number;
}): Promise<ICreatedAgentKey> {
  const res = await axios.post('/agent-keys', data);
  return res.data;
}

export async function revokeAgentKey(id: string): Promise<void> {
  await axios.delete(`/agent-keys/${id}`);
}

export async function deleteMyAccount(): Promise<void> {
  await axios.delete('/auth/account', { data: { confirm: true } });
}

/** Tải logo lên bucket (thư mục branding/ của cửa hàng) và dùng làm logo luôn. */
export async function uploadStoreLogo(file: File): Promise<{ logoUrl: string }> {
  const form = new FormData();
  form.append('logo', file);
  const res = await axios.post('/store-settings/branding/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

/** Thử kết nối KiotViet không lưu. Không truyền gì = thử bộ đang dùng. */
export async function testKiotVietConnection(data?: {
  retailer: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ ok: boolean; branchCount: number; message: string }> {
  const res = await axios.post('/kiotviet/connection/test', data ?? {});
  return res.data;
}
