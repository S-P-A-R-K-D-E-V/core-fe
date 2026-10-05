import axios, { endpoints } from 'src/utils/axios';

// ----------------------------------------------------------------------
// Cảnh báo tự động của cửa hàng (chỉ Admin) — core-be AutomationController:
//   GET /automation/rules        → { rules: IAutomationRule[] }
//   PUT /automation/rules/{code} → IAutomationRule (quy tắc sau khi lưu)
// Lỗi kiểm tra giá trị: 400 { message, errors[] } (tiếng Việt); mã quy tắc lạ: 404 { message }.
// ----------------------------------------------------------------------

/** Giá trị của một thiết lập: số, bật/tắt hoặc chuỗi (giờ "HH:mm", chữ thường). */
export type AutomationSettingValue = number | boolean | string;

/**
 * Thiết lập của một quy tắc. Luôn có `channels { notification, messenger }`; các khoá còn lại tuỳ quy tắc
 * và core-be có thể thêm khoá mới bất cứ lúc nào — không khai báo cứng ở đây.
 */
export type AutomationSettings = Record<string, unknown>;

export interface IAutomationRule {
  /** Mã ổn định, vd "till.discrepancy" — tiền tố trước dấu chấm là nhóm nghiệp vụ. */
  code: string;
  title: string;
  description: string;
  /** Cờ bật/tắt của cửa hàng. */
  enabled: boolean;
  defaultEnabled: boolean;
  /** Thiết lập đang có hiệu lực (mặc định + phần cửa hàng đã lưu). */
  settings: AutomationSettings;
  /** Thiết lập mặc định — cho nút "Đặt lại mặc định". */
  defaults: AutomationSettings;
  /** Đang bị tắt trên toàn hệ thống (cấu hình máy chủ): bật ở cửa hàng cũng chưa chạy. */
  globallyDisabled: boolean;
  /** null = cửa hàng chưa lưu gì cho quy tắc này (đang dùng mặc định). */
  updatedAt: string | null;
  updatedByUserId: string | null;
}

/** Chỉ gửi phần muốn đổi: `enabled` và/hoặc các khoá của `settings` (khoá không gửi giữ nguyên). */
export interface IUpdateAutomationRulePayload {
  enabled?: boolean;
  settings?: AutomationSettings;
}

/**
 * Danh mục quy tắc kèm giá trị đang có hiệu lực ở cửa hàng.
 * Trả `null` khi máy chủ chưa có API này (404 — core-be chưa triển khai bản có cảnh báo tự động) để màn hình
 * báo "chưa sẵn sàng" thay vì báo lỗi. Interceptor của axios chỉ trả body lỗi, không có mã trạng thái, nên 404
 * được nhận ở đây qua validateStatus.
 */
export async function getAutomationRules(): Promise<IAutomationRule[] | null> {
  const res = await axios.get<{ rules?: IAutomationRule[] }>(endpoints.automation.rules, {
    validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
  });
  if (res.status === 404) return null;

  return Array.isArray(res.data?.rules) ? res.data.rules : [];
}

export async function updateAutomationRule(
  code: string,
  payload: IUpdateAutomationRulePayload
): Promise<IAutomationRule> {
  const res = await axios.put<IAutomationRule>(endpoints.automation.rule(code), payload);
  return res.data;
}
