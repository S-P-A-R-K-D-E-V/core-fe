import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { BrandingProvider } from 'src/components/branding';

import type { LabelSource } from '../label-sheet';

// ----------------------------------------------------------------------
// Hộp thoại "In tem mã": số tem từng mã, danh sách mã không in được kèm lý do, ô xem trước là đúng tài
// liệu sẽ in (chỉ trang đầu), nút In gửi cả lệnh in vào iframe ẩn; loại giấy (cuộn / tờ), tuỳ chọn nội
// dung và căn chỉnh được nhớ theo trình duyệt; giới hạn 5.000 tem; xuất danh sách CSV.
// ----------------------------------------------------------------------

const printHtmlDocument = vi.fn((_html: string) => Promise.resolve());
vi.mock('src/utils/print-html', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/utils/print-html')>()),
  printHtmlDocument: (html: string) => printHtmlDocument(html),
}));

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar }),
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

// Imported after the mocks above so the dialog picks up the mocked modules.
import LabelPrintDialog from '../label-print-dialog';
import { LABEL_SETTINGS_STORAGE_KEY, LABEL_CALIBRATION_STORAGE_KEY } from '../label-template';

const shirt: LabelSource = {
  key: 'p1',
  name: 'Áo thun cổ tròn trắng size M',
  code: 'SP000123',
  barcode: '8934567890120',
  price: 185000,
  unit: 'cái',
  quantity: 3,
};
const clip: LabelSource = { key: 'p2', name: 'Kẹp tóc nơ nhung đỏ', code: 'KT-NO-01', price: 35000, quantity: 2 };
const hat: LabelSource = { key: 'p3', name: 'Nón lá', code: 'NÓN-01', price: 45000, quantity: 1 };

const ROLL_74 = 'Cuộn 2 nhãn - khổ 74×22 mm';
const SHEET_65 = 'Giấy 65 nhãn - A4 Tomy 145';

function renderDialog(sources: LabelSource[] = [shirt], storeName: string | null = null) {
  const onClose = vi.fn();
  // Không truyền thương hiệu → cửa hàng CiCi (tên ngắn "CiCi"), như app khi chưa có tenant
  const brand = storeName ? { tenantCode: 'shop-a', storeName, logoUrl: null, primaryColor: null } : null;
  render(
    <ThemeProvider theme={createTheme()}>
      <BrandingProvider value={brand}>
        <LabelPrintDialog open onClose={onClose} sources={sources} />
      </BrandingProvider>
    </ThemeProvider>
  );
  return { onClose };
}

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');

/** Tài liệu đang hiện trong ô xem trước. */
function preview(title = 'Xem trước hàng tem đầu tiên') {
  const frame = screen.getByTitle(title);
  const html = frame.getAttribute('srcdoc') ?? '';
  return { html, doc: parse(html) };
}

const printedHtml = () => printHtmlDocument.mock.calls[printHtmlDocument.mock.calls.length - 1][0];

const savedSettings = () => JSON.parse(window.localStorage.getItem(LABEL_SETTINGS_STORAGE_KEY) as string);
const savedCalibration = () => JSON.parse(window.localStorage.getItem(LABEL_CALIBRATION_STORAGE_KEY) as string);

