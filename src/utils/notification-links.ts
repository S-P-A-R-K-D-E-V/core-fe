/** Đường dẫn trong trang quản trị mới được mở từ thông báo, không nhận link ra ngoài. */
export function isInternalActionUrl(url: string): boolean {
  return /^\/dashboard(\/|\?|$)/.test(url) && !url.includes('//') && !url.includes('..');
}
