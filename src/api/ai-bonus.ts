import axios, { endpoints } from 'src/utils/axios';

import { readSse } from './sse';

// ----------------------------------------------------------------------
// Agent AI tính thưởng theo mô tả: chạy dạng stream qua route /ai-bonus-stream/* của Next (không qua rewrites — proxy đó cắt
// kết nối khi AI chạy lâu), nhận từng bước rồi bản nháp đã lưu. Áp dụng = tạo thưởng nhập tay của một kỳ lương.
// ----------------------------------------------------------------------

export type AiBonusPeriodKind = 'Day' | 'Week' | 'Month' | 'Custom';
export type AiBonusRunStatus = 'Draft' | 'Applied' | 'Discarded' | 'Failed';

export interface IAiBonusLine {
  userId: string;
  fullName: string;
  amount: number;
  formula: string;
  explanation: string;
}

export interface IAiBonusRun {
  id: string;
  title: string;
  prompt: string;
  periodKind: AiBonusPeriodKind;
  from: string;
  to: string;
  staffIds?: string[] | null;
  status: AiBonusRunStatus;
  summary?: string | null;
  lines: IAiBonusLine[];
  total: number;
  error?: string | null;
  createdAt: string;
  payrollCycleId?: string | null;
  appliedAt?: string | null;
  appliedTotal?: number | null;
}

export interface IAiBonusStreamResult {
  run: IAiBonusRun;
  dropped: string[];
  staffCount: number;
}

export interface IAiBonusRunRequest {
  title: string;
  prompt: string;
  periodKind: AiBonusPeriodKind;
  from: string;
  to: string;
  staffIds: string[] | null;
}

export class AiBonusError extends Error {}

export async function streamAiBonusRun(
  body: IAiBonusRunRequest,
  onStep: (text: string) => void,
  signal?: AbortSignal
): Promise<IAiBonusStreamResult> {
  const auth = axios.defaults.headers.common.Authorization;
  const res = await fetch('/ai-bonus-stream/runs/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(typeof auth === 'string' && { Authorization: auth }),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = `Chưa chạy được (${res.status}) — thử lại sau ít phút.`;
    if (res.status === 401 || res.status === 403) message = 'Phiên đăng nhập hết hạn hoặc không có quyền — tải lại trang.';
    else if (res.status === 400) message = (await res.json().catch(() => null))?.error ?? message;
    throw new AiBonusError(message);
  }

  let result: IAiBonusStreamResult | undefined;
  const finished = await readSse(res.body, (event, payload) => {
    if (event === 'result') {
      result = payload as IAiBonusStreamResult;
      return true;
    }
    if (event === 'error') throw new AiBonusError(payload.message ?? 'Agent chưa tính được thưởng.');
    if (event === 'step' && payload.text) onStep(payload.text);
    return false;
  });
  if (finished && result) return result;
  throw new AiBonusError('Kết nối bị ngắt trước khi Agent tính xong — chạy lại.');
}

export async function getAiBonusRuns(): Promise<IAiBonusRun[]> {
  const response = await axios.get<IAiBonusRun[]>(endpoints.aiBonus.runs);
  return response.data;
}

export async function applyAiBonusRun(
  id: string,
  payrollCycleId: string,
  lines: { userId: string; amount: number }[]
): Promise<IAiBonusRun> {
  const response = await axios.post<IAiBonusRun>(endpoints.aiBonus.apply(id), { payrollCycleId, lines });
  return response.data;
}

export async function discardAiBonusRun(id: string): Promise<IAiBonusRun> {
  const response = await axios.post<IAiBonusRun>(endpoints.aiBonus.discard(id));
  return response.data;
}
