import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { fDateTime } from 'src/utils/format-time';

import type { IAutomationRule } from 'src/api/automation';

// ----------------------------------------------------------------------
// Màn "Cảnh báo tự động" (chỉ Admin): hiện quy tắc từ GET automation/rules theo nhóm, mỗi thẻ tự lưu và CHỈ gửi
// những gì đã đổi (PUT automation/rules/{code}), hiện lỗi 400 của máy chủ ngay tại ô, đặt lại mặc định,
// và báo "chưa sẵn sàng" khi máy chủ chưa có API (404). Dữ liệu mẫu đúng dạng core-be trả về.
// ----------------------------------------------------------------------

let mockUser: { role: string; roles: string[] } = { role: 'Admin', roles: ['Admin'] };
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: mockUser }),
}));

vi.mock('src/components/settings', () => ({
  useSettingsContext: () => ({ themeStretch: false }),
}));

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar }),
}));

vi.mock('src/components/custom-breadcrumbs', () => ({
  default: ({ heading }: any) => <h1>{heading}</h1>,
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

// Ô giờ thật là TimePicker của MUI X (bản mobile trong jsdom: chỉ đọc, chọn bằng đồng hồ) — ở đây thay bằng
// <input type="time"> cùng hợp đồng chuỗi "HH:mm" để gõ được. Ô thật được thử ở automation-rule-card.test.tsx.
vi.mock('src/components/date-time-picker', () => ({
  AppTimePicker: ({ label, value, onChange, disabled, error, helperText }: any) => (
    <div>
      <label>
        {label}
        <input
          type="time"
          value={value ?? ''}
          disabled={disabled}
          aria-invalid={!!error}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {helperText ? <p>{helperText}</p> : null}
    </div>
  ),
}));

const getAutomationRules = vi.fn();
const updateAutomationRule = vi.fn();
vi.mock('src/api/automation', () => ({
  getAutomationRules: (...args: any[]) => getAutomationRules(...args),
  updateAutomationRule: (...args: any[]) => updateAutomationRule(...args),
}));

// Imported after the mocks above so the view picks up the mocked modules.
import AutomationSettingsView from 'src/sections/automation/view/automation-settings-view';

// ----------------------------------------------------------------------

const CHANNELS = { notification: true, messenger: true };

function makeRule(
  code: string,
  title: string,
  settings: Record<string, unknown>,
  overrides: Partial<IAutomationRule> = {}
): IAutomationRule {
  return {
    code,
    title,
    description: `Mô tả của ${title}.`,
    enabled: true,
    defaultEnabled: true,
    settings,
    defaults: settings,
    globallyDisabled: false,
    updatedAt: null,
    updatedByUserId: null,
    ...overrides,
  };
}

/** Đúng danh mục + mặc định của core-be (AutomationSettingsServiceTests). */
function catalogue(): IAutomationRule[] {
  return [
    makeRule('till.discrepancy', 'Chốt quầy lệch tiền', {
      minDifference: 10000,
      toleranceAmount: 1000,
      channels: CHANNELS,
    }),
    makeRule('daily.summary', 'Tóm tắt hằng ngày', { time: '08:00', channels: CHANNELS }),
    makeRule('attendance.missing-checkout', 'Quên chấm công ra', {
      graceMinutes: 60,
      channels: CHANNELS,
    }),
    makeRule('attendance.understaffed-tomorrow', 'Ca ngày mai thiếu người', {
      time: '18:00',
      channels: CHANNELS,
    }),
    makeRule('attendance.no-registration', 'Chưa đăng ký ca tuần tới', {
      weekday: 5,
      time: '18:00',
      channels: CHANNELS,
    }),
    makeRule('sales.invoice-cancelled', 'Hoá đơn bị huỷ', { minAmount: 0, channels: CHANNELS }),
    makeRule('sales.discount', 'Giảm giá lớn', {
      minPercent: 20,
      minAmount: 100000,
      channels: CHANNELS,
    }),
    makeRule('cash.large-expense', 'Khoản chi lớn', {
      tillMinAmount: 500000,
      expenseMinAmount: 1000000,
      channels: CHANNELS,
    }),
  ];
}

function renderView() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <AutomationSettingsView />
    </ThemeProvider>
  );
}

/** Thẻ của một cảnh báo (role="group", tên = tiêu đề quy tắc). */
const findCard = (title: string) => screen.findByRole('group', { name: title });

const saveButton = (card: HTMLElement) => within(card).getByRole('button', { name: 'Lưu' });
const resetButton = (card: HTMLElement) =>
  within(card).getByRole('button', { name: 'Đặt lại mặc định' });

afterEach(() => {
  vi.clearAllMocks();
  mockUser = { role: 'Admin', roles: ['Admin'] };
});

// ----------------------------------------------------------------------

describe('AutomationSettingsView — hiển thị', () => {
  it('hiện quy tắc từ API theo nhóm, kèm lời giải thích cảnh báo gửi cho ai và qua đâu', async () => {
    getAutomationRules.mockResolvedValue(catalogue());

    renderView();

    const till = await findCard('Chốt quầy lệch tiền');
    expect(getAutomationRules).toHaveBeenCalledTimes(1);

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Quầy tiền',
      'Tổng hợp',
      'Chấm công',
      'Bán hàng & thu chi',
    ]);
    expect(
      screen
        .getAllByRole('group')
        .map((g) => within(g).getByRole('heading', { level: 3 }).textContent)
    ).toEqual(catalogue().map((r) => r.title));

    const explainer = screen.getByRole('alert');
    expect(explainer).toHaveTextContent('mọi Admin của cửa hàng');
    expect(explainer).toHaveTextContent('chuông thông báo');
    expect(explainer).toHaveTextContent('nhóm Messenger nội bộ “Cảnh báo hệ thống”');

    // Thẻ "Chốt quầy lệch tiền": mô tả, công tắc bật, hai kênh gửi, tiền có dấu chấm hàng nghìn.
    expect(within(till).getByText('Mô tả của Chốt quầy lệch tiền.')).toBeInTheDocument();
    expect(
      within(till).getByRole('checkbox', { name: 'Bật cảnh báo: Chốt quầy lệch tiền' })
    ).toBeChecked();
    expect(within(till).getByRole('checkbox', { name: 'Thông báo trong app' })).toBeChecked();
    expect(within(till).getByRole('checkbox', { name: 'Messenger nội bộ' })).toBeChecked();
    expect(within(till).getByRole('textbox', { name: 'Mức chênh lệch tối thiểu' })).toHaveValue(
      '10.000'
    );
    expect(within(till).getByRole('textbox', { name: 'Dung sai khi so tiền' })).toHaveValue(
      '1.000'
    );
    expect(within(till).getAllByText('đ')).toHaveLength(2);

    // Chưa đổi gì → không lưu được; đang đúng mặc định → không có gì để đặt lại.
    expect(saveButton(till)).toBeDisabled();
    expect(resetButton(till)).toBeDisabled();
    expect(within(till).getByText('Đang dùng thiết lập mặc định')).toBeInTheDocument();
    expect(within(till).queryByText(/Cập nhật lúc/)).not.toBeInTheDocument();

    // Thứ là ô chọn, giờ là ô giờ, phút/phần trăm có đơn vị.
    const registration = await findCard('Chưa đăng ký ca tuần tới');
    expect(within(registration).getByRole('combobox', { name: 'Thứ kiểm tra' })).toHaveTextContent(
      'Thứ Sáu'
    );
    expect(within(registration).getByLabelText('Giờ kiểm tra đăng ký ca')).toHaveValue('18:00');

    const checkout = await findCard('Quên chấm công ra');
    expect(
      within(checkout).getByRole('textbox', { name: 'Số phút chờ sau giờ kết thúc ca' })
    ).toHaveValue('60');
    expect(within(checkout).getByText('phút')).toBeInTheDocument();

    const discount = await findCard('Giảm giá lớn');
    expect(
      within(discount).getByRole('textbox', { name: 'Ngưỡng giảm giá theo phần trăm' })
    ).toHaveValue('20');
    expect(
      within(discount).getByRole('textbox', { name: 'Ngưỡng giảm giá theo số tiền' })
    ).toHaveValue('100.000');

    const expense = await findCard('Khoản chi lớn');
    expect(within(expense).getByRole('textbox', { name: 'Phiếu chi phí từ' })).toHaveValue(
      '1.000.000'
    );
  });

  it('quy tắc đã từng lưu hiện "Cập nhật lúc …", quy tắc bị tắt toàn hệ thống có ghi chú mờ', async () => {
    const rules = catalogue();
    rules[0] = { ...rules[0], globallyDisabled: true };
    rules[1] = {
      ...rules[1],
      enabled: false,
      settings: { time: '06:15', channels: { notification: true, messenger: false } },
      updatedAt: '2026-10-05T14:30:19.123Z',
      updatedByUserId: '11111111-1111-1111-1111-111111111111',
    };
    getAutomationRules.mockResolvedValue(rules);

    renderView();

    const till = await findCard('Chốt quầy lệch tiền');
    expect(within(till).getByText(/đang bị tắt trên toàn hệ thống/)).toBeInTheDocument();
    // Cờ của cửa hàng vẫn sửa được (có hiệu lực khi hệ thống bật lại).
    expect(
      within(till).getByRole('checkbox', { name: 'Bật cảnh báo: Chốt quầy lệch tiền' })
    ).toBeEnabled();

    const summary = await findCard('Tóm tắt hằng ngày');
    expect(within(summary).queryByText(/đang bị tắt trên toàn hệ thống/)).not.toBeInTheDocument();
    expect(
      within(summary).getByRole('checkbox', { name: 'Bật cảnh báo: Tóm tắt hằng ngày' })
    ).not.toBeChecked();
    expect(within(summary).getByRole('checkbox', { name: 'Messenger nội bộ' })).not.toBeChecked();
    expect(within(summary).getByLabelText('Giờ gửi tóm tắt')).toHaveValue('06:15');
    expect(
      within(summary).getByText(`Cập nhật lúc ${fDateTime('2026-10-05T14:30:19.123Z')}`)
    ).toBeInTheDocument();
    // Khác mặc định (08:00, bật Messenger) → đặt lại được.
    expect(resetButton(summary)).toBeEnabled();
  });

  it('khoá chưa biết vẫn hiện theo kiểu giá trị với nhãn là tên khoá, và lưu được', async () => {
    const user = userEvent.setup();
    const future = makeRule('inventory.low-stock', 'Sắp hết hàng', {
      lowStockThreshold: 5,
      skipWhenNoActivity: true,
      quietFrom: '22:30',
      note: 'kho chính',
      channels: CHANNELS,
    });
    getAutomationRules.mockResolvedValue([...catalogue(), future]);
    updateAutomationRule.mockImplementation(async (_code: string, payload: any) => ({
      ...future,
      settings: { ...future.settings, ...payload.settings },
      updatedAt: '2026-10-05T15:00:00Z',
    }));

    renderView();

    const card = await findCard('Sắp hết hàng');
    // Tiền tố chưa biết → nhóm "Khác" ở cuối.
    expect(screen.getAllByRole('heading', { level: 2 }).at(-1)).toHaveTextContent('Khác');

    const threshold = within(card).getByRole('textbox', { name: 'lowStockThreshold' });
    const skip = within(card).getByRole('checkbox', { name: 'skipWhenNoActivity' });
    expect(threshold).toHaveValue('5');
    expect(skip).toBeChecked();
    expect(within(card).getByLabelText('quietFrom')).toHaveValue('22:30');
    expect(within(card).getByLabelText('quietFrom')).toHaveAttribute('type', 'time');
    expect(within(card).getByRole('textbox', { name: 'note' })).toHaveValue('kho chính');
    // Kênh gửi vẫn có nhãn tiếng Việt.
    expect(within(card).getByRole('checkbox', { name: 'Messenger nội bộ' })).toBeChecked();

    await user.clear(threshold);
    await user.type(threshold, '8');
    await user.click(skip);
    await user.click(saveButton(card));

    expect(updateAutomationRule).toHaveBeenCalledWith('inventory.low-stock', {
      settings: { lowStockThreshold: 8, skipWhenNoActivity: false },
    });
  });
});

