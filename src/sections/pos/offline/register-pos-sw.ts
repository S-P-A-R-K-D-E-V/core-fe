// ----------------------------------------------------------------------
// Đăng ký Service Worker của màn bán hàng (public/sw.js) — chỉ khi mở màn bán hàng. SW giữ "vỏ" ứng dụng (trang + JS /
// CSS / font) để mở được màn khi mất mạng; không lưu API.
// Lần đầu đăng ký, các file đã tải xong TRƯỚC khi SW điều khiển trang → gửi danh sách cho SW lưu ("warm").
// ----------------------------------------------------------------------

const SW_URL = '/sw.js';

function shellUrls(): string[] {
  const urls = new Set<string>([window.location.href]);
  try {
    performance.getEntriesByType('resource').forEach((entry) => {
      const { name } = entry;
      if (name.includes('/_next/static/') || name.startsWith('https://api.iconify.design/')) urls.add(name);
    });
  } catch {
    // trình duyệt cũ — chỉ lưu trang
  }
  return Array.from(urls);
}

export async function registerPosServiceWorker(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  // Chỉ chạy trên https hoặc localhost (yêu cầu của trình duyệt).
  if (!window.isSecureContext) return;
  try {
    const registration = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
    const ready = await navigator.serviceWorker.ready;
    (ready.active ?? registration.active)?.postMessage({ type: 'warm', urls: shellUrls() });
  } catch (err) {
    console.warn('Không đăng ký được Service Worker cho màn bán hàng', err);
  }
}