async function choose(user: ReturnType<typeof userEvent.setup>, field: string, option: string) {
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function setQuantity(user: ReturnType<typeof userEvent.setup>, name: string, value: string) {
  const input = screen.getByLabelText(`Số tem của ${name}`);
  await user.clear(input);
  await user.type(input, value);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('LabelPrintDialog', () => {
  it('một sản phẩm: hiện mã sẽ in, loại mã, số tem; xem trước chỉ hàng đầu trên khổ 74 × 22 mm', () => {
    renderDialog();

    expect(screen.getByRole('heading', { name: /In tem mã/ })).toBeInTheDocument();
    expect(screen.getByText('Áo thun cổ tròn trắng size M')).toBeInTheDocument();
    expect(screen.getByText('8934567890120')).toBeInTheDocument();
    expect(screen.getByText('EAN-13')).toBeInTheDocument();
    expect(screen.getByLabelText('Số tem của Áo thun cổ tròn trắng size M')).toHaveValue(3);
    expect(screen.getByRole('combobox', { name: 'Loại giấy in tem' })).toHaveTextContent(ROLL_74);
    expect(screen.getByRole('button', { name: 'In 3 tem' })).toBeEnabled();
    expect(screen.getByText(`3 tem · 2 hàng (trang in) · ${ROLL_74}`)).toBeInTheDocument();

    const { html, doc } = preview();
    expect(html).toContain('@page{size:74mm 22mm;margin:0}');
    expect(doc.querySelectorAll('.pg')).toHaveLength(1);
    expect(doc.querySelectorAll('.lb')).toHaveLength(2);
    expect(doc.querySelector('.nm')?.textContent).toBe('Áo thun cổ tròn trắng size M');
    expect(doc.querySelector('.pr')?.textContent).toBe('185.000đ');
    expect(doc.querySelector('.st')).toBeNull();
  });

  it('danh sách loại giấy: đủ các mẫu cuộn, giấy tờ, tem trang sức và "Tuỳ chỉnh…"', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('combobox', { name: 'Loại giấy in tem' }));

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Cuộn 3 nhãn - khổ 104×22 mm',
      'Cuộn 2 nhãn - khổ 72×22 mm',
      'Cuộn 2 nhãn - khổ 74×22 mm',
      'Cuộn 3 nhãn - khổ 110×22 mm',
      'Cuộn 1 nhãn - 50×30 mm',
      'Cuộn 1 nhãn - 40×30 mm',
      'Giấy 12 nhãn - Tomy 103 (tờ 202×162 mm)',
      'Giấy 65 nhãn - A4 Tomy 145',
      'Tem trang sức - 75×10 mm',
      'Tuỳ chỉnh…',
    ]);
  });

  it('ghi chú: giới hạn 5.000 tem, mã vạch in không đầy đủ, mã có dấu', () => {
    renderDialog();

    expect(
      screen.getByText(
        /Mỗi lần in tối đa 5\.000 tem\. Nếu mã vạch in không đầy đủ, hãy dùng mẫu giấy lớn hơn hoặc rút ngắn mã hàng\. Mã có dấu tiếng Việt không in được thành mã vạch\./
      )
    ).toBeInTheDocument();
  });

  it('đổi số tem → cập nhật tổng; bấm In gửi CẢ lệnh in (mọi trang) vào iframe in', async () => {
    const user = userEvent.setup();
    renderDialog();

    await setQuantity(user, 'Áo thun cổ tròn trắng size M', '7');

    expect(screen.getByText(`7 tem · 4 hàng (trang in) · ${ROLL_74}`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'In 7 tem' }));

    expect(printHtmlDocument).toHaveBeenCalledTimes(1);
    const printed = parse(printedHtml());
    expect(printedHtml()).toContain('@page{size:74mm 22mm;margin:0}');
    expect(printed.querySelectorAll('.pg')).toHaveLength(4);
    expect(printed.querySelectorAll('.lb')).toHaveLength(7);
    // Ô xem trước vẫn chỉ là hàng đầu của đúng tài liệu đó
    expect(preview().doc.querySelector('.pg')?.outerHTML).toBe(printed.querySelector('.pg')?.outerHTML);
  });

  it('số tem 0 ở mọi dòng → không in được gì', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByLabelText('Số tem của Áo thun cổ tròn trắng size M'));

    expect(screen.getByRole('button', { name: 'In' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Xuất file CSV' })).toBeDisabled();
    expect(screen.getByText('Chưa có tem nào để in')).toBeInTheDocument();
    expect(screen.getByText('Chưa có tem nào in được để xem trước.')).toBeInTheDocument();
    expect(screen.queryByTitle('Xem trước hàng tem đầu tiên')).not.toBeInTheDocument();
  });

  it('quá 5.000 tem → báo rõ và khoá nút In; giảm về 5.000 thì in được', async () => {
    const user = userEvent.setup();
    renderDialog([shirt, { ...clip, code: 'KT01' }]);

    // 4.998 + 2 = đúng 5.000 tem
    await setQuantity(user, 'Áo thun cổ tròn trắng size M', '4998');
    expect(screen.getByRole('button', { name: 'In 5.000 tem' })).toBeEnabled();

    await setQuantity(user, 'Áo thun cổ tròn trắng size M', '5000');
    expect(
      screen.getByText('Mỗi lần in tối đa 5.000 tem — đang chọn 5.002 tem. Giảm số tem hoặc chia thành nhiều lần in.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In' })).toBeDisabled();
    expect(screen.queryByTitle('Xem trước hàng tem đầu tiên')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Số tem của Kẹp tóc nơ nhung đỏ'));
    expect(screen.queryByText(/Mỗi lần in tối đa 5\.000 tem — đang chọn/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In 5.000 tem' })).toBeEnabled();
    expect(screen.getByText(`5.000 tem · 2.500 hàng (trang in) · ${ROLL_74}`)).toBeInTheDocument();
  });

  it('mã không in được (mã có dấu, mã quá dài): liệt kê kèm lý do, các mã còn lại vẫn in', async () => {
    const user = userEvent.setup();
    renderDialog([shirt, clip, hat]);

    const problems = within(screen.getByRole('list', { name: 'Mã hàng không in được' })).getAllByRole('listitem');
    expect(problems).toHaveLength(2);
    expect(problems[0]).toHaveTextContent(
      'Kẹp tóc nơ nhung đỏ (KT-NO-01): Mã quá dài cho khổ tem này: cần 35,75 mm, tem chỉ in được 33 mm. Chọn mẫu tem rộng hơn hoặc giảm độ rộng vạch xuống 1 điểm.'
    );
    expect(problems[1]).toHaveTextContent(
      'Nón lá (NÓN-01): Mã "NÓN-01" có "Ó" không in được thành mã vạch — Code 128 chỉ nhận chữ không dấu, số và ký hiệu thông thường.'
    );
    expect(screen.getByText(/2 mã hàng không in được — các mã còn lại vẫn in bình thường/)).toBeInTheDocument();
    expect(screen.getAllByText('Không in được')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'In 3 tem' }));

    expect(printedHtml()).not.toContain('Kẹp tóc');
    expect(printedHtml()).not.toContain('Nón lá');
    expect(parse(printedHtml()).querySelectorAll('.lb')).toHaveLength(3);
  });

  it('đổi sang mẫu rộng hơn → mã dài in được, khổ trang đổi theo, loại giấy vừa chọn được nhớ', async () => {
    const user = userEvent.setup();
    renderDialog([shirt, clip]);

    await choose(user, 'Loại giấy in tem', 'Cuộn 1 nhãn - 50×30 mm');

    expect(screen.queryByRole('list', { name: 'Mã hàng không in được' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In 5 tem' })).toBeEnabled();
    expect(screen.getByText('5 tem · 5 hàng (trang in) · Cuộn 1 nhãn - 50×30 mm')).toBeInTheDocument();
    expect(preview().html).toContain('@page{size:50mm 30mm;margin:0}');
    expect(preview().doc.querySelectorAll('.lb')).toHaveLength(1);
    expect(savedSettings().templateId).toBe('1x50x30');
  });

  it('giấy tờ A4 65 nhãn: lưới 13 × 5, đếm theo tờ, khổ trang A4, có thêm "Khe hàng thêm"', async () => {
    const user = userEvent.setup();
    renderDialog([shirt, clip]);

    expect(screen.queryByLabelText('Khe hàng thêm')).not.toBeInTheDocument();
    await choose(user, 'Loại giấy in tem', SHEET_65);
    await setQuantity(user, 'Áo thun cổ tròn trắng size M', '68');

    // KT-NO-01 (35,75 mm) vừa tem 38 mm
    expect(screen.queryByRole('list', { name: 'Mã hàng không in được' })).not.toBeInTheDocument();
    expect(screen.getByText(`70 tem · 2 tờ · ${SHEET_65}`)).toBeInTheDocument();

    const first = preview('Xem trước tờ tem đầu tiên');
    expect(first.html).toContain('@page{size:210mm 297mm;margin:0}');
    expect(first.doc.querySelectorAll('.pg')).toHaveLength(1);
    expect(first.doc.querySelectorAll('.lb')).toHaveLength(65);

    await user.click(screen.getByRole('button', { name: 'In 70 tem' }));
    const printed = Array.from(parse(printedHtml()).querySelectorAll('.pg'));
    expect(printed.map((page) => page.querySelectorAll('.lb').length)).toEqual([65, 5]);

    // Căn chỉnh của giấy tờ: thêm khe hàng; độ rộng vạch nói theo mm
    expect(screen.getByRole('combobox', { name: 'Độ rộng vạch' })).toHaveTextContent('0,25 mm — thông dụng');
    await user.click(screen.getByRole('button', { name: 'Tăng Khe hàng thêm' }));
    expect(screen.getByLabelText('Khe hàng thêm')).toHaveTextContent('+0,5 mm');
    expect(preview('Xem trước tờ tem đầu tiên').doc.querySelectorAll('.lb')[5].getAttribute('style')).toBe(
      'left:5mm;top:33.5mm'
    );
    expect(savedCalibration()['tomy-145']).toEqual({
      offsetLeftMm: 0,
      offsetTopMm: 0,
      extraColumnGapMm: 0,
      extraRowGapMm: 0.5,
      moduleDots: 2,
    });
  });

  it('tem trang sức: mặc định vạch 1 điểm, mỗi tem một trang 75 × 10 mm', async () => {
    const user = userEvent.setup();
    renderDialog();

    await choose(user, 'Loại giấy in tem', 'Tem trang sức - 75×10 mm');

    expect(screen.getByRole('combobox', { name: 'Độ rộng vạch' })).toHaveTextContent('1 điểm (0,125 mm)');
    expect(screen.getByRole('button', { name: 'In 3 tem' })).toBeEnabled();
    expect(preview().html).toContain('@page{size:75mm 10mm;margin:0}');
    expect(preview().doc.querySelector('svg.bc')?.getAttribute('viewBox')).toMatch(/^0 0 113 /);
  });

  it('giảm độ rộng vạch xuống 1 điểm → mã dài in được trên tem 35 mm', async () => {
    const user = userEvent.setup();
    renderDialog([clip]);

    expect(screen.getByRole('button', { name: 'In' })).toBeDisabled();
    await choose(user, 'Độ rộng vạch', '1 điểm (0,125 mm) — vạch mảnh, cho mã dài');

    expect(screen.getByRole('button', { name: 'In 2 tem' })).toBeEnabled();
    // 143 module × 1 điểm
    expect(preview().doc.querySelector('svg.bc')?.getAttribute('viewBox')).toMatch(/^0 0 143 /);
    expect(savedCalibration()).toEqual({
      '2x35x22-r74': { offsetLeftMm: 0, offsetTopMm: 0, extraColumnGapMm: 0, extraRowGapMm: 0, moduleDots: 1 },
    });
  });

  it('căn chỉnh: mỗi lần bấm 0,5 mm, áp ngay vào bản xem trước và lưu riêng cho loại giấy đang chọn', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByLabelText('Lệch trái')).toHaveTextContent('0 mm');
    await user.click(screen.getByRole('button', { name: 'Tăng Lệch trái' }));
    await user.click(screen.getByRole('button', { name: 'Tăng Lệch trái' }));
    await user.click(screen.getByRole('button', { name: 'Tăng Lệch trái' }));
    await user.click(screen.getByRole('button', { name: 'Giảm Lệch trên' }));
    await user.click(screen.getByRole('button', { name: 'Tăng Khe cột thêm' }));

    expect(screen.getByLabelText('Lệch trái')).toHaveTextContent('+1,5 mm');
    expect(screen.getByLabelText('Lệch trên')).toHaveTextContent('-0,5 mm');
    expect(screen.getByLabelText('Khe cột thêm')).toHaveTextContent('+0,5 mm');
    expect(Array.from(preview().doc.querySelectorAll('.lb')).map((label) => label.getAttribute('style'))).toEqual([
      'left:2.5mm;top:-0.5mm',
      'left:40mm;top:-0.5mm',
    ]);
    expect(savedCalibration()).toEqual({
      '2x35x22-r74': { offsetLeftMm: 1.5, offsetTopMm: -0.5, extraColumnGapMm: 0.5, extraRowGapMm: 0, moduleDots: 2 },
    });

    // Loại giấy khác có căn chỉnh riêng (chưa chỉnh → 0)
    await choose(user, 'Loại giấy in tem', 'Cuộn 3 nhãn - khổ 110×22 mm');
    expect(screen.getByLabelText('Lệch trái')).toHaveTextContent('0 mm');

    await choose(user, 'Loại giấy in tem', ROLL_74);
    expect(screen.getByLabelText('Lệch trái')).toHaveTextContent('+1,5 mm');

    await user.click(screen.getByRole('button', { name: 'Đặt lại' }));
    expect(screen.getByLabelText('Lệch trái')).toHaveTextContent('0 mm');
    expect(screen.getByLabelText('Lệch trên')).toHaveTextContent('0 mm');
  });

  it('"In thử căn chỉnh" in một hàng có viền, đúng độ lệch đang đặt', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Tăng Lệch trên' }));
    await user.click(screen.getByRole('button', { name: 'In thử căn chỉnh' }));

    expect(printHtmlDocument).toHaveBeenCalledTimes(1);
    const printed = parse(printedHtml());
    expect(printed.title).toBe('In thử căn chỉnh tem');
    expect(printed.querySelectorAll('.pg')).toHaveLength(1);
    expect(printed.querySelectorAll('.lb .mk')).toHaveLength(2);
    expect(printed.querySelector('.lb')?.getAttribute('style')).toBe('left:1mm;top:0.5mm');
    expect(printed.querySelector('.nm')?.textContent).toBe('Tem 1/2 · trái 0 · trên +0,5 · khe 0 · vạch 2 điểm');
  });

  it('tuỳ chọn nội dung: tắt giá / tên, in "Mã hàng" thay cho mã vạch — bản xem trước đổi theo và được nhớ', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByRole('combobox', { name: 'Mã để in vạch' })).toHaveTextContent(
      'Mã vạch — không có thì dùng mã hàng'
    );
    await user.click(screen.getByRole('checkbox', { name: 'In giá bán' }));
    expect(preview().doc.querySelector('.pr')).toBeNull();
    expect(preview().doc.querySelector('.nm')).not.toBeNull();
    // Tắt giá → ẩn luôn các tuỳ chọn của giá
    expect(screen.queryByRole('combobox', { name: 'Chữ sau giá' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'In tên hàng (tối đa 2 dòng)' }));
    expect(preview().doc.querySelector('.nm')).toBeNull();

    await choose(user, 'Mã để in vạch', 'Mã hàng');
    expect(preview().doc.querySelector('.cd')?.textContent).toBe('SP000123');
    expect(screen.getByText('Code 128')).toBeInTheDocument();

    expect(savedSettings().options).toEqual({
      showName: false,
      showStoreName: false,
      showPrice: false,
      priceSuffix: 'đ',
      showUnit: false,
      valueSource: 'code',
    });
  });

  it('giá: chữ "đ" / "VND" / không ghi, kèm đơn vị tính với hàng có đơn vị', async () => {
    const user = userEvent.setup();
    renderDialog([{ ...shirt, quantity: 1 }, { ...clip, code: 'KT01', quantity: 1 }]);

    const prices = () => Array.from(preview().doc.querySelectorAll('.pr')).map((price) => price.textContent);
    expect(prices()).toEqual(['185.000đ', '35.000đ']);
    expect(screen.getByText('Giá sẽ in dạng: 185.000đ')).toBeInTheDocument();

    await choose(user, 'Chữ sau giá', 'VND');
    expect(prices()).toEqual(['185.000 VND', '35.000 VND']);

    // Áo có đơn vị "cái"; kẹp tóc không có đơn vị → chỉ in giá
    await user.click(screen.getByRole('checkbox', { name: 'Kèm đơn vị tính (hàng có đơn vị)' }));
    expect(prices()).toEqual(['185.000 VND/cái', '35.000 VND']);
    expect(screen.getByText('Giá sẽ in dạng: 185.000 VND/cái')).toBeInTheDocument();

    await choose(user, 'Chữ sau giá', 'Không ghi');
    expect(prices()).toEqual(['185.000/cái', '35.000']);
    expect(savedSettings().options).toMatchObject({ showPrice: true, priceSuffix: 'none', showUnit: true });
  });

  it('tên cửa hàng: lấy từ thương hiệu của cửa hàng đang mở, bật thì in ở dòng trên cùng', async () => {
    const user = userEvent.setup();
    renderDialog([shirt], 'Tiệm Nhà Mây');

    expect(preview().doc.querySelector('.st')).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'In tên cửa hàng (Tiệm Nhà Mây)' }));

    const label = preview().doc.querySelector('.lb') as Element;
    expect(label.querySelector('.st')?.textContent).toBe('Tiệm Nhà Mây');
    expect(label.firstElementChild?.getAttribute('class')).toBe('st');
    expect(savedSettings().options.showStoreName).toBe(true);

    await user.click(screen.getByRole('button', { name: 'In 3 tem' }));
    expect(parse(printedHtml()).querySelectorAll('.st')).toHaveLength(3);
  });

  it('cửa hàng CiCi (không có thương hiệu riêng) → tên ngắn "CiCi"', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('checkbox', { name: 'In tên cửa hàng (CiCi)' }));

    expect(preview().doc.querySelector('.st')?.textContent).toBe('CiCi');
  });

  it('mẫu tuỳ chỉnh: sửa được các số, số sai thì báo lỗi và khoá nút In', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.queryByLabelText('Rộng tem (mm)')).not.toBeInTheDocument();
    await choose(user, 'Loại giấy in tem', 'Tuỳ chỉnh…');

    const columns = screen.getByLabelText('Số tem mỗi hàng (tem)');
    expect(screen.getByLabelText('Khổ cuộn (mm)')).toHaveValue(74);
    expect(screen.getByLabelText('Rộng tem (mm)')).toHaveValue(35);
    expect(screen.getByLabelText('Cao tem (mm)')).toHaveValue(22);
    expect(columns).toHaveValue(2);
    // Giấy cuộn: không có số hàng / chiều cao tờ
    expect(screen.queryByLabelText('Số hàng mỗi tờ (hàng)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Cao tờ giấy (mm)')).not.toBeInTheDocument();

    // 3 tem 35 mm không vừa cuộn 74 mm
    await user.clear(columns);
    await user.type(columns, '3');
    expect(screen.getByText('Khổ cuộn 74 mm hẹp hơn tổng lề trái, các tem và khe (110 mm).')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'In thử căn chỉnh' })).toBeDisabled();

    const roll = screen.getByLabelText('Khổ cuộn (mm)');
    await user.clear(roll);
    await user.type(roll, '110');
    expect(screen.queryByText(/Khổ cuộn .* hẹp hơn/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In 3 tem' })).toBeEnabled();
    expect(preview().html).toContain('@page{size:110mm 22mm;margin:0}');
    expect(preview().doc.querySelectorAll('.lb')).toHaveLength(3);

    expect(savedSettings().templateId).toBe('custom');
    expect(savedSettings().customTemplate).toMatchObject({ pageWidthMm: 110, columns: 3, labelWidthMm: 35 });
  });

  it('mẫu tuỳ chỉnh kiểu giấy tờ: thêm số hàng, chiều cao tờ, khe dọc — một tờ là một lưới tem', async () => {
    const user = userEvent.setup();
    renderDialog([{ ...shirt, quantity: 5 }]);

    await choose(user, 'Loại giấy in tem', 'Tuỳ chỉnh…');
    await choose(user, 'Kiểu giấy', 'Giấy tờ (A4, A5…) — nhiều hàng');

    const type = async (label: string, value: string) => {
      const input = screen.getByLabelText(label);
      await user.clear(input);
      await user.type(input, value);
    };
    await type('Cao tờ giấy (mm)', '100');
    await type('Số hàng mỗi tờ (hàng)', '2');
    await type('Khe dọc giữa hai hàng (mm)', '3');
    await type('Lề trên (mm)', '5');
    expect(screen.getByLabelText('Rộng tờ giấy (mm)')).toHaveValue(74);

    // 2 hàng × 2 tem = 4 tem mỗi tờ → 5 tem cần 2 tờ
    expect(screen.getByText('5 tem · 2 tờ · Tuỳ chỉnh')).toBeInTheDocument();
    const first = preview('Xem trước tờ tem đầu tiên');
    expect(first.html).toContain('@page{size:74mm 100mm;margin:0}');
    expect(Array.from(first.doc.querySelectorAll('.lb')).map((label) => label.getAttribute('style'))).toEqual([
      'left:1mm;top:5mm',
      'left:38mm;top:5mm',
      'left:1mm;top:30mm',
      'left:38mm;top:30mm',
    ]);
    expect(savedSettings().customTemplate).toMatchObject({ kind: 'sheet', rows: 2, pageHeightMm: 100, rowGapMm: 3 });
  });

  it('mở lại: dùng loại giấy, tuỳ chọn và căn chỉnh đã nhớ trong trình duyệt', () => {
    window.localStorage.setItem(
      LABEL_SETTINGS_STORAGE_KEY,
      JSON.stringify({ templateId: '1x50x30', options: { showName: true, showPrice: false, valueSource: 'code' } })
    );
    window.localStorage.setItem(
      LABEL_CALIBRATION_STORAGE_KEY,
      JSON.stringify({ '1x50x30': { offsetLeftMm: -1, offsetTopMm: 2, extraColumnGapMm: 0, moduleDots: 3 } })
    );

    renderDialog();

    expect(screen.getByRole('combobox', { name: 'Loại giấy in tem' })).toHaveTextContent('Cuộn 1 nhãn - 50×30 mm');
    expect(screen.getByRole('checkbox', { name: 'In giá bán' })).not.toBeChecked();
    expect(screen.getByLabelText('Lệch trái')).toHaveTextContent('-1 mm');
    expect(screen.getByLabelText('Lệch trên')).toHaveTextContent('+2 mm');
    expect(screen.getByRole('combobox', { name: 'Độ rộng vạch' })).toHaveTextContent('3 điểm');
    expect(preview().doc.querySelector('.lb')?.getAttribute('style')).toBe('left:-1mm;top:2mm');
    expect(preview().doc.querySelector('.cd')?.textContent).toBe('SP000123');
  });

  it('hướng dẫn "Cài đặt máy in" thu gọn sẵn, mở ra có khổ giấy của loại giấy đang chọn', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.queryByText(/Lề: Không có/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cài đặt máy in' }));

    const help = screen.getByText(/Lề: Không có/).closest('ol') as HTMLElement;
    expect(help).toHaveTextContent('chọn đúng máy in tem');
    expect(help).toHaveTextContent('Khổ giấy = một hàng tem: 74 × 22 mm');
    expect(help).toHaveTextContent('Tỉ lệ: 100%');
    expect(help).toHaveTextContent('Bỏ chọn “Đầu trang và chân trang”');
    expect(help).toHaveTextContent('bật cảm biến khe hở giữa các tem');

    // Giấy tờ: khổ giấy là cả tờ, không nhắc cảm biến khe hở
    await choose(user, 'Loại giấy in tem', SHEET_65);
    expect(help).toHaveTextContent('Khổ giấy = cả tờ tem: 210 × 297 mm');
    expect(help).toHaveTextContent('máy in giấy tờ (laser / in phun)');
    expect(help).not.toHaveTextContent('cảm biến khe hở');
  });

  it('"Xuất file CSV": tải danh sách tem (mã, mã vạch, tên, giá, số tem) dạng UTF-8 có BOM', async () => {
    const user = userEvent.setup();
    const blobs: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:danh-sach';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
      downloads.push(`${this.download} ← ${this.getAttribute('href')}`);
    });
    renderDialog([shirt, clip]);

    await user.click(screen.getByRole('button', { name: 'Xuất file CSV' }));

    expect(downloads).toEqual(['danh-sach-tem-ma.csv ← blob:danh-sach']);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:danh-sach');
    expect(blobs[0].type).toBe('text/csv;charset=utf-8');

    const bytes = await new Promise<Uint8Array>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.readAsArrayBuffer(blobs[0]);
    });
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes).split('\r\n')).toEqual([
      'Mã hàng,Mã vạch,Tên hàng,Giá bán,Số tem',
      'SP000123,8934567890120,Áo thun cổ tròn trắng size M,185000,3',
      'KT-NO-01,,Kẹp tóc nơ nhung đỏ,35000,2',
      '',
    ]);
  });

  it('trình duyệt không mở được hộp thoại in → báo lỗi tiếng Việt', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    printHtmlDocument.mockRejectedValueOnce(new Error('blocked'));
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'In 3 tem' }));

    await vi.waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Không mở được hộp thoại in của trình duyệt', {
        variant: 'error',
      })
    );
  });

  it('nút Đóng và nút X ở tiêu đề đều gọi onClose', async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Đóng' }));
    await user.click(screen.getByRole('button', { name: 'Đóng hộp thoại' }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