// ----------------------------------------------------------------------

describe('AutomationSettingsView — lưu', () => {
  it('chỉ gửi đúng khoá đã đổi; lưu xong thẻ nhận giá trị máy chủ trả về và nút Lưu tắt lại', async () => {
    const user = userEvent.setup();
    const rules = catalogue();
    getAutomationRules.mockResolvedValue(rules);
    updateAutomationRule.mockResolvedValue({
      ...rules[0],
      settings: { minDifference: 20000, toleranceAmount: 1000, channels: CHANNELS },
      updatedAt: '2026-10-05T14:30:19.123Z',
      updatedByUserId: '11111111-1111-1111-1111-111111111111',
    });

    renderView();

    const till = await findCard('Chốt quầy lệch tiền');
    const minDifference = within(till).getByRole('textbox', { name: 'Mức chênh lệch tối thiểu' });

    await user.clear(minDifference);
    await user.type(minDifference, '20000');

    expect(minDifference).toHaveValue('20.000');
    expect(within(till).getByText(/Có thay đổi chưa lưu/)).toBeInTheDocument();
    expect(saveButton(till)).toBeEnabled();
    // Thẻ khác không bị ảnh hưởng.
    expect(saveButton(await findCard('Tóm tắt hằng ngày'))).toBeDisabled();

    await user.click(saveButton(till));

    expect(updateAutomationRule).toHaveBeenCalledTimes(1);
    expect(updateAutomationRule).toHaveBeenCalledWith('till.discrepancy', {
      settings: { minDifference: 20000 },
    });

    await waitFor(() => expect(saveButton(till)).toBeDisabled());
    expect(minDifference).toHaveValue('20.000');
    expect(
      within(till).getByText(`Cập nhật lúc ${fDateTime('2026-10-05T14:30:19.123Z')}`)
    ).toBeInTheDocument();
    expect(within(till).queryByText(/Có thay đổi chưa lưu/)).not.toBeInTheDocument();
    // Giờ đã khác mặc định (10.000) → đặt lại được.
    expect(resetButton(till)).toBeEnabled();
    expect(enqueueSnackbar).toHaveBeenCalledWith('Đã lưu cảnh báo “Chốt quầy lệch tiền”');
  });

  it('chỉ tắt một kênh → chỉ gửi kênh đó', async () => {
    const user = userEvent.setup();
    const rules = catalogue();
    getAutomationRules.mockResolvedValue(rules);
    updateAutomationRule.mockResolvedValue({
      ...rules[1],
      settings: { time: '08:00', channels: { notification: true, messenger: false } },
      updatedAt: '2026-10-05T14:30:19.123Z',
    });

    renderView();

    const summary = await findCard('Tóm tắt hằng ngày');
    await user.click(within(summary).getByRole('checkbox', { name: 'Messenger nội bộ' }));
    await user.click(saveButton(summary));

    expect(updateAutomationRule).toHaveBeenCalledWith('daily.summary', {
      settings: { channels: { messenger: false } },
    });
  });

  it('chỉ bật/tắt cảnh báo → chỉ gửi enabled, không gửi settings', async () => {
    const user = userEvent.setup();
    const rules = catalogue();
    getAutomationRules.mockResolvedValue(rules);
    updateAutomationRule.mockResolvedValue({
      ...rules[5],
      enabled: false,
      updatedAt: '2026-10-05T14:30:19Z',
    });

    renderView();

    const cancelled = await findCard('Hoá đơn bị huỷ');
    const toggle = within(cancelled).getByRole('checkbox', {
      name: 'Bật cảnh báo: Hoá đơn bị huỷ',
    });
    await user.click(toggle);
    await user.click(saveButton(cancelled));

    expect(updateAutomationRule).toHaveBeenCalledWith('sales.invoice-cancelled', {
      enabled: false,
    });
    await waitFor(() => expect(saveButton(cancelled)).toBeDisabled());
    expect(toggle).not.toBeChecked();
  });

  it('đổi thứ + giờ + phần trăm lẻ: gửi đúng kiểu giá trị (số / chuỗi "HH:mm")', async () => {
    const user = userEvent.setup();
    const rules = catalogue();
    getAutomationRules.mockResolvedValue(rules);
    updateAutomationRule.mockImplementation(async (code: string, payload: any) => {
      const rule = rules.find((r) => r.code === code)!;
      return {
        ...rule,
        settings: { ...rule.settings, ...payload.settings },
        updatedAt: '2026-10-05T14:30:19Z',
      };
    });

    renderView();

    const registration = await findCard('Chưa đăng ký ca tuần tới');
    await user.click(within(registration).getByRole('combobox', { name: 'Thứ kiểm tra' }));
    await user.click(await screen.findByRole('option', { name: 'Chủ nhật' }));
    fireEvent.change(within(registration).getByLabelText('Giờ kiểm tra đăng ký ca'), {
      target: { value: '09:30' },
    });
    await user.click(saveButton(registration));

    expect(updateAutomationRule).toHaveBeenLastCalledWith('attendance.no-registration', {
      settings: { weekday: 0, time: '09:30' },
    });

    const discount = await findCard('Giảm giá lớn');
    const percent = within(discount).getByRole('textbox', {
      name: 'Ngưỡng giảm giá theo phần trăm',
    });
    await user.clear(percent);
    await user.type(percent, '35,5');
    await user.click(
      within(discount).getByRole('checkbox', { name: 'Bật cảnh báo: Giảm giá lớn' })
    );
    await user.click(saveButton(discount));

    expect(updateAutomationRule).toHaveBeenLastCalledWith('sales.discount', {
      enabled: false,
      settings: { minPercent: 35.5 },
    });
  });

  it('gõ lại đúng giá trị cũ thì không còn gì để lưu; ô bỏ trống có lời nhắc và không lưu được', async () => {
    const user = userEvent.setup();
    getAutomationRules.mockResolvedValue(catalogue());

    renderView();

    const till = await findCard('Chốt quầy lệch tiền');
    const minDifference = within(till).getByRole('textbox', { name: 'Mức chênh lệch tối thiểu' });

    await user.clear(minDifference);
    expect(within(till).getByText('Nhập số tiền (đồng).')).toBeInTheDocument();
    expect(minDifference).toBeInvalid();
    expect(saveButton(till)).toBeDisabled();

    await user.type(minDifference, '10000');
    expect(minDifference).toHaveValue('10.000');
    expect(within(till).queryByText('Nhập số tiền (đồng).')).not.toBeInTheDocument();
    expect(saveButton(till)).toBeDisabled();
    expect(updateAutomationRule).not.toHaveBeenCalled();
  });

  it('tắt hết kênh gửi thì nhắc rằng cảnh báo sẽ không được gửi đi', async () => {
    const user = userEvent.setup();
    getAutomationRules.mockResolvedValue(catalogue());

    renderView();

    const till = await findCard('Chốt quầy lệch tiền');
    await user.click(within(till).getByRole('checkbox', { name: 'Thông báo trong app' }));
    expect(within(till).queryByText(/Đang tắt mọi kênh gửi/)).not.toBeInTheDocument();

    await user.click(within(till).getByRole('checkbox', { name: 'Messenger nội bộ' }));
    expect(within(till).getByText(/Đang tắt mọi kênh gửi/)).toBeInTheDocument();
  });
});

