import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// core-be chỉ mở /admin/workers cho Admin của cửa hàng CiCi (cửa hàng khác 404):
// cửa hàng khác mở System Jobs chỉ thấy job của cửa hàng mình, không gọi /admin/workers, không toast lỗi;
// Admin CiCi tải danh sách worker như cũ và thấy job của mọi cửa hàng.
// ----------------------------------------------------------------------

vi.mock('src/auth/hooks', () => ({
  useAuthContext: () => ({ user: { role: 'Admin', roles: ['Admin'] } }),
}));

const brand = vi.hoisted(() => ({ isCiCi: true }));
vi.mock('src/components/branding', () => ({
  useStoreBrand: () => ({ isCiCi: brand.isCiCi, tenantCode: brand.isCiCi ? 'cici68' : 'huang' }),
}));

vi.mock('src/components/settings', () => ({
  useSettingsContext: () => ({ themeStretch: false }),
}));

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar }),
}));

vi.mock('src/components/custom-breadcrumbs', () => ({
  default: ({ heading }: any) => <div>{heading}</div>,
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

vi.mock('src/components/scrollbar', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('src/components/label', () => ({
  default: ({ children }: any) => <span>{children}</span>,
}));

const getWorkers = vi.fn();
const runWorkerNow = vi.fn();
const setWorkerEnabled = vi.fn();
const getSyncJobMonitor = vi.fn();
vi.mock('src/api/system-jobs', () => ({
  getWorkers: (...args: any[]) => getWorkers(...args),
  runWorkerNow: (...args: any[]) => runWorkerNow(...args),
  setWorkerEnabled: (...args: any[]) => setWorkerEnabled(...args),
  getSyncJobMonitor: (...args: any[]) => getSyncJobMonitor(...args),
  cancelSyncJob: vi.fn(),
  forceCancelSyncJob: vi.fn(),
  retrySyncJob: vi.fn(),
}));

// Imported after the mocks above so the view picks up the mocked modules.
import SystemJobsView from 'src/sections/system-jobs/view/system-jobs-view';

function renderView() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <SystemJobsView />
    </ThemeProvider>
  );
}

beforeEach(() => {
  getSyncJobMonitor.mockResolvedValue({ jobs: [], failedStores: [] });
});

afterEach(() => {
  vi.clearAllMocks();
  brand.isCiCi = true;
});

describe('SystemJobsView', () => {
  it('cửa hàng khác CiCi: chỉ job của cửa hàng mình, không gọi /admin/workers, không toast', async () => {
    brand.isCiCi = false;

    renderView();

    expect(screen.getByText('Worker hệ thống không áp dụng cho cửa hàng này')).toBeInTheDocument();
    expect(screen.queryByText('Worker')).not.toBeInTheDocument();
    await waitFor(() => expect(getSyncJobMonitor).toHaveBeenCalledWith('ownStore'));
    expect(getWorkers).not.toHaveBeenCalled();
    expect(enqueueSnackbar).not.toHaveBeenCalled();
  });

  it('CiCi: Admin vẫn tải và thấy danh sách worker', async () => {
    getWorkers.mockResolvedValue([
      {
        name: 'kiotviet-sync',
        displayName: 'Đồng bộ KiotViet',
        description: 'Kéo hoá đơn',
        process: 'core-worker',
        scheduleDescription: 'Mỗi 5 phút',
        health: 'Healthy',
        enabled: true,
        supportsEnableToggle: false,
        supportsManualTrigger: false,
        stopBehavior: 'Huỷ hoặc buộc dừng từng job ở bảng Tiến trình bên dưới',
        lastTickAtUtc: null,
        lastSuccessAtUtc: null,
        lastTickWasManual: false,
        lastError: null,
        lastSummary: 'OK',
      },
    ]);

    renderView();

    expect(await screen.findByText('Đồng bộ KiotViet')).toBeInTheDocument();
    expect(getWorkers).toHaveBeenCalledTimes(1);
    expect(getSyncJobMonitor).toHaveBeenCalledWith('allStores');
    expect(screen.getByText('Huỷ hoặc buộc dừng từng job ở bảng Tiến trình bên dưới')).toBeInTheDocument();
    expect(screen.queryByText('Worker hệ thống không áp dụng cho cửa hàng này')).not.toBeInTheDocument();
    await waitFor(() => expect(enqueueSnackbar).not.toHaveBeenCalled());
  });
});
