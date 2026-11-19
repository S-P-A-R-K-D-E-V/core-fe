// ----------------------------------------------------------------------
// Bộ ảnh sản phẩm: thao tác thuần trên mảng URL (ảnh đầu = ảnh chính) — dễ test, dùng cho dialog ảnh sản phẩm.

export const MAX_PRODUCT_IMAGES = 12;

/** Đưa ảnh lên đầu (đặt làm ảnh chính). */
export function makePrimary(urls: string[], url: string): string[] {
  if (!urls.includes(url)) return urls;
  return [url, ...urls.filter((u) => u !== url)];
}

/** Đổi chỗ với ảnh bên cạnh; ra ngoài mép thì giữ nguyên. */
export function move(urls: string[], url: string, delta: -1 | 1): string[] {
  const from = urls.indexOf(url);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= urls.length) return urls;
  const next = [...urls];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function remove(urls: string[], url: string): string[] {
  return urls.filter((u) => u !== url);
}

/** Thêm vào cuối, bỏ ảnh trùng, không quá {@link MAX_PRODUCT_IMAGES}. Trả bộ mới + số ảnh không thêm được vì đầy. */
export function append(urls: string[], added: string[]): { urls: string[]; dropped: number } {
  const next = [...urls];
  let dropped = 0;
  added.forEach((u) => {
    if (next.includes(u)) return;
    if (next.length >= MAX_PRODUCT_IMAGES) {
      dropped += 1;
      return;
    }
    next.push(u);
  });
  return { urls: next, dropped };
}

export function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((u, i) => u === b[i]);
}

/**
 * Mẫu kế tiếp cho "Lưu & sang mẫu tiếp": mẫu chưa có ảnh đứng sau mẫu đang mở (vòng lại từ đầu), hết mẫu chưa có ảnh thì
 * mẫu ngay sau. null = không có mẫu nào khác.
 */
export function nextVariant<T extends { id: string; coverUrl: string | null }>(
  variants: T[],
  currentId: string
): T | null {
  if (variants.length < 2) return null;
  const at = Math.max(
    0,
    variants.findIndex((v) => v.id === currentId)
  );
  const ordered = [...variants.slice(at + 1), ...variants.slice(0, at)];
  return ordered.find((v) => !v.coverUrl) ?? ordered[0] ?? null;
}
