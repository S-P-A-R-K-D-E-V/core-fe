import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, within, screen, waitFor, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IEmployeeProfile, IEmploymentContract } from 'src/types/hr';
import { CONTRACT_SIGN_CONSENT } from 'src/types/hr';

// ----------------------------------------------------------------------
// Hợp đồng lao động: chỉ Admin (hr.contract.manage) thấy các tab quản lý; nhân viên chỉ xem hợp đồng của mình; trang in
// thoát ký tự HTML; lưu hồ sơ nhân sự gửi đúng trường.
// ----------------------------------------------------------------------

vi.mock('next/font/google', () => {
  const font = () => ({ style: { fontFamily: 'sans-serif' } });
  return { Inter: font, DM_Sans: font, Nunito_Sans: font, Barlow: font, Public_Sans: font };
});

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/components/settings', () => ({ useSettingsContext: () => ({ themeStretch: false }) }));
vi.mock('src/components/custom-breadcrumbs', () => ({
  default: ({ heading }: { heading: string }) => <h1>{heading}</h1>,
}));

const auth = { user: { id: 'lan', role: 'Staff', permissions: [] as string[] } };
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => auth }));
vi.mock('src/api/users', () => ({ getActiveStaffUsers: vi.fn().mockResolvedValue([]) }));

const api = vi.hoisted(() => ({
  getContracts: vi.fn(),
  getMyContracts: vi.fn(),
  getEmployeeProfiles: vi.fn(),
  saveEmployeeProfile: vi.fn(),
  getContractTemplates: vi.fn(),
  getContractFields: vi.fn(),
  createContractTemplate: vi.fn(),
  uploadContractTemplateImport: vi.fn(),
  streamContractTemplateImport: vi.fn(),
  signContract: vi.fn(),
}));
vi.mock('src/api/contract-import-stream', () => ({
  ContractImportError: class extends Error {},
  streamContractTemplateImport: (...a: any[]) => api.streamContractTemplateImport(...a),
}));
vi.mock('src/api/hr', () => ({
  ...Object.fromEntries(Object.keys(api).map((k) => [k, (...a: any[]) => (api as any)[k](...a)])),
  contractImportType: (f: File) => (/\.(docx|pdf)$/i.test(f.name) ? 'application/octet-stream' : null),
  voidContract: vi.fn(),
  createContract: vi.fn(),
  finalizeContract: vi.fn(),
  terminateContract: vi.fn(),
  markContractSigned: vi.fn(),
  updateContractDraft: vi.fn(),
  uploadContractFiles: vi.fn(),
  deleteContractTemplate: vi.fn(),
  updateContractTemplate: vi.fn(),
  publishContractTemplate: vi.fn(),
  saveContractBody: vi.fn(),
  getEditableContractBody: vi.fn(),
  previewContractTemplate: vi.fn(),
}));

// jsdom chưa có PointerEvent: dựng từ MouseEvent để khung ký nhận toạ độ.
if (!(window as any).PointerEvent) {
  (window as any).PointerEvent = class extends MouseEvent {
    pointerId: number;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
    }
  };
}

// Imported after the mocks above.
import HrContractsView, { buildPrintHtml, contractBodyHtml } from 'src/sections/hr/view/hr-contracts-view';

const wrap = (node: React.ReactNode) => render(<ThemeProvider theme={createTheme()}>{node}</ThemeProvider>);

const contract: IEmploymentContract = {
  id: 'c1',
  staffId: 'lan',
  staffName: 'Trần Lan',
  templateId: 't1',
  templateVersion: 1,
  contractNumber: '01/2026/HĐLĐ',
  contractType: 'FixedTermUnder12Months',
  startDate: '2026-11-01',
  endDate: '2027-04-30',
  jobTitle: 'Nhân viên bán hàng',
  isPartTime: true,
  renderedBody: 'HỢP ĐỒNG LAO ĐỘNG\nNgười lao động: Trần Lan',
  missingFields: [],
  status: 'Signed',
  signedOn: '2026-10-30',
  createdAt: '2026-10-27T03:00:00Z',
  files: [{ id: 'f1', url: '/media/contracts/c1/a.pdf?sig=x', contentType: 'application/pdf', uploadedAt: '2026-10-30T03:00:00Z' }],
};

afterEach(() => {
  vi.clearAllMocks();
  auth.user.permissions = [];
});