// ----------------------------------------------------------------------

describe('AutomationSettingsView — lỗi kiểm tra giá trị của máy chủ (400)', () => {
  it('câu lỗi nêu khoá hiện ngay dưới ô đó, câu còn lại hiện chung; giá trị đang gõ được giữ', async () => {
    const user = userEvent.setup();
    getAutomationRules.mockResolvedValue(catalogue());
    const rangeError =
      'Mức chênh lệch tối thiểu (minDifference) phải từ 0 đến 1.000.000.000.000 đồng.';
    const unknownKey =
      'Quy tắc "till.discrepancy" không có thiết lập "ngưỡng". Thiết lập hợp lệ: minDifference, toleranceAmount, channels.';
    // Interceptor của axios reject bằng BODY của response.
    updateAutomationRule.mockRejectedValue({
      message: `${rangeError} ${unknownKey}`,
      errors: [rangeError, unknownKey],
    });

    renderView();

    const till = await findCard('Chốt quầy lệch tiền');
    const minDifference = within(till).getByRole('textbox', { name: 'Mức chênh lệch tối thiểu' });
    const tolerance = within(till).getByRole('textbox', { name: 'Dung sai khi so tiền' });
    await user.clear(minDifference);
    await user.type(minDifference, '9000000000000');
    await user.click(saveButton(till));

    expect(await within(till).findByText(rangeError)).toBeInTheDocument();
    expect(minDifference).toBeInvalid();
    expect(minDifference).toHaveAccessibleDescription(rangeError);
    expect(tolerance).toBeValid();
    expect(within(till).getByRole('alert')).toHaveTextContent(unknownKey);

    // Không có gì được lưu: giá trị đang gõ còn nguyên, vẫn bấm Lưu lại được, không báo "đã lưu".
    expect(minDifference).toHaveValue('9.000.000.000.000');
    expect(saveButton(till)).toBeEnabled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
    expect(
      within(till).getByText('Đang dùng thiết lập mặc định · Có thay đổi chưa lưu')
    ).toBeInTheDocument();

    // Sửa lại ô đó → lỗi của ô biến mất.
    await user.type(minDifference, '{Backspace}');
    expect(within(till).queryByText(rangeError)).not.toBeInTheDocument();
    expect(minDifference).toBeValid();
  });

  it('lỗi không phải 400 kiểm tra giá trị (mất mạng, 404…) hiện một dòng báo lỗi trên thẻ', async () => {
    const user = userEvent.setup();
    getAutomationRules.mockResolvedValue(catalogue());
    updateAutomationRule
      .mockRejectedValueOnce('Something went wrong')
      .mockRejectedValueOnce({ message: 'Không có quy tắc tự động "daily.summary".' });

    renderView();

    const summary = await findCard('Tóm tắt hằng ngày');
    await user.click(
      within(summary).getByRole('checkbox', { name: 'Bật cảnh báo: Tóm tắt hằng ngày' })
    );

    await user.click(saveButton(summary));
    expect(await within(summary).findByRole('alert')).toHaveTextContent(
      'Lưu thất bại, vui lòng thử lại.'
    );

    await user.click(saveButton(summary));
    await waitFor(() =>
      expect(within(summary).getByRole('alert')).toHaveTextContent(
        'Không có quy tắc tự động "daily.summary".'
      )
    );
  });
});

