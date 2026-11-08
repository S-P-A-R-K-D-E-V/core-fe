import type { ImageResult, ImageCatalog, ImageAnalysis } from 'src/lib/image-ai';

import useSWR from 'swr';

import axios, { fetcher } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Ảnh sản phẩm (core-be ProductImagesController, /products/{id}/images): bộ ảnh có thứ tự (ảnh đầu = ảnh chính),
// mô tả bán online, tải lên / chụp, AI phân tích + tạo ảnh, ghép nền giữ nguyên. Ảnh mới chỉ gắn vào sản phẩm khi lưu.

export type ProductImages = {
  productId: string;
  code: string;
  name: string;
  /** Hàng đồng bộ từ KiotViet — lưu bộ ảnh ở đây thì đồng bộ không chép đè ảnh KiotViet nữa. */
  kiotVietLinked: boolean;
  imagesCustomized: boolean;
  images: string[];
  description: string | null;
  onlineDescription: string | null;
};

const root = (id: string) => `/products/${id}/images`;

export function useProductImages(id: string | null) {
  return useSWR<ProductImages>(id ? root(id) : null, fetcher, { revalidateOnFocus: false });
}

export function useProductImageCatalog(id: string | null) {
  const { data } = useSWR<ImageCatalog>(id ? `${root(id)}/ai/styles` : null, fetcher, {
    revalidateOnFocus: false,
  });
  return data;
}

/** Lưu bộ ảnh (thứ tự = thứ tự hiển thị) và / hoặc mô tả bán online ("" = xoá, dùng lại mô tả KiotViet). */
export async function saveProductImages(
  id: string,
  input: { urls?: string[]; onlineDescription?: string }
) {
  return (await axios.put<ProductImages>(root(id), input)).data;
}

/** Tải lên / chụp một ảnh (máy chủ xoay đúng chiều, thu về ≤ 2048px). Trả URL — chưa gắn vào sản phẩm. */
export async function uploadProductImage(id: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return (await axios.post<{ url: string }>(`${root(id)}/upload`, form, { timeout: 120000 })).data
    .url;
}

export async function analyzeProductImage(id: string, sourceUrl: string) {
  return (
    await axios.post<ImageAnalysis>(`${root(id)}/ai/analyze`, { sourceUrl }, { timeout: 120000 })
  ).data;
}

/** Một lần gọi = một ảnh (10–60 giây); gọi 1–3 lần song song để có 1–3 ảnh. */
export async function generateProductImage(
  id: string,
  input: { sourceUrl: string; preset: string; tags?: string[]; note?: string }
) {
  return (await axios.post<ImageResult>(`${root(id)}/ai/generate`, input, { timeout: 180000 }))
    .data;
}

export async function frameProductImage(
  id: string,
  input: { sourceUrl: string; background: string; aspect: 'square' | 'portrait' }
) {
  return (await axios.post<ImageResult>(`${root(id)}/frame`, input, { timeout: 60000 })).data;
}
