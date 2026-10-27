import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IEmployeeProfile, IEmploymentContract } from 'src/types/hr';

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
}));
vi.mock('src/api/hr', () => ({
  ...Object.fromEntries(Object.keys(api).map((k) => [k, (...a: any[]) => (api as any)[k](...a)])),
  voidContract: vi.fn(),
  createContract: vi.fn(),
  finalizeContract: vi.fn(),
  terminateContract: vi.fn(),
  markContractSigned: vi.fn(),
  updateContractDraft: vi.fn(),
  uploadContractFiles: vi.fn(),
  createContractTemplate: vi.fn(),
  deleteContractTemplate: vi.fn(),
  updateContractTemplate: vi.fn(),
  publishContractTemplate: vi.fn(),
}));

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