// ----------------------------------------------------------------------

describe('AutomationSettingsView — đặt lại mặc định', () => {
  it('đưa ngưỡng + kênh gửi về defaults (chưa lưu), giữ nguyên công tắc bật/tắt; Lưu chỉ gửi phần khác giá trị đang lưu', async () => {
    const user = userEvent.setup();
    const rules = catalogue();
    const defaults = rules[6].settings;
    rules[6] = {
      ...rules[6],
      enabled: false,
      // minAmount đang đúng bằng mặc định → không được gửi lại.
      settings: {
        minPercent: 35.5,
        minAmount: 100000,
        channels: { notification: true, messenger: false },
      },
      defaults,
      updatedAt: '2026-10-01T02:00:00Z',
    };
    getAutomationRules.mockResolvedValue(rules);
    updateAutomationRule.mockResolvedValue({
      ...rules[6],
      settings: defaults,
      updatedAt: '2026-10-05T14:30:19Z',
    });

    renderView();

    const discount = await findCard('Giảm giá lớn');
    const percent = within(discount).getByRole('textbox', {
      name: 'Ngưỡng giảm giá theo phần trăm',
    });
    const messenger = within(discount).getByRole('checkbox', { name: 'Messenger nội bộ' });
    const toggle = within(discount).getByRole('checkbox', { name: 'Bật cảnh báo: Giảm giá lớn' });
    expect(percent).toHaveValue('35.5');
    expect(messenger).not.toBeChecked();
    expect(saveButton(discount)).toBeDisabled();

    await user.click(resetButton(discount));

    // Form về mặc định nhưng CHƯA gọi API.
    expect(percent).toHaveValue('20');
    expect(
      within(discount).getByRole('textbox', { name: 'Ngưỡng giảm giá theo số tiền' })
    ).toHaveValue('100.000');
    expect(messenger).toBeChecked();
    expect(toggle).not.toBeChecked();
    expect(updateAutomationRule).not.toHaveBeenCalled();
    expect(resetButton(discount)).toBeDisabled();
    expect(saveButton(discount)).toBeEnabled();

    await user.click(saveButton(discount));

    expect(updateAutomationRule).toHaveBeenCalledTimes(1);
    expect(updateAutomationRule).toHaveBeenCalledWith('sales.discount', {
      settings: { minPercent: 20, channels: { messenger: true } },
    });
    await waitFor(() => expect(saveButton(discount)).toBeDisabled());
    expect(resetButton(discount)).toBeDisabled();
  });

  it('đặt lại cũng xoá ô đang gõ dở', async () => {
    const user = userEvent.setup();
    getAutomationRules.mockResolvedValue(catalogue());

    renderView();

    const till = await findCard('Chốt quầy lệch tiền');
    const minDifference = within(till).getByRole('textbox', { name: 'Mức chênh lệch tối thiểu' });
    await user.clear(minDifference);
    expect(resetButton(till)).toBeEnabled();

    await user.click(resetButton(till));

    expect(minDifference).toHaveValue('10.000');
    expect(minDifference).toBeValid();
    expect(saveButton(till)).toBeDisabled();
  });
});

