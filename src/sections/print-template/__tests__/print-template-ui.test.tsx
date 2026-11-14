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

vi.mock('src/api/purchase-orders', () => ({
  getAllPurchaseOrders: vi.fn().mockResolvedValue({ items: [] }),
  getPurchaseOrderPrint: vi.fn(),
}));

const uploadTemplateImage = vi.fn();
vi.mock('../print-image-upload', () => ({
  uploadTemplateImage: (...args: any[]) => uploadTemplateImage(...args),
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

describe('ReceiptTemplateEditor — ảnh, logo, chia cột', () => {
  const IMG = 'https://cici.vn/media/print-templates/img-1-abcd1234.png';

  function renderEditor(value = '<p>Đầu phiếu</p>') {
    const onChange = vi.fn();
    wrap(
      <ReceiptTemplateEditor
        value={value}
        onChange={onChange}
        settings={defaultReceiptSettings('80')}
        zoom={1}
        logoUrl="https://cici.vn/media/branding/logo.png"
      />
    );
    return onChange;
  }

  const lastHtml = (onChange: ReturnType<typeof vi.fn>) => onChange.mock.calls.at(-1)![0] as string;

  it('chia cột rồi đổi bố cục, bỏ chia cột vẫn giữ nội dung', async () => {
    const onChange = renderEditor();
    const user = userEvent.setup();
    await screen.findByText('Đầu phiếu');

    await user.click(screen.getByRole('button', { name: 'Chia cột' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Chia ba (3 cột đều)' }));
    await waitFor(() => expect(lastHtml(onChange)).toContain('<div class="cols cols-3">'));
    expect(lastHtml(onChange).match(/class="col"/g)).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Chia cột' }));
    await user.click(await screen.findByRole('menuitem', { name: '1/3 trái – 2/3 phải' }));
    await waitFor(() => expect(lastHtml(onChange)).toContain('<div class="cols cols-12">'));
    expect(lastHtml(onChange).match(/class="col"/g)).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Chia cột' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Bỏ chia cột (giữ nội dung)' }));
    await waitFor(() => expect(lastHtml(onChange)).not.toContain('cols'));
    expect(lastHtml(onChange)).toContain('Đầu phiếu');
  });

  it('chèn logo (không lưu src) và ảnh tải lên, đổi cỡ ảnh bằng nút %', async () => {
    uploadTemplateImage.mockResolvedValue(IMG);
    const onChange = renderEditor();
    const user = userEvent.setup();
    await screen.findByText('Đầu phiếu');

    await user.click(screen.getByRole('button', { name: 'Chèn logo cửa hàng' }));
    await waitFor(() =>
      expect(lastHtml(onChange)).toMatch(/<img class="store-logo" style="width: 40%;?" alt="Logo">/)
    );
    // Trong trình soạn, logo hiện bằng logo hiện tại của cửa hàng.
    expect(document.querySelector('.ProseMirror .tpl-img--logo img')?.getAttribute('src')).toBe(
      'https://cici.vn/media/branding/logo.png'
    );

    const file = new File([new Uint8Array([1, 2, 3])], 'anh.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Chọn ảnh để chèn vào phiếu'), file);
    await waitFor(() =>
      expect(lastHtml(onChange)).toMatch(new RegExp(`<img src="${IMG}" style="width: 50%;?"`))
    );
    expect(uploadTemplateImage).toHaveBeenCalledWith(file);

    // Ảnh vừa chèn được chọn sẵn → thanh công cụ có nút cỡ ảnh.
    await user.click(await screen.findByRole('button', { name: 'Rộng 75% khối chứa' }));
    await waitFor(() =>
      expect(lastHtml(onChange)).toMatch(new RegExp(`<img src="${IMG}" style="width: 75%;?"`))
    );
  });

  it('tải ảnh lỗi thì báo, không chèn gì', async () => {
    uploadTemplateImage.mockRejectedValue(new Error('Ảnh tối đa 2 MB.'));
    const onChange = renderEditor();
    const user = userEvent.setup();
    await screen.findByText('Đầu phiếu');

    await user.upload(
      screen.getByLabelText('Chọn ảnh để chèn vào phiếu'),
      new File([new Uint8Array([1])], 'to.png', { type: 'image/png' })
    );

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Ảnh tối đa 2 MB.', { variant: 'error' })
    );
    expect(onChange.mock.calls.some(([html]) => String(html).includes('<img'))).toBe(false);
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

  it('thêm logo cửa hàng và ảnh tải lên vào tem', async () => {
    uploadTemplateImage.mockResolvedValue(
      'https://cici.vn/media/print-templates/img-2-abcd1234.png'
    );
    const onDesign = vi.fn();
    const user = userEvent.setup();
    wrap(<Harness onDesign={onDesign} />);

    await user.click(screen.getByRole('button', { name: 'Thêm Logo cửa hàng' }));
    const last = () => onDesign.mock.calls.at(-1)![0] as LabelDesign;
    expect(last().elements[0]).toMatchObject({ type: 'image', logo: true });
    expect(screen.getByRole('heading', { name: 'Ảnh' })).toBeInTheDocument();

    await user.upload(
      screen.getByLabelText('Chọn ảnh để thêm vào tem'),
      new File([new Uint8Array([1])], 'a.png', { type: 'image/png' })
    );
    await waitFor(() => expect(last().elements).toHaveLength(2));
    expect(last().elements[1]).toMatchObject({
      type: 'image',
      src: 'https://cici.vn/media/print-templates/img-2-abcd1234.png',
    });
  });

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

describe('PrintTemplateListView — phiếu nhập', () => {
  it('thẻ Phiếu nhập: chọn mẫu mặc định rồi lưu ô (*, *) của loại purchase', async () => {
    api.getPrintTemplates.mockResolvedValue({
      templates: [
        {
          id: 'p1',
          kind: 'purchase',
          name: 'Phiếu nhập A4',
          content: '<p>{{supplier_name}}</p>',
          settings: '{"paper":"A4"}',
          createdAt: '2026-11-14T00:00:00Z',
          updatedAt: null,
        },
      ],
      assignments: [],
    });
    api.setPrintTemplateAssignments.mockResolvedValue([]);
    const user = userEvent.setup();
    wrap(<PrintTemplateListView />);

    await user.click(await screen.findByRole('tab', { name: 'Phiếu nhập (1)' }));
    expect(screen.getByText('Mẫu phiếu nhập đang áp dụng')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Tạo mẫu phiếu nhập/ })).toHaveAttribute(
      'href',
      '/dashboard/store-settings/print-templates/new?kind=purchase'
    );

    await user.click(screen.getByRole('combobox', { name: 'Mẫu phiếu nhập mặc định' }));
    await user.click(await screen.findByRole('option', { name: 'Phiếu nhập A4' }));
    const card = screen
      .getByText('Mẫu phiếu nhập đang áp dụng')
      .closest('.MuiCard-root') as HTMLElement;
    await user.click(within(card).getByRole('button', { name: 'Lưu' }));

    await waitFor(() =>
      expect(api.setPrintTemplateAssignments).toHaveBeenCalledWith('purchase', [
        { channel: '*', paymentMethod: '*', templateId: 'p1' },
      ])
    );
  });
});

describe('PrintTemplateEditView', () => {
  it('mẫu phiếu nhập mới: khối của phiếu nhập, bắt đầu từ A4; Tạo mẫu gửi loại purchase', async () => {
    api.createPrintTemplate.mockResolvedValue({ id: 'pn-id', kind: 'purchase' });
    const user = userEvent.setup();
    wrap(<PrintTemplateEditView id="new" kind="purchase" />);

    expect(await screen.findByTitle('Xem trước mẫu phiếu nhập')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm khối Thông tin phiếu nhập' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm khối Chữ ký' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm khối Thông tin hoá đơn' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm khối QR chuyển khoản' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tạo mẫu' }));
    await waitFor(() => expect(api.createPrintTemplate).toHaveBeenCalledTimes(1));
    const [kind, payload] = api.createPrintTemplate.mock.calls[0];
    expect(kind).toBe('purchase');
    expect(payload.name).toBe('Phiếu nhập A4');
    const settings = JSON.parse(payload.settings);
    expect(settings.paper).toBe('A4');
    expect(settings.blocks.items.map((b: any) => b.type)).toContain('signatures');
    expect(payload.content).toContain('{{supplier_name}}');
    expect(payload.content).toContain('{{item_name}}');
  });

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

  it('soạn theo khối: thêm khối, tắt dòng đầu phiếu; lưu khối vào settings và HTML dịch từ khối vào content', async () => {
    api.createPrintTemplate.mockResolvedValue({ id: 'blk-id', kind: 'receipt' });
    const user = userEvent.setup();
    wrap(<PrintTemplateEditView id="new" kind="receipt" />);

    expect(await screen.findByText(/Bố cục phiếu · 12 khối/)).toBeInTheDocument();
    // Bấm loại khối → thêm sau khối đang chọn (khối đầu).
    await user.click(screen.getByRole('button', { name: 'Thêm khối Chữ tự do' }));
    expect(screen.getByText(/Bố cục phiếu · 13 khối/)).toBeInTheDocument();
    expect(screen.getByLabelText('Nội dung')).toHaveValue('Đổi hàng trong 3 ngày kèm hoá đơn');

    // Chọn khối Đầu cửa hàng, bỏ Mã số thuế.
    // Tên khối có ở cả cột loại khối và bố cục — lấy cái trong bố cục (sau cùng).
    await user.click(screen.getAllByText('Đầu cửa hàng').at(-1)!);
    await user.click(screen.getByRole('checkbox', { name: 'Mã số thuế' }));

    await user.click(screen.getByRole('button', { name: 'Tạo mẫu' }));
    await waitFor(() => expect(api.createPrintTemplate).toHaveBeenCalledTimes(1));
    const [, payload] = api.createPrintTemplate.mock.calls[0];
    const settings = JSON.parse(payload.settings);
    expect(settings.paper).toBe('80');
    expect(settings.blocks.v).toBe(1);
    expect(settings.blocks.items).toHaveLength(13);
    expect(settings.blocks.items[1].type).toBe('text');
    expect(payload.content).toContain('Đổi hàng trong 3 ngày kèm hoá đơn');
    expect(payload.content).toContain('{{store_name}}');
    expect(payload.content).not.toContain('{{store_tax_code}}');
  });

  it('mở mẫu có khối thì soạn theo khối; "Soạn tự do" chuyển một chiều và lưu bỏ khối', async () => {
    const blocks = [
      { id: 'a', type: 'storeHeader', lines: { name: true, branch: false, address: false, phone: false, taxCode: false } },
      { id: 'b', type: 'text', text: 'Xin cảm ơn' },
    ];
    api.getPrintTemplate.mockResolvedValue({
      id: 't1',
      kind: 'receipt',
      name: 'Mẫu khối',
      content: '<p>cũ</p>',
      settings: JSON.stringify({ paper: '58', blocks: { v: 1, items: blocks } }),
      createdAt: '2026-11-13T00:00:00Z',
      updatedAt: null,
    });
    api.updatePrintTemplate.mockResolvedValue({ id: 't1', kind: 'receipt', content: '<p>x</p>' });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    wrap(<PrintTemplateEditView id="t1" />);

    expect(await screen.findByText(/Bố cục phiếu · 2 khối/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Soạn tự do' }));
    await waitFor(() => expect(document.querySelector('.ProseMirror')).not.toBeNull());
    expect(screen.queryByText(/Bố cục phiếu/)).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(api.updatePrintTemplate).toHaveBeenCalledTimes(1));
    const [, payload] = api.updatePrintTemplate.mock.calls[0];
    expect(JSON.parse(payload.settings).blocks).toBeUndefined();
    expect(JSON.parse(payload.settings).paper).toBe('58');
    expect(payload.content).toContain('Xin cảm ơn');
    confirm.mockRestore();
  });

  it('mẫu HTML cũ (không có khối) vẫn mở bằng trình soạn tự do', async () => {
    api.getPrintTemplate.mockResolvedValue({
      id: 't2',
      kind: 'receipt',
      name: 'Mẫu cũ',
      content: '<p>{{store_name}}</p>',
      settings: '{"paper":"80"}',
      createdAt: '2026-11-13T00:00:00Z',
      updatedAt: null,
    });
    wrap(<PrintTemplateEditView id="t2" />);
    await waitFor(() => expect(document.querySelector('.ProseMirror')).not.toBeNull());
    expect(screen.queryByText(/Bố cục phiếu/)).toBeNull();
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
