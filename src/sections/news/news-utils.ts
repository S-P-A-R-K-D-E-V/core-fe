// Dùng được ở component client (src/lib/store-posts.ts đọc request phía server nên chỉ import kiểu dữ liệu từ đó).

/** Ngày dạng "26 thg 10, 2026". */
export function formatPostDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso));
}