// ----------------------------------------------------------------------

describe('AutomationSettingsView — trạng thái tải', () => {
  it('máy chủ chưa có API (404) → "Tính năng chưa sẵn sàng trên máy chủ"', async () => {
    // getAutomationRules trả null khi GET automation/rules là 404 (xem src/api/__tests__/automation.test.ts).
    getAutomationRules.mockResolvedValue(null);

    renderView();

    expect(await screen.findByText('Tính năng chưa sẵn sàng trên máy chủ')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it('đang tải thì hiện vòng chờ; danh mục rỗng thì báo chưa có cảnh báo nào', async () => {
    let resolve: (rules: IAutomationRule[]) => void = () => {};
    getAutomationRules.mockReturnValue(
      new Promise<IAutomationRule[]>((r) => {
        resolve = r;
      })
    );

    renderView();

    expect(
      screen.getByRole('progressbar', { name: 'Đang tải cảnh báo tự động' })
    ).toBeInTheDocument();

    resolve([]);

    expect(await screen.findByText('Chưa có cảnh báo tự động nào')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('tải lỗi → báo lỗi tiếng Việt kèm nút "Thử lại" tải lại được', async () => {
    const user = userEvent.setup();
    getAutomationRules
      .mockRejectedValueOnce('Something went wrong')
      .mockResolvedValueOnce(catalogue());

    renderView();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không tải được danh sách cảnh báo tự động.');
    expect(screen.queryByRole('group')).not.toBeInTheDocument();

    await user.click(within(alert).getByRole('button', { name: 'Thử lại' }));

    expect(await findCard('Chốt quầy lệch tiền')).toBeInTheDocument();
    expect(getAutomationRules).toHaveBeenCalledTimes(2);
  });

  it('lỗi có lời báo của máy chủ thì hiện đúng lời đó', async () => {
    getAutomationRules.mockRejectedValue({ title: 'Máy chủ đang bảo trì', status: 503 });

    renderView();

    expect(await screen.findByRole('alert')).toHaveTextContent('Máy chủ đang bảo trì');
  });
});

// ----------------------------------------------------------------------

describe('AutomationSettingsView — phân quyền', () => {
  it.each(['Manager', 'Staff'])(
    '%s: không thấy cảnh báo nào và trang không gọi API',
    async (role) => {
      mockUser = { role, roles: [role] };
      getAutomationRules.mockResolvedValue(catalogue());

      renderView();

      expect(screen.getByText('Permission Denied')).toBeInTheDocument();
      // Cho effect (nếu có) cơ hội chạy rồi mới khẳng định không gọi API
      await new Promise((r) => setTimeout(r, 0));
      expect(getAutomationRules).not.toHaveBeenCalled();
      expect(screen.queryByRole('group')).not.toBeInTheDocument();
      expect(screen.queryByText('Tính năng chưa sẵn sàng trên máy chủ')).not.toBeInTheDocument();
    }
  );
});
