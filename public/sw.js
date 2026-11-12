/* eslint-disable no-restricted-globals */
// ----------------------------------------------------------------------
// Service Worker của màn bán hàng (POS) — mở được màn bán hàng khi mất mạng (docs/cici/plans/pos-offline-plan.md, GĐ4).
//
// Chỉ giữ "vỏ" ứng dụng: trang /dashboard/pos/sale/, JS / CSS / font của Next (/_next/), ảnh tĩnh, biểu tượng Iconify.
// KHÔNG BAO GIỜ lưu API (hàng, hoá đơn… đã có IndexedDB riêng). Mọi yêu cầu: mạng trước — quá 4 giây hoặc lỗi mới dùng
// bản đã lưu, nên khi có mạng luôn chạy bản mới nhất sau mỗi lần deploy.
// Gỡ khẩn: thay file này bằng một SW chỉ gọi self.registration.unregister() rồi deploy.
// ----------------------------------------------------------------------

const CACHE = 'cici-pos-shell-v1';
const NETWORK_TIMEOUT_MS = 4000;

const isPosPage = (url) => url.pathname.replace(/\/+$/, '') === '/dashboard/pos/sale';

function isShellAsset(url) {
  if (url.origin === self.location.origin) {
    return (
      url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/fonts/') ||
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/logo/') ||
      url.pathname.startsWith('/favicon/')
    );
  }
  // Biểu tượng Iconify tải từ API của Iconify (không có thì nút trên màn bán hàng mất hình).
  return url.origin === 'https://api.iconify.design';
}

function shouldHandle(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (request.mode === 'navigate') return url.origin === self.location.origin && isPosPage(url);
  return isShellAsset(url);
}

/** File của Next: bỏ qua query khi tìm (bản dev gắn ?v=<thời điểm> khác nhau giữa các lần dựng trang). */
const matchOptions = (url) => ({ ignoreSearch: url.origin === self.location.origin && url.pathname.startsWith('/_next/') });

/** Khoá lưu: trang POS bỏ query (?returnTo…) để luôn trúng một bản. */
function cacheKey(request) {
  const url = new URL(request.url);
  if (request.mode === 'navigate' && isPosPage(url)) return `${url.origin}/dashboard/pos/sale/`;
  return request.url;
}

/**
 * Lưu mọi file /_next/ mà HTML của trang POS dùng (script, css, font preload) — để lần mở khi mất mạng có đủ, kể cả lần
 * đầu SW chưa điều khiển trang (file đã tải trước khi SW chạy) hay bị chuyển trang trước khi tải hết.
 */
async function cachePageAssets(cache, html) {
  const urls = new Set();
  const re = /(?:src|href)="(\/_next\/[^"]+)"/g;
  let m = re.exec(html);
  while (m) {
    urls.add(new URL(m[1].replace(/&amp;/g, '&'), self.location.origin).href);
    m = re.exec(html);
  }
  await Promise.all(
    Array.from(urls).map(async (href) => {
      try {
        const url = new URL(href);
        if (await cache.match(href, matchOptions(url))) return;
        const response = await fetch(href, { credentials: 'same-origin' });
        if (response.ok) await cache.put(href, response);
      } catch {
        // bỏ qua
      }
    })
  );
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const key = cacheKey(request);
  const network = fetch(request).then((response) => {
    // Chỉ lưu bản tốt (không lưu trang lỗi / chuyển hướng tới trang đăng nhập).
    if (response.ok && response.type !== 'opaqueredirect' && !response.redirected) {
      cache.put(key, response.clone()).catch(() => {});
      if (request.mode === 'navigate') {
        response
          .clone()
          .text()
          .then((html) => cachePageAssets(cache, html))
          .catch(() => {});
      }
    }
    return response;
  });
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve(null), NETWORK_TIMEOUT_MS);
  });
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
  } catch {
    // mạng lỗi → dùng bản đã lưu
  }
  const cached = await cache.match(key, matchOptions(new URL(request.url)));
  if (cached) return cached;
  return network; // chưa từng lưu: chờ mạng (lỗi thì trình duyệt báo như thường)
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('cici-pos-shell-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (shouldHandle(event.request)) event.respondWith(networkFirst(event.request));
});

// Trang POS gửi danh sách tài nguyên đã tải trước khi SW kịp điều khiển (lần đầu đăng ký) → lưu những cái còn thiếu.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'warm' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        data.urls.map(async (raw) => {
          try {
            const url = new URL(raw, self.location.origin);
            const isPage = url.origin === self.location.origin && isPosPage(url);
            if (!isPage && !isShellAsset(url)) return;
            const key = isPage ? `${url.origin}/dashboard/pos/sale/` : url.href;
            // Trang POS: luôn tải lại để lưu đủ file của bản hiện tại.
            if (!isPage && (await cache.match(key, matchOptions(url)))) return;
            const response = await fetch(url.href, { credentials: 'same-origin' });
            if (response.ok && !response.redirected) {
              if (isPage) await cachePageAssets(cache, await response.clone().text());
              await cache.put(key, response);
            }
          } catch {
            // bỏ qua tài nguyên lỗi
          }
        })
      );
    })()
  );
});
