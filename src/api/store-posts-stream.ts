import { useRef, useState, useCallback } from 'react';

import axios from 'src/utils/axios';

import { readSse } from './sse';

// ----------------------------------------------------------------------
// Lệnh AI viết bài dạng stream (Server-Sent Events) qua route /store-posts-ai/* của Next: nhận dần bước đang làm, suy nghĩ
// của model (nếu có), chữ đang viết, rồi kết quả — trang hiện tiến trình thay vòng xoay.
// ----------------------------------------------------------------------

export type AiStreamPath =
  | 'ai/ideas/stream'
  | 'ai/draft/stream'
  | 'ai/rewrite/stream'
  | 'ai/seo/stream'
  | 'images/generate/stream';

export type AiStreamEvent =
  | { type: 'step'; key: string; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'delta'; text: string };

export class AiStreamError extends Error {}

/** Gọi một lệnh AI dạng stream; onEvent nhận từng sự kiện tiến trình, Promise trả kết quả cuối (hoặc ném AiStreamError). */
export async function streamStorePostAi<T>(
  path: AiStreamPath,
  body: unknown,
  onEvent: (e: AiStreamEvent) => void,
  signal?: AbortSignal
): Promise<T> {
  const auth = axios.defaults.headers.common.Authorization;
  const res = await fetch(`/store-posts-ai/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(typeof auth === 'string' && { Authorization: auth }),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new AiStreamError(
      res.status === 401 || res.status === 403
        ? 'Phiên đăng nhập hết hạn hoặc không có quyền — tải lại trang.'
        : `AI chưa chạy được (${res.status}) — thử lại sau ít phút.`
    );
  }

  let result: T | undefined;
  const finished = await readSse(res.body, (event, payload) => {
    if (event === 'result') {
      result = payload as T;
      return true;
    }
    if (event === 'error') throw new AiStreamError(payload.message ?? 'AI gặp lỗi — thử lại.');
    if (event === 'step') onEvent({ type: 'step', key: payload.key, text: payload.text });
    else if (event === 'thinking') onEvent({ type: 'thinking', text: payload.text ?? '' });
    else if (event === 'delta') onEvent({ type: 'delta', text: payload.text ?? '' });
    return false;
  });
  if (finished) return result as T;
  throw new AiStreamError('Kết nối tới AI bị ngắt giữa chừng — thử lại.');
}

// ----------------------------------------------------------------------

export type AiStep = { key: string; text: string; done: boolean };

export type AiProgress = {
  busy: boolean;
  steps: AiStep[];
  thinking: string;
  text: string;
  error: string;
};

const IDLE: AiProgress = { busy: false, steps: [], thinking: '', text: '', error: '' };

/**
 * Chạy lệnh AI dạng stream và giữ tiến trình (bước, suy nghĩ, chữ đang viết) để hiện lên giao diện. Lỗi nằm ở
 * progress.error và run trả null; rethrow = ném lại lỗi cho nơi gọi tự báo (huỷ thì vẫn trả null).
 */
export function useAiStream() {
  const [progress, setProgress] = useState<AiProgress>(IDLE);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async <T>(path: AiStreamPath, body: unknown, rethrow = false): Promise<T | null> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress({ ...IDLE, busy: true });

    try {
      const result = await streamStorePostAi<T>(
        path,
        body,
        (e) =>
          setProgress((p) => {
            if (e.type === 'step')
              return {
                ...p,
                steps: [...p.steps.map((s) => ({ ...s, done: true })), { key: e.key, text: e.text, done: false }],
              };
            if (e.type === 'thinking') return { ...p, thinking: p.thinking + e.text };
            return { ...p, text: p.text + e.text };
          }),
        controller.signal
      );
      setProgress((p) => ({ ...p, busy: false, steps: p.steps.map((s) => ({ ...s, done: true })) }));
      return result;
    } catch (err) {
      if (controller.signal.aborted) {
        setProgress(IDLE);
        return null;
      }
      const message = err instanceof Error && err.message ? err.message : 'AI gặp lỗi — thử lại.';
      setProgress((p) => ({ ...p, busy: false, error: message }));
      if (rethrow) throw new AiStreamError(message);
      return null;
    }
  }, []);

  const cancel = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => setProgress(IDLE), []);

  return { progress, run, cancel, reset };
}
