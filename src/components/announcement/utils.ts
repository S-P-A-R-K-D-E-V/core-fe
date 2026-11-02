import type { AnnouncementSeverity, IPendingAnnouncement } from 'src/types/announcement';

// ----------------------------------------------------------------------
// Phần thuần của popup thông báo (test được).
// ----------------------------------------------------------------------

/** Giãn cách giữa hai lần hỏi API khi chuyển trang. */
export const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function shouldCheck(lastCheckAt: number, now: number): boolean {
  return lastCheckAt === 0 || now - lastCheckAt >= CHECK_INTERVAL_MS;
}

/** Thêm thông báo mới vào cuối hàng đợi, không đảo thứ tự cái đang hiện, không thêm lại cái vừa xử lý xong. */
export function mergeQueue(
  queue: IPendingAnnouncement[],
  incoming: IPendingAnnouncement[],
  handled: ReadonlySet<string>
): IPendingAnnouncement[] {
  const known = new Set(queue.map((a) => a.id));
  return [...queue, ...incoming.filter((a) => !known.has(a.id) && !handled.has(a.id))];
}

/**
 * Đường dẫn nội bộ, cùng luật với Core-be AnnouncementRules.IsInternalPath. Backend đã chặn khi lưu; kiểm lại ở đây để link lạ trong
 * Markdown (quản trị gõ được) không bao giờ bấm được.
 */
export function isInternalPath(url: unknown): url is string {
  if (typeof url !== 'string' || !url.startsWith('/') || url.length > 300) return false;
  if (url.includes('//') || url.includes('\\')) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(url)) return false;
  if (/%(2f|5c|2e|00|09|0a|0d)/i.test(url)) return false;
  return !url.split(/[?#]/)[0].split('/').includes('..');
}

export const SEVERITY_META: Record<AnnouncementSeverity, { color: 'info' | 'warning' | 'error'; icon: string }> = {
  Info: { color: 'info', icon: 'solar:info-circle-bold' },
  Warn: { color: 'warning', icon: 'solar:danger-triangle-bold' },
  Critical: { color: 'error', icon: 'solar:shield-warning-bold' },
};

export function severityMeta(severity: string) {
  return SEVERITY_META[severity as AnnouncementSeverity] ?? SEVERITY_META.Info;
}
