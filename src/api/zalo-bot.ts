import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Zalo Bot chỉ để báo việc agent cần quyết (A3, core-be /zalo-bot/*, quyền Admin như notification/config).
// Hợp đồng: docs/cici/plans/a3-zalo-bao-api-contract.md mục 1.
// ----------------------------------------------------------------------

export interface IZaloBotCheckResult {
  ok: boolean;
  botName?: string | null;
  botId?: string | null;
  message?: string | null;
}

export interface IZaloBotChat {
  chatId: string;
  /** Zalo trả "PRIVATE" / "GROUP"… — để nguyên chuỗi. */
  chatType?: string | null;
  name?: string | null;
  /** Tin gần nhất người đó nhắn bot. */
  text?: string | null;
}

export interface IZaloBotUpdatesResult {
  ok: boolean;
  chats: IZaloBotChat[];
  message?: string | null;
}

export interface IZaloBotTestSendResult {
  ok: boolean;
  message?: string | null;
}

export async function checkZaloBotToken(token: string): Promise<IZaloBotCheckResult> {
  const res = await axios.post<IZaloBotCheckResult>(endpoints.zaloBot.check, { token });
  return res.data;
}

export async function getZaloBotUpdates(token: string): Promise<IZaloBotUpdatesResult> {
  const res = await axios.post<IZaloBotUpdatesResult>(endpoints.zaloBot.updates, { token });
  return { ...res.data, chats: res.data?.chats ?? [] };
}

export async function testSendZaloBot(
  token: string,
  chatId: string
): Promise<IZaloBotTestSendResult> {
  const res = await axios.post<IZaloBotTestSendResult>(endpoints.zaloBot.testSend, {
    token,
    chatId,
  });
  return res.data;
}
