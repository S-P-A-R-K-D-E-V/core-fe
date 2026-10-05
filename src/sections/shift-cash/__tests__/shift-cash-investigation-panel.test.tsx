import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { ShiftCashInvestigationOutcome } from 'src/api/shiftCash';
import type {
  IShiftCashSummary,
  IShiftCashCountCheckpoint,
  IShiftCashInvestigationResult,
} from 'src/types/corecms-api';

// ----------------------------------------------------------------------
// "Kiểm tra chênh lệch" ở trang Kiểm tiền quầy: chỉ Admin, thu gọn mặc định, chỉ gọi
// GET /shift-cash/investigation khi bấm (hoặc 1 lần khi mở bằng ?investigate=1), hiện kết quả đúng
// thứ tự BE trả về, và phân biệt các trạng thái: chưa chốt / BE chưa có endpoint / 403 / lỗi khác.
// ----------------------------------------------------------------------

let mockUser: { role: string; roles: string[] } = { role: 'Admin', roles: ['Admin'] };
vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: mockUser }),
}));

let query = '';
vi.mock('src/routes/hooks', () => ({
  useSearchParams: () => new URLSearchParams(query),
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

const getShiftCashInvestigation = vi.fn();
vi.mock('src/api/shiftCash', () => ({
  getShiftCashInvestigation: (...args: any[]) => getShiftCashInvestigation(...args),
}));

// Imported after the mocks above so the panel picks up the mocked modules.
import ShiftCashInvestigationPanel from 'src/sections/shift-cash/shift-cash-investigation-panel';

const DAY = '2026-10-05';
const OTHER_DAY = '2026-10-04';

// Kết quả THẬT của core-be cho mẫu "chốt tay, thiếu 350.000đ"
// (ShiftCashDiscrepancyAnalyzerTests.SampleManualShortage): chạy ShiftCashDiscrepancyAnalyzer.Analyze rồi
// serialize bằng đúng tuỳ chọn JSON của API — camelCase, enum là chuỗi, null không bị lược, mốc thời
// gian UTC có "Z" (13:10 giờ VN là 06:10Z). Chỉ rút ngắn `message` (giao diện không dùng).
const CHECKPOINTS: IShiftCashCountCheckpoint[] = [
  {
    at: '2026-10-05T01:00:00Z',
    counted: 2000000,
    expected: 2000000,
    difference: 0,
    kind: 'Open',
    actors: ['Trần Thị Lan'],
  },
  {
    at: '2026-10-05T03:00:00Z',
    counted: 2350000,
    expected: 2350000,
    difference: 0,
    kind: 'Count',
    actors: ['Trần Thị Lan'],
  },
  {
    at: '2026-10-05T06:10:00Z',
    counted: 2600000,
    expected: 2600000,
    difference: 0,
    kind: 'Count',
    actors: ['Trần Thị Lan'],
  },
  {
    at: '2026-10-05T11:05:00Z',
    counted: 2675000,
    expected: 3025000,
    difference: -350000,
    kind: 'Count',
    actors: ['Trần Thị Lan'],
  },
  {
    at: '2026-10-05T15:05:01Z',
    counted: 2800000,
    expected: 3150000,
    difference: -350000,
    kind: 'Finalize',
    actors: ['Trần Thị Lan'],
  },
];

const RESULT: IShiftCashInvestigationResult = {
  date: '2026-10-05',
  finalized: true,
  dailyId: '11111111-2222-3333-4444-555555555555',
  finalizedAt: '2026-10-05T15:05:00Z',
  isAutoFinalized: false,
  finalizedByName: 'Trần Thị Lan',
  numbers: {
    openingBalance: 2000000,
    countedCash: 2800000,
    cashFromSales: 1210000,
    manualIncome: 0,
    manualExpense: 60000,
    expectedCash: 3150000,
    difference: -350000,
    expectedAtFinalize: 3150000,
    differenceAtFinalize: -350000,
    tolerance: 1000,
  },
  findings: [
    {
      code: 'UNPAID_AS_CASH',
      strength: 'Medium',
      title: 'Hoá đơn chưa thu đủ được tính là tiền mặt',
      detail:
        '1 hoá đơn hoàn thành chưa ghi nhận thu đủ (công nợ, COD, trả một phần…) nhưng công thức chốt coi phần chưa thu = 200.000đ là tiền mặt: HD000209 (16:45) 200.000đ. Nếu khách chưa trả tiền mặt phần này thì quỹ thiếu tương ứng.',
      amount: 200000,
      direction: 'Shortage',
      refs: ['HD000209'],
      at: '2026-10-05T09:45:00Z',
      inDriftWindow: true,
    },
    {
      code: 'CASH_INVOICE_WITH_BANK_CREDIT',
      strength: 'Medium',
      title: 'Hoá đơn ghi tiền mặt nhưng có tiền vào tài khoản đúng số tiền',
      detail:
        '1 hoá đơn được tính là tiền mặt trong khi có khoản tiền vào tài khoản đúng bằng số đó quanh giờ bán — có thể khách đã chuyển khoản: HD000207 (15:20) 150.000đ ↔ tiền vào lúc 15:22. Nếu đúng vậy thì quỹ thiếu tương ứng; nên đối chiếu sao kê.',
      amount: 150000,
      direction: 'Shortage',
      refs: ['HD000207'],
      at: '2026-10-05T08:20:00Z',
      inDriftWindow: true,
    },
    {
      code: 'AMOUNT_MATCH',
      strength: 'Weak',
      title: 'Một cặp hoá đơn tiền mặt có tổng đúng bằng số thiếu',
      detail:
        'Không có hoá đơn đơn lẻ nào bằng số thiếu, nhưng có cặp hoá đơn tiền mặt cộng lại đúng bằng (chỉ xét chứng từ sau lần đếm lúc 13:10, khi quỹ chưa thiếu): HD000207 (15:20) 150.000đ + HD000209 (16:45) 200.000đ.',
      amount: 350000,
      direction: 'Shortage',
      refs: ['HD000207', 'HD000209'],
      at: '2026-10-05T08:20:00Z',
      inDriftWindow: true,
    },
  ],
  driftWindow: {
    from: '2026-10-05T06:10:00Z',
    to: '2026-10-05T11:05:00Z',
    fromOpening: false,
    differenceAtFrom: 0,
    differenceAtTo: -350000,
    staffOnShift: ['Trần Thị Lan', 'Nguyễn Văn Hùng'],
    checkpoints: CHECKPOINTS,
  },
  driftNote: null,
  checkpoints: CHECKPOINTS,
  countIsStale: false,
  lastCountAt: null,
  checked: [
    'số đếm cuối so với tiền mặt phát sinh sau đó (6 thao tác đếm)',
    'hoá đơn chưa thu đủ hoặc không có dòng thanh toán (8 hoá đơn hoàn thành)',
    'phiếu trả hàng (0 phiếu)',
    'tiền vào tài khoản trùng số tiền hoá đơn tiền mặt (1 khoản)',
    'hoá đơn đã huỷ (0 hoá đơn)',
    'số liệu thay đổi sau khi chốt',
    'hoá đơn/khoản thu chi có số tiền đúng bằng chênh lệch',
    'khoản thu chi quầy bị sửa, xoá, ghi trùng (1 khoản)',
    'tiền đầu ngày so với tồn đầu',
    'chênh lệch có bằng vài tờ tiền cùng mệnh giá không',
  ],
  title: 'Kiểm tra chênh lệch quầy 05/10: thiếu 350.000đ',
  message:
    'Thiếu 350.000đ: đếm 2.800.000đ / dự kiến 3.150.000đ (= tồn đầu 2.000.000đ + bán tiền mặt 1.210.000đ + thu 0đ − chi 60.000đ).\n…',
};

// Tổng hợp của trang (GET /shift-cash/summary) cho một ngày đã chốt và khớp quỹ.
const BALANCED_SUMMARY: IShiftCashSummary = {
  date: DAY,
  openingBalance: 2000000,
  totalCashFromKiot: 1210000,
  manualIncome: 0,
  manualExpense: 60000,
  expectedClosing: 3150000,
  actualCash: 3150000,
  difference: 0,
  isFinalized: true,
  finalizedAt: '2026-10-05T15:05:00Z',
  finalizedByName: 'Trần Thị Lan',
  denominations: [],
  transactions: [],
  finalizations: [
    {
      id: 'daily-1',
      openingBalance: 2000000,
      closingBalance: 3150000,
      difference: 0,
      finalizedAt: '2026-10-05T15:05:00Z',
      finalizedByName: 'Trần Thị Lan',
    },
  ],
};

const ok = (result: IShiftCashInvestigationResult): ShiftCashInvestigationOutcome => ({
  status: 'ok',
  result,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type PanelProps = React.ComponentProps<typeof ShiftCashInvestigationPanel>;

function renderPanel(props: Partial<PanelProps> = {}, { strict = false } = {}) {
  // A fresh theme per render avoids MUI/emotion's shared default-theme singleton getting frozen
  // across tests (see cleaning-template-list-view.test.tsx).
  const theme = createTheme();
  const ui = (next: Partial<PanelProps>) => {
    const panel = (
      <ThemeProvider theme={theme}>
        <ShiftCashInvestigationPanel date={DAY} {...props} {...next} />
      </ThemeProvider>
    );
    return strict ? <StrictMode>{panel}</StrictMode> : panel;
  };
  const view = render(ui({}));
  return { ...view, update: (next: Partial<PanelProps>) => view.rerender(ui(next)) };
}

async function clickCheck() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Kiểm tra' }));
  return user;
}

afterEach(() => {
  vi.clearAllMocks();
  getShiftCashInvestigation.mockReset();
  mockUser = { role: 'Admin', roles: ['Admin'] };
  query = '';
});

describe('ShiftCashInvestigationPanel', () => {
  it('thu gọn mặc định: có tiêu đề + nút "Kiểm tra", chưa gọi API', () => {
    renderPanel();

    expect(screen.getByText('Kiểm tra chênh lệch')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kiểm tra' })).toBeEnabled();
    expect(screen.queryByText('Thời điểm phát sinh lệch')).not.toBeInTheDocument();
    expect(getShiftCashInvestigation).not.toHaveBeenCalled();
  });

  it('bấm "Kiểm tra" → đang tải → hiện chênh lệch, dòng số liệu, thời điểm phát sinh lệch và ghi chú "chưa phải kết luận"', async () => {
    const pending = deferred<ShiftCashInvestigationOutcome>();
    getShiftCashInvestigation.mockReturnValue(pending.promise);
    renderPanel();

    await clickCheck();

    expect(getShiftCashInvestigation).toHaveBeenCalledTimes(1);
    expect(getShiftCashInvestigation).toHaveBeenCalledWith(DAY);
    expect(screen.getByText('Đang kiểm tra…')).toBeInTheDocument();

    await act(async () => pending.resolve(ok(RESULT)));

    expect(screen.getByText('Thiếu 350.000đ')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Đếm 2.800.000đ / dự kiến 3.150.000đ (= tồn đầu 2.000.000đ + bán tiền mặt 1.210.000đ + thu 0đ − chi 60.000đ)'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Lần chốt được kiểm tra: 22:05 · Trần Thị Lan')).toBeInTheDocument();
    // Số lúc chốt bằng số tính lại → không nhắc "Lúc chốt …"
    expect(screen.queryByText(/^Lúc chốt/)).not.toBeInTheDocument();

    expect(screen.getByText('Thời điểm phát sinh lệch')).toBeInTheDocument();
    expect(screen.getByText('13:10 → 18:05')).toBeInTheDocument();
    expect(screen.getByText('13:10 khớp quỹ, 18:05 thiếu 350.000đ.')).toBeInTheDocument();
    expect(
      screen.getByText('Có ca trong khoảng này: Trần Thị Lan, Nguyễn Văn Hùng.')
    ).toBeInTheDocument();

    expect(
      screen.getByText('Đây là các khả năng để kiểm tra lại, chưa phải kết luận.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tải lại' })).toBeEnabled();
    expect(screen.queryByText('Đang kiểm tra…')).not.toBeInTheDocument();
  });

  it('phát hiện hiện đúng thứ tự BE trả về, kèm nhãn độ mạnh, số tiền, mã chứng từ và dấu "trong khoảng phát sinh lệch"', async () => {
    getShiftCashInvestigation.mockResolvedValue(
      ok({
        ...RESULT,
        findings: [
          {
            code: 'STALE_COUNT',
            strength: 'Strong',
            title: 'Quầy chưa được đếm lại sau 15:02',
            detail: 'Lần đếm cuối lúc 15:02 (Trần Thị Lan); phát sinh sau lần đếm cuối: …',
            amount: 450000,
            direction: 'Shortage',
            refs: ['HD000103', 'HD000104', 'HD000105'],
            at: '2026-10-05T08:02:00Z',
            inDriftWindow: false,
          },
          RESULT.findings[0],
          {
            code: 'NOTE_SIZED',
            strength: 'Weak',
            title: 'Chênh lệch đúng bằng 1 tờ 50.000đ',
            detail: 'Số thiếu 50.000đ đúng bằng 1 tờ 50.000đ — có thể đếm nhầm số tờ.',
            amount: 0,
            direction: 'Unknown',
            refs: [],
            at: null,
            inDriftWindow: false,
          },
        ],
      })
    );
    renderPanel();
    await clickCheck();

    const list = await screen.findByRole('list', { name: 'Nguyên nhân có thể' });
    const [strong, medium, weak, ...rest] = within(list).getAllByRole('listitem');
    expect(rest).toHaveLength(0);

    expect(within(strong).getByText('Khả năng cao')).toBeInTheDocument();
    expect(within(strong).getByText('Quầy chưa được đếm lại sau 15:02')).toBeInTheDocument();
    expect(within(strong).getByText('450.000đ')).toBeInTheDocument();
    expect(within(strong).getByText(/^Lần đếm cuối lúc 15:02/)).toBeInTheDocument();
    ['HD000103', 'HD000104', 'HD000105'].forEach((code) =>
      expect(within(strong).getByText(code)).toBeInTheDocument()
    );
    expect(within(strong).queryByText('Trong khoảng phát sinh lệch')).not.toBeInTheDocument();

    expect(within(medium).getByText('Có thể')).toBeInTheDocument();
    expect(
      within(medium).getByText('Hoá đơn chưa thu đủ được tính là tiền mặt')
    ).toBeInTheDocument();
    expect(within(medium).getByText('200.000đ')).toBeInTheDocument();
    expect(within(medium).getByText('HD000209')).toBeInTheDocument();
    expect(within(medium).getByText('Trong khoảng phát sinh lệch')).toBeInTheDocument();

    expect(within(weak).getByText('Gợi ý')).toBeInTheDocument();
    expect(within(weak).getByText('Chênh lệch đúng bằng 1 tờ 50.000đ')).toBeInTheDocument();
    // amount = 0 → không hiện số tiền riêng (chỉ còn trong tiêu đề / diễn giải)
    expect(within(weak).queryByText('0đ')).not.toBeInTheDocument();
  });

  it('bảng các mốc đếm: giờ Việt Nam, đếm, dự kiến, chênh lệch; mốc rơi sang ngày khác kèm dd/MM', async () => {
    getShiftCashInvestigation.mockResolvedValue(
      ok({
        ...RESULT,
        checkpoints: [
          ...RESULT.checkpoints,
          {
            // 00:30 ngày 06/10 giờ VN — chốt bù sau nửa đêm
            at: '2026-10-05T17:30:00Z',
            counted: 2800000,
            expected: 3150000,
            difference: -350000,
            kind: 'AutoFinalize',
            actors: [],
          },
        ],
      })
    );
    renderPanel();
    await clickCheck();

    const table = await screen.findByRole('table', { name: 'Các mốc đếm trong ngày' });
    const [head, open, , , drifted, , late] = within(table).getAllByRole('row');

    ['Thời điểm', 'Đếm', 'Dự kiến', 'Chênh lệch'].forEach((column) =>
      expect(within(head).getByText(column)).toBeInTheDocument()
    );

    expect(within(open).getByText('08:00')).toBeInTheDocument();
    expect(within(open).getByText('Mở quầy · Trần Thị Lan')).toBeInTheDocument();
    expect(within(open).getAllByText('2.000.000')).toHaveLength(2);
    expect(within(open).getByText('0')).toBeInTheDocument();

    expect(within(drifted).getByText('18:05')).toBeInTheDocument();
    expect(within(drifted).getByText('Đếm · Trần Thị Lan')).toBeInTheDocument();
    expect(within(drifted).getByText('2.675.000')).toBeInTheDocument();
    expect(within(drifted).getByText('3.025.000')).toBeInTheDocument();
    expect(within(drifted).getByText('-350.000')).toBeInTheDocument();

    expect(within(late).getByText('00:30 06/10')).toBeInTheDocument();
    expect(within(late).getByText('Tự chốt')).toBeInTheDocument();
  });

  it('quỹ thừa → "Thừa …"; số liệu đổi sau khi chốt → nói rõ cả số lúc chốt', async () => {
    getShiftCashInvestigation.mockResolvedValue(
      ok({
        ...RESULT,
        numbers: {
          ...RESULT.numbers,
          countedCash: 3330000,
          difference: 180000,
          differenceAtFinalize: -350000,
        },
      })
    );
    renderPanel();
    await clickCheck();

    expect(await screen.findByText('Thừa 180.000đ')).toBeInTheDocument();
    expect(
      screen.getByText('Lúc chốt thiếu 350.000đ; con số trên là tính lại theo số liệu hiện tại.')
    ).toBeInTheDocument();
  });

  it('không khoanh được thời điểm → hiện lời giải thích của BE; không có phát hiện → nêu những gì đã kiểm tra', async () => {
    const driftNote =
      'Chỉ có 1 lần đếm trong ngày (lúc 22:05) nên chưa khoanh được thời điểm phát sinh lệch.';
    getShiftCashInvestigation.mockResolvedValue(
      ok({ ...RESULT, driftWindow: null, driftNote, findings: [] })
    );
    renderPanel();
    await clickCheck();

    expect(await screen.findByText(driftNote)).toBeInTheDocument();
    expect(screen.queryByText('13:10 → 18:05')).not.toBeInTheDocument();

    expect(screen.queryByRole('list', { name: 'Nguyên nhân có thể' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/^Chưa tìm thấy nguyên nhân rõ ràng từ dữ liệu trong hệ thống\./)
    ).toBeInTheDocument();
    expect(screen.getByText(`Đã kiểm tra: ${RESULT.checked.join('; ')}.`)).toBeInTheDocument();
    expect(RESULT.checked).toHaveLength(10);
  });

  it('lệch đã có từ lần đếm đầu tiên (fromOpening) → nói rõ thay vì đưa ra một khoảng', async () => {
    getShiftCashInvestigation.mockResolvedValue(
      ok({
        ...RESULT,
        driftWindow: {
          ...RESULT.driftWindow!,
          from: '2026-10-05T01:00:00Z',
          to: '2026-10-05T03:00:00Z',
          fromOpening: true,
          differenceAtTo: -50000,
          staffOnShift: [],
        },
      })
    );
    renderPanel();
    await clickCheck();

    expect(
      await screen.findByText(
        'Lệch đã có ở lần đếm đầu tiên trong ngày (10:00: thiếu 50.000đ) — phát sinh trước lần đếm đó, hoặc tiền đầu ngày đã không khớp tồn đầu.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Có ca trong khoảng này/)).not.toBeInTheDocument();
  });

  it('ngày chưa chốt (404 ShiftCash.NotFinalized) → "Ngày này chưa chốt quầy nên chưa có gì để kiểm tra."', async () => {
    getShiftCashInvestigation.mockResolvedValue({ status: 'not-finalized' });
    renderPanel();
    await clickCheck();

    expect(
      await screen.findByText('Ngày này chưa chốt quầy nên chưa có gì để kiểm tra.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Thời điểm phát sinh lệch')).not.toBeInTheDocument();
  });

  it('BE chưa có endpoint (404 không kèm mã lỗi) → "Tính năng kiểm tra chênh lệch chưa sẵn sàng trên máy chủ."', async () => {
    getShiftCashInvestigation.mockResolvedValue({ status: 'unavailable' });
    renderPanel();
    await clickCheck();

    expect(
      await screen.findByText('Tính năng kiểm tra chênh lệch chưa sẵn sàng trên máy chủ.')
    ).toBeInTheDocument();
  });

  it('BE trả 403 → ẩn hẳn component', async () => {
    getShiftCashInvestigation.mockResolvedValue({ status: 'forbidden' });
    const { container } = renderPanel();
    await clickCheck();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('lỗi khác → thông báo chung, "Thử lại" gọi lại API', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    getShiftCashInvestigation
      .mockRejectedValueOnce('Something went wrong')
      .mockResolvedValueOnce(ok(RESULT));
    renderPanel();
    const user = await clickCheck();

    expect(
      await screen.findByText('Không kiểm tra được chênh lệch. Vui lòng thử lại.')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('Thiếu 350.000đ')).toBeInTheDocument();
    expect(getShiftCashInvestigation).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByText('Không kiểm tra được chênh lệch. Vui lòng thử lại.')
    ).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it.each(['Manager', 'Staff'])(
    '%s (không phải Admin) → không hiện gì, không gọi API kể cả khi có ?investigate=1',
    (role) => {
      mockUser = { role, roles: [role] };
      query = 'investigate=1';

      const { container } = renderPanel();

      expect(container).toBeEmptyDOMElement();
      expect(getShiftCashInvestigation).not.toHaveBeenCalled();
    }
  );

  it('?investigate=1 → tự kiểm tra đúng 1 lần cho ngày đang chọn; đổi ngày sau đó không tự chạy lại', async () => {
    query = 'investigate=1';
    getShiftCashInvestigation.mockResolvedValue(ok(RESULT));

    const { update } = renderPanel();

    expect(await screen.findByText('Thiếu 350.000đ')).toBeInTheDocument();
    expect(getShiftCashInvestigation).toHaveBeenCalledTimes(1);
    expect(getShiftCashInvestigation).toHaveBeenCalledWith(DAY);

    update({ date: OTHER_DAY });

    expect(screen.getByRole('button', { name: 'Kiểm tra' })).toBeInTheDocument();
    expect(screen.queryByText('Thiếu 350.000đ')).not.toBeInTheDocument();
    expect(getShiftCashInvestigation).toHaveBeenCalledTimes(1);
  });

  it('?investigate=1&date=… → chờ trang chuyển sang đúng ngày trên URL rồi mới tự kiểm tra (không chạy nhầm cho hôm nay)', async () => {
    query = `investigate=1&date=${OTHER_DAY}`;
    getShiftCashInvestigation.mockResolvedValue(ok(RESULT));

    // Trang mở ở hôm nay trước, effect của trang đổi sang ngày trên URL ngay sau đó.
    const { update } = renderPanel();
    expect(getShiftCashInvestigation).not.toHaveBeenCalled();

    update({ date: OTHER_DAY });

    expect(await screen.findByText('Thiếu 350.000đ')).toBeInTheDocument();
    expect(getShiftCashInvestigation).toHaveBeenCalledTimes(1);
    expect(getShiftCashInvestigation).toHaveBeenCalledWith(OTHER_DAY);
  });

  it('?investigate=1 dưới React StrictMode (effect chạy 2 lần) vẫn chỉ gọi API 1 lần', async () => {
    query = 'investigate=1';
    getShiftCashInvestigation.mockResolvedValue(ok(RESULT));

    renderPanel({}, { strict: true });

    expect(await screen.findByText('Thiếu 350.000đ')).toBeInTheDocument();
    expect(getShiftCashInvestigation).toHaveBeenCalledTimes(1);
  });

  it('không có ?investigate=1 (hoặc giá trị khác 1) → không tự gọi API', () => {
    query = 'investigate=0';

    renderPanel();

    expect(screen.getByRole('button', { name: 'Kiểm tra' })).toBeInTheDocument();
    expect(getShiftCashInvestigation).not.toHaveBeenCalled();
  });

  it('đổi ngày → về thu gọn; câu trả lời về muộn của ngày cũ bị bỏ qua', async () => {
    const slow = deferred<ShiftCashInvestigationOutcome>();
    getShiftCashInvestigation.mockReturnValueOnce(slow.promise);
    const { update } = renderPanel();
    await clickCheck();
    expect(screen.getByText('Đang kiểm tra…')).toBeInTheDocument();

    update({ date: OTHER_DAY });

    expect(screen.getByRole('button', { name: 'Kiểm tra' })).toBeEnabled();
    expect(screen.queryByText('Đang kiểm tra…')).not.toBeInTheDocument();

    await act(async () => slow.resolve(ok(RESULT)));

    expect(screen.queryByText('Thiếu 350.000đ')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kiểm tra' })).toBeEnabled();

    // Quay lại ngày cũ cũng vẫn thu gọn — không dùng lại kết quả đã bỏ
    update({ date: DAY });
    expect(screen.queryByText('Thiếu 350.000đ')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kiểm tra' })).toBeInTheDocument();
  });

  it('đang xem kết quả mà đổi ngày → về thu gọn, phải bấm lại mới gọi API cho ngày mới', async () => {
    getShiftCashInvestigation.mockResolvedValue(ok(RESULT));
    const { update } = renderPanel();
    const user = await clickCheck();
    expect(await screen.findByText('Thiếu 350.000đ')).toBeInTheDocument();

    update({ date: OTHER_DAY });

    expect(screen.queryByText('Thiếu 350.000đ')).not.toBeInTheDocument();
    expect(getShiftCashInvestigation).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Kiểm tra' }));

    expect(getShiftCashInvestigation).toHaveBeenLastCalledWith(OTHER_DAY);
    expect(await screen.findByText('Thiếu 350.000đ')).toBeInTheDocument();
  });

  it('"Tải lại" gọi lại API, giữ kết quả cũ trong lúc tải; "Thu gọn" về trạng thái ban đầu', async () => {
    const reload = deferred<ShiftCashInvestigationOutcome>();
    getShiftCashInvestigation.mockResolvedValueOnce(ok(RESULT)).mockReturnValueOnce(reload.promise);
    renderPanel();
    const user = await clickCheck();
    expect(await screen.findByText('Thiếu 350.000đ')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tải lại' }));

    expect(getShiftCashInvestigation).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Thiếu 350.000đ')).toBeInTheDocument();

    await act(async () =>
      reload.resolve(
        ok({
          ...RESULT,
          numbers: { ...RESULT.numbers, difference: 0, differenceAtFinalize: 0 },
          findings: [],
          driftWindow: null,
        })
      )
    );

    expect(screen.getByText('Khớp quỹ')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Tính lại theo số liệu hiện tại thì quỹ khớp — không có chênh lệch cần giải thích.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Thời điểm phát sinh lệch')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Thu gọn' }));

    expect(screen.queryByText('Khớp quỹ')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kiểm tra' })).toBeInTheDocument();
    expect(getShiftCashInvestigation).toHaveBeenCalledTimes(2);
  });

  it('trang đã biết ngày này chốt rồi và quỹ khớp → hàng mờ "Quỹ khớp — không có gì để kiểm tra", không có nút, không gọi API', () => {
    renderPanel({ summary: BALANCED_SUMMARY });

    expect(screen.getByText('Kiểm tra chênh lệch')).toBeInTheDocument();
    expect(screen.getByText('Quỹ khớp — không có gì để kiểm tra')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(getShiftCashInvestigation).not.toHaveBeenCalled();
  });

  it.each<[string, IShiftCashSummary | null]>([
    ['trang chưa tải xong tổng hợp', null],
    ['ngày chưa chốt', { ...BALANCED_SUMMARY, isFinalized: false, finalizations: [] }],
    ['số tính lại đang lệch', { ...BALANCED_SUMMARY, actualCash: 2800000, difference: -350000 }],
    [
      'lần chốt mới nhất đã lưu số lệch',
      {
        ...BALANCED_SUMMARY,
        finalizations: [{ ...BALANCED_SUMMARY.finalizations[0], difference: 150000 }],
      },
    ],
    ['tổng hợp còn là của ngày trước (vừa đổi ngày)', { ...BALANCED_SUMMARY, date: OTHER_DAY }],
  ])('%s → vẫn có nút "Kiểm tra" (không coi là quỹ khớp)', (_name, summary) => {
    renderPanel({ summary });

    expect(screen.getByRole('button', { name: 'Kiểm tra' })).toBeEnabled();
    expect(screen.queryByText('Quỹ khớp — không có gì để kiểm tra')).not.toBeInTheDocument();
  });

  it('mở bằng ?investigate=1 thì vẫn kiểm tra và hiện kết quả dù trang báo quỹ khớp', async () => {
    query = 'investigate=1';
    getShiftCashInvestigation.mockResolvedValue(ok(RESULT));

    renderPanel({ summary: BALANCED_SUMMARY });

    expect(await screen.findByText('Thiếu 350.000đ')).toBeInTheDocument();
    expect(screen.queryByText('Quỹ khớp — không có gì để kiểm tra')).not.toBeInTheDocument();
  });
});
