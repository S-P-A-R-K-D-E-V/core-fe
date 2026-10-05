import { afterEach, describe, expect, it, vi } from 'vitest';

// ----------------------------------------------------------------------
// Hợp đồng với core-be (AutomationController): GET automation/rules → { rules }, PUT automation/rules/{code}
// → quy tắc sau khi lưu. Interceptor của axios chỉ trả body lỗi (không có mã trạng thái) nên 404 "máy chủ chưa
// có API" phải được nhận riêng qua validateStatus và đổi thành null.
// ----------------------------------------------------------------------

const http = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock('src/utils/axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('src/utils/axios')>();
  return { ...actual, default: http };
});

// Imported after the mock above so the module under test picks up the mocked axios.
import { getAutomationRules, updateAutomationRule } from 'src/api/automation';

afterEach(() => {
  vi.clearAllMocks();
});

describe('getAutomationRules', () => {
  it('gọi GET /automation/rules và trả mảng rules', async () => {
    const rules = [{ code: 'till.discrepancy' }];
    http.get.mockResolvedValue({ status: 200, data: { rules } });

    await expect(getAutomationRules()).resolves.toBe(rules);
    expect(http.get).toHaveBeenCalledTimes(1);
    expect(http.get.mock.calls[0][0]).toBe('/automation/rules');
  });

  it('404 (máy chủ chưa có API) → null thay vì lỗi; các mã lỗi khác vẫn là lỗi', async () => {
    http.get.mockResolvedValue({ status: 404, data: '' });

    await expect(getAutomationRules()).resolves.toBeNull();

    const { validateStatus } = http.get.mock.calls[0][1];
    expect(validateStatus(200)).toBe(true);
    expect(validateStatus(404)).toBe(true);
    expect(validateStatus(400)).toBe(false);
    expect(validateStatus(401)).toBe(false);
    expect(validateStatus(403)).toBe(false);
    expect(validateStatus(500)).toBe(false);
  });

  it('body không đúng dạng → danh sách rỗng, không ném lỗi', async () => {
    http.get.mockResolvedValue({ status: 200, data: '<html></html>' });
    await expect(getAutomationRules()).resolves.toEqual([]);

    http.get.mockResolvedValue({ status: 200, data: { rules: null } });
    await expect(getAutomationRules()).resolves.toEqual([]);
  });
});

describe('updateAutomationRule', () => {
  it('gọi PUT /automation/rules/{code} với đúng phần muốn đổi và trả quy tắc sau khi lưu', async () => {
    const saved = { code: 'till.discrepancy', enabled: false };
    http.put.mockResolvedValue({ status: 200, data: saved });
    const payload = { enabled: false, settings: { channels: { messenger: false } } };

    await expect(updateAutomationRule('till.discrepancy', payload)).resolves.toBe(saved);
    expect(http.put).toHaveBeenCalledWith('/automation/rules/till.discrepancy', payload);
  });

  it('mã quy tắc được mã hoá an toàn trong đường dẫn', async () => {
    http.put.mockResolvedValue({ status: 200, data: {} });

    await updateAutomationRule('attendance.missing-checkout', { enabled: true });
    await updateAutomationRule('a/b?c', { enabled: true });

    expect(http.put.mock.calls.map((call) => call[0])).toEqual([
      '/automation/rules/attendance.missing-checkout',
      '/automation/rules/a%2Fb%3Fc',
    ]);
  });
});
