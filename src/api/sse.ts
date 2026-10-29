// ----------------------------------------------------------------------
// Đọc Server-Sent Events từ body của fetch: ghép sự kiện bị cắt giữa các gói mạng, bỏ dòng ": ping" giữ kết nối. Dùng cho
// các lệnh AI chạy lâu đi qua route handler riêng của Next (không qua rewrites — proxy đó cắt kết nối giữa chừng).
// ----------------------------------------------------------------------

/**
 * Gọi onEvent cho từng sự kiện (tên + dữ liệu JSON) theo thứ tự tới; onEvent trả true để dừng đọc (vd đã có kết quả cuối),
 * ném lỗi thì lỗi đi thẳng ra ngoài. Trả true nếu dừng theo onEvent, false nếu stream hết trước.
 */
export async function readSse(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: string, payload: any) => boolean | void
): Promise<boolean> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const { value, done } = await reader.read();
    if (done) return false;
    buffer += decoder.decode(value, { stream: true });

    let sep = buffer.indexOf('\n\n');
    while (sep >= 0) {
      const block = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      sep = buffer.indexOf('\n\n');

      let event = 'message';
      let data = '';
      block.split('\n').forEach((line) => {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      });
      if (data && onEvent(event, JSON.parse(data))) {
        reader.cancel().catch(() => {});
        return true;
      }
    }
  }
}
