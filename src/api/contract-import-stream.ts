import axios from 'src/utils/axios';

import type { IContractTemplate, IContractTemplateImport } from 'src/types/hr';

import { readSse } from './sse';

// ----------------------------------------------------------------------
// Tải mẫu hợp đồng (.docx / .pdf) dạng stream qua route /contract-templates-ai/* của Next (không qua rewrites — proxy đó cắt
// kết nối khi AI chạy lâu): nhận từng bước, nội dung đọc được (đã lưu vào bản nháp) ngay khi có, rồi bản có trường.
// ----------------------------------------------------------------------

export type ContractImportEvent =
  | { type: 'step'; key: string; text: string }
  /** Nội dung đọc được từ tệp — đã lưu vào bản nháp; AI gắn trường còn chạy tiếp. */
  | { type: 'content'; template: IContractTemplate };

export class ContractImportError extends Error {}

export async function streamContractTemplateImport(
  templateId: string,
  body: { objectKey: string; fileName: string },
  onEvent: (e: ContractImportEvent) => void,
  signal?: AbortSignal
): Promise<IContractTemplateImport> {
  const auth = axios.defaults.headers.common.Authorization;
  const res = await fetch(`/contract-templates-ai/templates/${templateId}/import/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(typeof auth === 'string' && { Authorization: auth }),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new ContractImportError(
      res.status === 401 || res.status === 403
        ? 'Phiên đăng nhập hết hạn hoặc không có quyền — tải lại trang.'
        : `Chưa đọc được mẫu (${res.status}) — thử lại sau ít phút.`
    );
  }

  let result: IContractTemplateImport | undefined;
  const finished = await readSse(res.body, (event, payload) => {
    if (event === 'result') {
      result = payload as IContractTemplateImport;
      return true;
    }
    if (event === 'error') throw new ContractImportError(payload.message ?? 'Không đọc được tệp mẫu.');
    if (event === 'step') onEvent({ type: 'step', key: payload.key, text: payload.text });
    else if (event === 'content' && payload.template) onEvent({ type: 'content', template: payload.template });
    return false;
  });
  if (finished && result) return result;
  throw new ContractImportError('Kết nối bị ngắt trước khi AI gắn xong trường — nội dung đọc được (nếu có) đã lưu vào bản nháp.');
}
