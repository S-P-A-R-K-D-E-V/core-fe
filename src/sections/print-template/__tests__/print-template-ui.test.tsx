import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { it, vi, expect, describe, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Giao diện mẫu in: trình soạn hoá đơn (chèn trường / khối dựng sẵn, cỡ chữ giữ khi lưu), khung thiết kế tem (thêm, sửa,
// nhích, xoá phần tử), trang danh sách (lưu bảng mẫu áp dụng kênh × phương thức), trang soạn (tạo mẫu mới).
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

vi.mock('src/components/iconify', () => ({ default: () => null }));

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock('src/routes/hooks', () => ({ useRouter: () => router }));
vi.mock('src/routes/components', async () => {
  const { forwardRef } = await import('react');
  return {
    RouterLink: forwardRef<HTMLAnchorElement, any>(({ href, children, ...rest }, ref) => (
      <a ref={ref} href={href} {...rest}>
        {children}
      </a>
    )),
  };
});

const api = {
  getPrintTemplates: vi.fn(),
  getPrintTemplate: vi.fn(),
  createPrintTemplate: vi.fn(),
  updatePrintTemplate: vi.fn(),
  deletePrintTemplate: vi.fn(),
  setPrintTemplateAssignments: vi.fn(),
};
vi.mock('src/api/print-templates', () => ({
  getPrintTemplates: (...args: any[]) => api.getPrintTemplates(...args),
  getPrintTemplate: (...args: any[]) => api.getPrintTemplate(...args),
  createPrintTemplate: (...args: any[]) => api.createPrintTemplate(...args),
  updatePrintTemplate: (...args: any[]) => api.updatePrintTemplate(...args),
  deletePrintTemplate: (...args: any[]) => api.deletePrintTemplate(...args),
  setPrintTemplateAssignments: (...args: any[]) => api.setPrintTemplateAssignments(...args),
}));

vi.mock('src/api/sales-orders', () => ({
  getAllSalesOrders: vi.fn().mockResolvedValue({ items: [] }),
  getSalesOrderReceipt: vi.fn(),
}));

// jsdom không dàn trang: số đo chiều cao giấy cuộn cố định.
vi.mock('../receipt/receipt-template-render', async (importOriginal) => {
  const original = await importOriginal<typeof import('../receipt/receipt-template-render')>();
  return {
    ...original,
    renderReceiptTemplate: (template: any, receipt: any) =>
      original.renderReceiptTemplate(template, receipt, { measure: async () => 100 }),
  };
});

// Imported after the mocks above.
import { LabelDesigner } from '../label/label-designer';
import { defaultLabelDesign } from '../label/label-design';
import { ReceiptTemplateEditor } from '../receipt/receipt-template-editor';
import { defaultReceiptSettings } from '../receipt/receipt-template-settings';
import { PrintTemplateEditView } from '../view/print-template-edit-view';
import { PrintTemplateListView } from '../view/print-template-list-view';

import type { LabelDesign } from '../label/label-design';

const theme = createTheme();

const wrap = (ui: React.ReactElement) => render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

beforeEach(() => {
  api.getPrintTemplates.mockResolvedValue({ templates: [], assignments: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ReceiptTemplateEditor', () => {
  it('hiện trường là thẻ tên tiếng Việt, chèn trường và khối dựng sẵn, giữ cỡ chữ khi lưu', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    wrap(
      <ReceiptTemplateEditor
        value={'<p><span style="font-size: 14pt">Lớn</span> {{store_name}}</p>'}
        onChange={onChange}
        settings={defaultReceiptSettings('80')}
        zoom={1}
      />
    );

    expect(await screen.findByText('Lớn')).toBeInTheDocument();
    expect(
      document.querySelector('.ProseMirror .merge-field[data-field="store_name"]')?.textContent
    ).toBe('Tên cửa hàng');
    expect(document.querySelector('.ProseMirror span[style*="font-size"]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Chèn trường Mã hoá đơn' }));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('{{invoice_code}}'))
    );
    expect(onChange.mock.calls.at(-1)![0]).toContain('font-size: 14pt');

    await user.click(screen.getByRole('button', { name: 'Chèn khối dựng sẵn' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Bảng tổng tiền' }));
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining('{{subtotal}}'))
    );
    expect(onChange.mock.calls.at(-1)![0]).toContain('<table');
    // Thẻ trường dòng hàng có dấu lặp.
    expect(screen.getByRole('button', { name: 'Chèn trường Tên hàng' })).toHaveTextContent(
      '⟳ Tên hàng'
    );
  });
});

describe('LabelDesigner', () => {
  function Harness({ onDesign }: { onDesign: (design: LabelDesign) => void }) {
    const [design, setDesign] = useState<LabelDesign>({
      ...defaultLabelDesign('1x50x30'),
      elements: [],
    });
    return (
      <LabelDesigner
        value={design}
        onChange={(next) => {
          setDesign(next);
          onDesign(next);
        }}
        context={{ storeName: 'CiCi' }}
      />
    );
  }

  it('thêm phần tử từ bảng, sửa vị trí, nhích bằng phím, xoá', async () => {
    const onDesign = vi.fn();
    const user = userEvent.setup();
    wrap(<Harness onDesign={onDesign} />);

    await user.click(screen.getByRole('button', { name: 'Thêm Tên hàng' }));
    const last = () => onDesign.mock.calls.at(-1)![0] as LabelDesign;
    expect(last().elements).toHaveLength(1);
    expect(last().elements[0]).toMatchObject({
      type: 'text',
      text: '{{product_name}}',
      bold: true,
    });
    // Lớp hiển thị dùng đúng HTML in với dữ liệu mẫu.
    expect(document.querySelector('.lb .tx')?.textContent).toBe('Kẹp tóc nơ nhung đỏ size lớn');

    await user.click(screen.getByRole('button', { name: 'Thêm Mã QR' }));
    expect(screen.getByRole('heading', { name: 'Mã QR' })).toBeInTheDocument();
    const x = screen.getByLabelText('X (mm)');
    fireEvent.change(x, { target: { value: '5' } });
    expect(last().elements[1].xMm).toBe(5);

    fireEvent.keyDown(screen.getByRole('application', { name: 'Khung thiết kế tem' }), {
      key: 'ArrowRight',
    });
    expect(last().elements[1].xMm).toBe(5.5);

    fireEvent.keyDown(screen.getByRole('application', { name: 'Khung thiết kế tem' }), {
      key: 'Delete',
    });
    expect(last().elements.map((element) => element.type)).toEqual(['text']);
    // Bỏ chọn → bảng bên phải là khổ giấy.
    expect(screen.getByRole('combobox', { name: 'Loại giấy in tem' })).toHaveTextContent(
      'Cuộn 1 nhãn - 50×30 mm'
    );
  });
});

describe('PrintTemplateListView', () => {
  const template = (id: string, name: string) => ({
    id,
    kind: 'receipt',
    name,
    content: '<p>{{store_name}}</p>',
    settings: '{"paper":"58"}',
    createdAt: '2026-10-29T00:00:00Z',
    updatedAt: null,
  });

  it('bảng kênh × phương thức: ô trống hiện mẫu kế thừa, lưu ghi đè cả bảng', async () => {
    api.getPrintTemplates.mockResolvedValue({
      templates: [template('a', 'Mẫu chung'), template('b', 'Quầy tiền mặt')],
      assignments: [{ kind: 'receipt', channel: '*', paymentMethod: '*', templateId: 'a' }],
    });
    api.setPrintTemplateAssignments.mockResolvedValue([]);
    const user = userEvent.setup();
    wrap(<PrintTemplateListView />);

    const cell = await screen.findByRole('combobox', { name: 'Mẫu cho Bán tại quầy · Tiền mặt' });
    expect(cell).toHaveTextContent('↳ Mẫu chung');
    expect(screen.getAllByText('Giấy cuộn 58 mm')).toHaveLength(2);

    await user.click(cell);
    await user.click(await screen.findByRole('option', { name: 'Quầy tiền mặt' }));
    const card = screen
      .getByText('Mẫu hoá đơn đang áp dụng')
      .closest('.MuiCard-root') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Lưu' }));

    await waitFor(() =>
      expect(api.setPrintTemplateAssignments).toHaveBeenCalledWith('receipt', [
        { channel: '*', paymentMethod: '*', templateId: 'a' },
        { channel: 'pos', paymentMethod: 'cash', templateId: 'b' },
      ])
    );
  });
});

describe('PrintTemplateEditView', () => {
  it('mẫu hoá đơn mới bắt đầu từ mẫu chuẩn; Tạo mẫu gửi HTML + thiết lập rồi chuyển sang trang của mẫu', async () => {
    api.createPrintTemplate.mockResolvedValue({ id: 'new-id', kind: 'receipt' });
    const user = userEvent.setup();
    wrap(<PrintTemplateEditView id="new" kind="receipt" />);

    expect(await screen.findByTitle('Xem trước mẫu hoá đơn')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tạo mẫu' }));

    await waitFor(() => expect(api.createPrintTemplate).toHaveBeenCalledTimes(1));
    const [kind, payload] = api.createPrintTemplate.mock.calls[0];
    expect(kind).toBe('receipt');
    expect(payload.name).toBe('Hoá đơn giấy cuộn 80 mm');
    expect(payload.content).toContain('{{store_name}}');
    expect(JSON.parse(payload.settings)).toMatchObject({ paper: '80', marginLeftMm: 4 });
    expect(router.replace).toHaveBeenCalledWith('/dashboard/store-settings/print-templates/new-id');
  });

  it('mẫu tem mới lưu bố cục JSON đã về lưới điểm in', async () => {
    api.createPrintTemplate.mockResolvedValue({ id: 'tem-id', kind: 'label' });
    const user = userEvent.setup();
    wrap(<PrintTemplateEditView id="new" kind="label" />);

    await user.click(await screen.findByRole('button', { name: 'Tạo mẫu' }));

    await waitFor(() => expect(api.createPrintTemplate).toHaveBeenCalledTimes(1));
    const [kind, payload] = api.createPrintTemplate.mock.calls[0];
    expect(kind).toBe('label');
    const design = JSON.parse(payload.content);
    expect(design.elements.length).toBeGreaterThan(0);
    design.elements.forEach((element: { xMm: number; wMm: number }) => {
      expect(Number.isInteger(element.xMm * 8)).toBe(true);
      expect(Number.isInteger(element.wMm * 8)).toBe(true);
    });
  });
});
