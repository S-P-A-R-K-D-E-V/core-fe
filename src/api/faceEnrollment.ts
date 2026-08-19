import axios, { endpoints } from 'src/utils/axios';
import {
  IEnrollQualityRequest,
  IEnrollQualityResponse,
  IEnrollPresignRequest,
  IEnrollPresignedFileResponse,
  IEnrollFaceBatchRequest,
  IFaceEmbeddingResponse,
  IVerifySelfRequest,
  IVerifySelfResponse,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------

/** Validate 1 ảnh chụp trong luồng đăng ký khuôn mặt có hướng dẫn tư thế — gọi ngay sau mỗi
 *  lần chụp để biết đủ góc/đã chớp mắt chưa trước khi coi tấm ảnh hợp lệ. */
export async function checkEnrollQuality(imageBase64: string): Promise<IEnrollQualityResponse> {
  const response = await axios.post<IEnrollQualityResponse>(endpoints.faceTracking.enrollQuality, {
    imageBase64,
  } satisfies IEnrollQualityRequest);
  return response.data;
}

function base64ToBlob(base64: string, contentType = 'image/jpeg'): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i += 1) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: contentType });
}

/** Gửi toàn bộ ảnh đã qua validate để đăng ký/cập nhật khuôn mặt — PUT thẳng từng ảnh lên R2
 *  qua presigned URL (không đi qua API/nginx, tránh 413 khi gộp nhiều ảnh base64 gốc camera
 *  vào 1 request JSON), rồi chỉ gửi object key cho BE tự tải về + tính embedding. */
export async function submitFaceEnrollment(imagesBase64: string[]): Promise<IFaceEmbeddingResponse> {
  const presignRes = await axios.post<IEnrollPresignedFileResponse[]>(endpoints.faceTracking.enrollPresign, {
    count: imagesBase64.length,
  } satisfies IEnrollPresignRequest);
  const presigned = presignRes.data;

  await Promise.all(
    presigned.map(async (p, i) => {
      const host = (() => {
        try {
          return new URL(p.uploadUrl).host;
        } catch {
          return '?';
        }
      })();
      let res: Response;
      try {
        res = await fetch(p.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: base64ToBlob(imagesBase64[i]),
        });
      } catch (err: any) {
        // fetch() reject (không phải HTTP status lỗi) — thường là CORS preflight bị chặn,
        // DNS/TLS lỗi, hoặc mất mạng giữa chừng. Log ra console để xem chi tiết qua DevTools
        // (message ở UI chỉ có "Load failed"/"Failed to fetch", không đủ để chẩn đoán).
        // eslint-disable-next-line no-console
        console.error('[face-enrollment] upload to R2 failed (network/CORS)', { host, objectKey: p.objectKey, err });
        throw new Error(`Không tải được ảnh lên R2 (mạng/CORS, host: ${host}) — ${err?.message ?? err}`);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Tải ảnh lên R2 thất bại (${res.status} ${host}): ${body.slice(0, 200)}`);
      }
    })
  );

  const response = await axios.post<IFaceEmbeddingResponse>(endpoints.faceTracking.enrollBatch, {
    objectKeys: presigned.map((p) => p.objectKey),
  } satisfies IEnrollFaceBatchRequest);
  return response.data;
}

/** Tự kiểm tra khuôn mặt hiện tại (video ngắn) có khớp với embedding đã đăng ký không —
 *  không tạo attendance log, chỉ để nhân viên tự chẩn đoán trước khi ra quầy chấm công. */
export async function verifySelfFace(videoBase64: string): Promise<IVerifySelfResponse> {
  const response = await axios.post<IVerifySelfResponse>(endpoints.faceTracking.verifySelf, {
    videoBase64,
  } satisfies IVerifySelfRequest);
  return response.data;
}