describe('buildPrintHtml', () => {
  it('escapes HTML in the contract body', () => {
    const html = buildPrintHtml({ renderedBody: '<script>x</script> & "y"', contractNumber: '01/2026/HĐLĐ', staffName: 'Lan' });
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt; &amp; &quot;y&quot;');
    expect(html).not.toContain('<script>');
  });
});

describe('HrContractsView', () => {
  it('staff only see their own contract, read-only', async () => {
    api.getMyContracts.mockResolvedValue([contract]);
    const user = userEvent.setup();

    wrap(<HrContractsView />);

    expect(await screen.findByText('Hợp đồng số 01/2026/HĐLĐ')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Hồ sơ nhân sự' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Soạn hợp đồng' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Bản ký trang 1' })).toHaveAttribute('href', contract.files[0].url);
    await user.click(screen.getByRole('button', { name: 'Xem nội dung' }));
    expect(screen.getByText(/Người lao động: Trần Lan/)).toBeInTheDocument();
    expect(api.getContracts).not.toHaveBeenCalled();
  });

  it('admin edits a profile and sends only profile fields', async () => {
    auth.user.permissions = ['hr.contract.manage'];
    api.getContracts.mockResolvedValue([]);
    const profile: IEmployeeProfile = { userId: 'lan', fullName: 'Trần Lan', hasIdCardImages: true, missingFields: ['Số CCCD'] };
    api.getEmployeeProfiles.mockResolvedValue([profile]);
    api.saveEmployeeProfile.mockResolvedValue({ ...profile, idNumber: '001304012345', missingFields: [] });
    const user = userEvent.setup();

    wrap(<HrContractsView />);
    await user.click(await screen.findByRole('tab', { name: 'Hồ sơ nhân sự' }));
    await user.click(await screen.findByText('Trần Lan'));
    await user.type(screen.getByLabelText('Số CCCD (12 chữ số)'), '001304012345');
    await user.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() =>
      expect(api.saveEmployeeProfile).toHaveBeenCalledWith('lan', expect.objectContaining({ idNumber: '001304012345', gender: null }))
    );
  });

  it('admin uploads a .docx template: blank draft first, read content shows at once, then fields arrive as chips', async () => {
    auth.user.permissions = ['hr.contract.manage'];
    api.getContracts.mockResolvedValue([]);
    api.getContractTemplates.mockResolvedValue([]);
    api.getContractFields.mockResolvedValue([{ key: 'ho_ten', label: 'Họ và tên', required: true }]);
    const draft = {
      id: 't9',
      code: 'mau-hop-dong',
      name: 'Mẫu hợp đồng mới',
      version: 1,
      contractType: 'FixedTermUnder12Months',
      body: '<p></p>',
      isActive: false,
      createdAt: '2026-10-29T03:00:00Z',
      isHtml: true,
    };
    api.createContractTemplate.mockResolvedValue(draft);
    api.uploadContractTemplateImport.mockResolvedValue({ objectKey: 'k1', fileName: 'hop-dong.docx' });
    // Máy chủ: đọc xong .docx thì gửi nội dung (đã lưu nháp), AI gắn trường xong mới gửi kết quả.
    let finish: () => void = () => {};
    api.streamContractTemplateImport.mockImplementation(async (_id: string, _body: unknown, onEvent: (e: any) => void) => {
      onEvent({ type: 'step', key: 'read', text: 'Đang đọc tệp…' });
      onEvent({ type: 'content', template: { ...draft, body: '<h2>HỢP ĐỒNG LAO ĐỘNG</h2><p>Họ và tên: ……</p>' } });
      onEvent({ type: 'step', key: 'ai', text: 'AI đang gắn trường…' });
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return {
        template: { ...draft, body: '<h2>HỢP ĐỒNG LAO ĐỘNG</h2><p>Họ và tên: {{ho_ten}}</p>' },
        fieldsPlacedByAi: true,
        warning: 'AI chưa chắc chỗ điền ngày cấp CCCD',
      };
    });
    const user = userEvent.setup();

    wrap(<HrContractsView />);
    await user.click(await screen.findByRole('tab', { name: 'Mẫu hợp đồng' }));
    expect(screen.queryByText('Tạo từ mẫu dựng sẵn')).toBeNull();
    const file = new File(['docx'], 'hop-dong.docx');
    const input = screen.getByText('Tải mẫu lên (.docx / .pdf)').closest('label')!.querySelector('input[type="file"]')!;
    await user.upload(input as HTMLInputElement, file);

    await waitFor(() => expect(api.uploadContractTemplateImport).toHaveBeenCalledWith('t9', file));
    expect(api.createContractTemplate).toHaveBeenCalledWith(null);
    expect(api.streamContractTemplateImport).toHaveBeenCalledWith(
      't9',
      { objectKey: 'k1', fileName: 'hop-dong.docx' },
      expect.any(Function),
      expect.anything()
    );
    // Nội dung đọc được vào trình soạn ngay, AI vẫn đang chạy.
    expect(await screen.findByText('HỢP ĐỒNG LAO ĐỘNG')).toBeInTheDocument();
    expect(screen.getByText('AI đang gắn trường…')).toBeInTheDocument();
    expect(screen.getByText('✓ Đang đọc tệp…')).toBeInTheDocument();

    finish();

    // Kết quả: trường thành thẻ tên tiếng Việt trong trình soạn.
    await waitFor(() => expect(document.querySelector('.ProseMirror .merge-field[data-field="ho_ten"]')).not.toBeNull());
    expect(document.querySelector('.ProseMirror .merge-field[data-field="ho_ten"]')!.textContent).toBe('Họ và tên');
    expect(enqueueSnackbar).toHaveBeenCalledWith('AI chưa chắc chỗ điền ngày cấp CCCD', { variant: 'warning' });
    expect(screen.queryByText('AI đang gắn trường…')).toBeNull();
  });

  it('staff sign their awaiting contract: draw, agree, send strokes', async () => {
    const awaiting: IEmploymentContract = {
      ...contract,
      id: 'c2',
      status: 'AwaitingSignature',
      signedOn: null,
      files: [],
      isHtml: true,
      renderedBody: '<p>Người lao động: Trần Lan</p><p>{{chu_ky_nguoi_lao_dong}}</p>',
      employeeSignedAt: null,
    };
    api.getMyContracts.mockResolvedValue([awaiting]);
    api.signContract.mockResolvedValue({
      ...awaiting,
      employeeSignedAt: '2026-10-29T08:00:00Z',
      employeeSignatureSvg: '<svg xmlns="http://www.w3.org/2000/svg"/>',
    });
    const user = userEvent.setup();

    wrap(<HrContractsView />);
    await user.click(await screen.findByRole('button', { name: 'Ký hợp đồng' }));
    const dialog = await screen.findByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Ký hợp đồng' });
    expect(submit).toBeDisabled();

    const pad = within(dialog).getByTestId('signature-pad');
    fireEvent.pointerDown(pad, { clientX: 10, clientY: 20, pointerId: 1 });
    fireEvent.pointerMove(pad, { clientX: 40, clientY: 30, pointerId: 1 });
    fireEvent.pointerMove(pad, { clientX: 80, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(pad, { pointerId: 1 });
    expect(submit).toBeDisabled(); // chưa tích cam kết
    await user.click(within(dialog).getByLabelText(CONTRACT_SIGN_CONSENT));
    await user.click(submit);

    await waitFor(() =>
      expect(api.signContract).toHaveBeenCalledWith('c2', {
        strokes: [[[10, 20], [40, 30], [80, 60]]],
        width: 600,
        height: 200,
      })
    );
    expect(await screen.findByText(/Bạn đã ký lúc/)).toBeInTheDocument();
    expect(screen.getByText('Nhân viên đã ký — chờ cửa hàng ký')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Ký hợp đồng' })).toBeNull());
  });
});

describe('contractBodyHtml', () => {
  it('formats a contract: centred heading, bold articles, signature block, escaped text', () => {
    const html = contractBodyHtml(
      'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập – Tự do – Hạnh phúc\n\nCăn cứ <luật>;\nĐiều 1. Công việc\n   a) Khu A\n[[NGAT_TRANG]]\n[[CHU_KY]]',
      'Trần Lan'
    );
    expect(html).toContain('<p class="center strong">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>');
    expect(html).toContain('<p class="center">Độc lập – Tự do – Hạnh phúc</p>');
    expect(html).toContain('<p>Căn cứ &lt;luật&gt;;</p>');
    expect(html).toContain('<p class="strong head">Điều 1. Công việc</p>');
    expect(html).toContain('padding-left');
    expect(html).toContain('class="page-break"');
    expect(html).toContain('NGƯỜI SỬ DỤNG LAO ĐỘNG');
    expect(html).toContain('<strong>Trần Lan</strong>');
  });
});
