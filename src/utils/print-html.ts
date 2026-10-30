// ----------------------------------------------------------------------
// In một tài liệu HTML tự chứa (tem mã, phiếu thanh toán…) qua hộp thoại in của trình duyệt mà không
// rời trang hiện tại: ghi HTML vào một iframe ẩn cùng origin, gọi print() của iframe, gỡ iframe sau
// sự kiện afterprint.
//
// Tài liệu phải tự đặt khổ giấy: `@page { size: <rộng>mm <cao>mm; margin: 0 }`, CSS nằm trong <style>,
// không tải font / CSS ngoài. Ảnh (logo, ảnh trong mẫu in) được chờ tải xong (tối đa 5 giây) rồi mới gọi print().
// Hỗ trợ Chrome và Edge trên máy tính.
// ----------------------------------------------------------------------

/** Thoát ký tự đặc biệt trước khi chèn chữ của người dùng (tên hàng, ghi chú…) vào HTML. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const PRINT_FRAME_ATTRIBUTE = 'data-print-html-frame';

export type PrintHtmlOptions = {
  /** Chờ bao lâu (ms) sau khi ghi tài liệu rồi mới gọi print() — để trình duyệt dàn trang xong. */
  delayMs?: number;
  /** Tài liệu có ảnh (logo, ảnh trong mẫu in): chờ ảnh tải xong tối đa bấy nhiêu ms rồi mới in. */
  imageTimeoutMs?: number;
};

const IMAGE_TIMEOUT_MS = 5000;

/**
 * Mở hộp thoại in cho `html` (cả tài liệu, từ <!DOCTYPE html>).
 * Promise xong khi hộp thoại in đóng (đã in hoặc huỷ — trình duyệt không cho biết là cái nào) và iframe
 * đã được gỡ; bị từ chối khi không tạo được iframe hoặc print() ném lỗi.
 */
export function printHtmlDocument(html: string, options: PrintHtmlOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Chỉ in được trong trình duyệt.'));
      return;
    }

    // Lần in trước chưa kịp gỡ (trình duyệt không bắn afterprint) → dọn trước khi tạo khung mới.
    document.querySelectorAll(`iframe[${PRINT_FRAME_ATTRIBUTE}]`).forEach((stale) => stale.remove());

    const frame = document.createElement('iframe');
    frame.setAttribute(PRINT_FRAME_ATTRIBUTE, '');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    // Không dùng display:none — có trình duyệt in ra trang trắng.
    frame.style.cssText =
      'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(frame);

    const frameWindow = frame.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      frame.remove();
      reject(new Error('Không mở được khung in.'));
      return;
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    let finished = false;
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      frame.remove();
      if (error) reject(error);
      else resolve();
    };

    // Gắn sau document.open(): open() xoá mọi listener có sẵn trên window của iframe.
    frameWindow.addEventListener('afterprint', () => finish());

    const schedulePrint = () =>
      window.setTimeout(() => {
        try {
          frameWindow.focus();
          frameWindow.print();
        } catch (error) {
          finish(error ?? new Error('Không gọi được lệnh in.'));
        }
      }, options.delayMs ?? 50);

    // Ảnh (logo, ảnh trong mẫu in) phải tải xong trước khi in, không thì bản in thiếu ảnh. Ảnh lỗi / quá thời gian vẫn in
    // tiếp. Không có ảnh nào đang tải → hẹn in ngay như trước.
    const pending = Array.from(frameDocument.images ?? []).filter((image) => !image.complete);
    if (pending.length === 0) {
      schedulePrint();
      return;
    }
    let left = pending.length;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      window.clearTimeout(guard);
      schedulePrint();
    };
    const guard = window.setTimeout(start, options.imageTimeoutMs ?? IMAGE_TIMEOUT_MS);
    pending.forEach((image) => {
      const done = () => {
        left -= 1;
        if (left === 0) start();
      };
      image.addEventListener('load', done, { once: true });
      image.addEventListener('error', done, { once: true });
    });
  });
}
