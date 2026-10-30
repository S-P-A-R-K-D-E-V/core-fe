import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { escapeHtml, printHtmlDocument, PRINT_FRAME_ATTRIBUTE } from '../print-html';

// ----------------------------------------------------------------------
// In qua iframe ẩn: tài liệu được ghi vào iframe cùng origin, print() của CHÍNH iframe được gọi (không
// phải của trang), và iframe chỉ bị gỡ sau sự kiện afterprint.
// ----------------------------------------------------------------------

const HTML =
  '<!DOCTYPE html><html lang="vi"><head><title>Phiếu thử</title><style>@page{size:74mm 22mm;margin:0}</style></head>' +
  '<body><p id="noi-dung">Áo thun cổ tròn — 185.000đ</p></body></html>';

const frames = () => Array.from(document.querySelectorAll<HTMLIFrameElement>(`iframe[${PRINT_FRAME_ATTRIBUTE}]`));

/** jsdom không có print() / focus(): gắn hàm giả vào window của iframe trước khi hẹn giờ gọi in chạy. */
function stubFramePrint(frame: HTMLIFrameElement, print = vi.fn()) {
  const frameWindow = frame.contentWindow as Window;
  frameWindow.focus = vi.fn();
  frameWindow.print = print;
  return print;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  frames().forEach((frame) => frame.remove());
});

describe('escapeHtml', () => {
  it('thoát & < > " \' và giữ nguyên dấu tiếng Việt', () => {
    expect(escapeHtml(`Áo <b>"M&M"</b> 'đỏ'`)).toBe('Áo &lt;b&gt;&quot;M&amp;M&quot;&lt;/b&gt; &#39;đỏ&#39;');
    expect(escapeHtml('Kẹp tóc nơ nhung đỏ')).toBe('Kẹp tóc nơ nhung đỏ');
  });
});

describe('printHtmlDocument', () => {
  it('ghi tài liệu vào iframe ẩn rồi gọi print() của iframe', () => {
    const pagePrint = vi.spyOn(window, 'print').mockImplementation(() => {});

    printHtmlDocument(HTML);

    expect(frames()).toHaveLength(1);
    const [frame] = frames();
    expect(frame.parentElement).toBe(document.body);
    expect(frame.getAttribute('aria-hidden')).toBe('true');
    expect(frame.style.visibility).toBe('hidden');
    expect(frame.style.display).not.toBe('none');
    // Cùng origin: đọc được tài liệu bên trong
    expect(frame.contentDocument?.getElementById('noi-dung')?.textContent).toBe('Áo thun cổ tròn — 185.000đ');
    expect(frame.contentDocument?.title).toBe('Phiếu thử');
    expect(frame.contentDocument?.querySelector('style')?.textContent).toContain('@page{size:74mm 22mm;margin:0}');

    const print = stubFramePrint(frame);
    expect(print).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);

    expect(print).toHaveBeenCalledTimes(1);
    expect(pagePrint).not.toHaveBeenCalled();
    pagePrint.mockRestore();
  });

  it('chỉ gỡ iframe sau afterprint, lúc đó promise mới xong', async () => {
    const done = vi.fn();
    const promise = printHtmlDocument(HTML).then(done);
    const [frame] = frames();
    stubFramePrint(frame);

    vi.advanceTimersByTime(50);
    await Promise.resolve();
    expect(frames()).toHaveLength(1);
    expect(done).not.toHaveBeenCalled();

    frame.contentWindow?.dispatchEvent(new Event('afterprint'));
    await promise;

    expect(frames()).toHaveLength(0);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('print() ném lỗi → gỡ iframe và từ chối promise', async () => {
    const promise = printHtmlDocument(HTML);
    stubFramePrint(
      frames()[0],
      vi.fn((): void => {
        throw new Error('bị chặn');
      })
    );
    const caught = promise.catch((error: Error) => error.message);

    vi.advanceTimersByTime(50);

    expect(await caught).toBe('bị chặn');
    expect(frames()).toHaveLength(0);
  });

  it('lần in trước chưa có afterprint → lần in sau dọn khung cũ, không để dồn iframe', () => {
    printHtmlDocument(HTML);
    const [first] = frames();
    stubFramePrint(first);
    vi.advanceTimersByTime(50);

    printHtmlDocument(HTML.replace('Phiếu thử', 'Phiếu sau'));

    expect(frames()).toHaveLength(1);
    expect(frames()[0]).not.toBe(first);
    expect(frames()[0].contentDocument?.title).toBe('Phiếu sau');
    stubFramePrint(frames()[0]);
    vi.advanceTimersByTime(50);
  });

  it('delayMs đổi thời điểm gọi print()', () => {
    printHtmlDocument(HTML, { delayMs: 300 });
    const print = stubFramePrint(frames()[0]);

    vi.advanceTimersByTime(299);
    expect(print).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('tài liệu có ảnh: chờ ảnh tải xong rồi mới gọi print()', () => {
    printHtmlDocument(
      HTML.replace('</body>', '<img src="https://cici.vn/media/branding/logo.png"></body>')
    );
    const [frame] = frames();
    const print = stubFramePrint(frame);

    vi.advanceTimersByTime(1000);
    expect(print).not.toHaveBeenCalled();

    frame.contentDocument?.images[0].dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(50);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('ảnh tải mãi không xong (hoặc lỗi): vẫn in sau imageTimeoutMs', () => {
    printHtmlDocument(
      HTML.replace(
        '</body>',
        '<img src="https://cici.vn/media/a.png"><img src="https://cici.vn/media/b.png"></body>'
      ),
      {
        imageTimeoutMs: 2000,
      }
    );
    const [frame] = frames();
    const print = stubFramePrint(frame);

    frame.contentDocument?.images[0].dispatchEvent(new Event('error'));
    vi.advanceTimersByTime(1999);
    expect(print).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1 + 50);
    expect(print).toHaveBeenCalledTimes(1);
  });
});
