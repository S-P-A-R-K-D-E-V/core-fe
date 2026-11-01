import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { ISyncJobMonitorItem } from 'src/types/sync-job';

// ----------------------------------------------------------------------
// Bảng tiến trình KiotViet: hiện đúng nút core-be cho phép, mọi thao tác qua hộp thoại xác nhận (không window.confirm),
// bấm "Không" thì không gọi API, gọi đúng phạm vi cửa hàng.
// ----------------------------------------------------------------------

const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({
  useSnackbar: () => ({ enqueueSnackbar }),
}));

vi.mock('src/components/iconify', () => ({ default: () => null }));
vi.mock('src/components/scrollbar', () => ({ default: ({ children }: any) => <div>{children}</div> }));
vi.mock('src/components/label', () => ({ default: ({ children }: any) => <span>{children}</span> }));

const getSyncJobMonitor = vi.fn();
const cancelSyncJob = vi.fn();
const forceCancelSyncJob = vi.fn();
const retrySyncJob = vi.fn();
vi.mock('src/api/system-jobs', () => ({
  getSyncJobMonitor: (...args: any[]) => getSyncJobMonitor(...args),
  cancelSyncJob: (...args: any[]) => cancelSyncJob(...args),
  forceCancelSyncJob: (...args: any[]) => forceCancelSyncJob(...args),
  retrySyncJob: (...args: any[]) => retrySyncJob(...args),
}));

// Imported after the mocks above so the component picks up the mocked modules.
import SyncJobMonitorCard from 'src/sections/system-jobs/sync-job-monitor-card';

const now = new Date().toISOString();

function job(overrides: Partial<ISyncJobMonitorItem> = {}, control: Partial<ISyncJobMonitorItem['control']> = {}): ISyncJobMonitorItem {
  return {
    jobId: 'job-1',
    tenantId: 'tenant-b',
    tenantCode: 'storeb',
    type: 'SyncProductsOnly',
    status: 'Running',
    createdAt: now,
    startedAt: now,
    completedAt: null,
    lastProgressAt: now,
    error: null,
    stepsTotal: 3,
    stepsDone: 1,
    stepsFailed: 0,
    currentStep: 'Đang tải sản phẩm',
    runnerAlive: true,
    cancelRequested: false,
    forceRequested: false,
    forceStoppedAt: null,
    forceStopMode: null,
    detachedTaskAlive: false,
    retryOfJobId: null,
    controlEvents: [],
    control: {
      canCancel: true,
      cancelMode: 'NextCheckpoint',
      cancelNote: 'Job dừng ở điểm an toàn kế tiếp',
      canForce: true,
      forceMode: 'GraceThenDetach',
      forceNote: 'Chờ tối đa 60 giây rồi worker bỏ đợi',
      canRetry: false,
      retryNote: 'Job chưa kết thúc',
      suspected: false,
      suspectNote: null,
      ...control,
    },
    ...overrides,
  };
}

function renderCard(scope: 'allStores' | 'ownStore' = 'allStores') {
  return render(
    <ThemeProvider theme={createTheme()}>
      <SyncJobMonitorCard scope={scope} />
    </ThemeProvider>
  );
}

beforeEach(() => {
  cancelSyncJob.mockResolvedValue({ message: 'Đã gửi yêu cầu huỷ' });
  forceCancelSyncJob.mockResolvedValue({ message: 'Đã gửi lệnh buộc dừng' });
  retrySyncJob.mockResolvedValue({ message: 'Đã tạo job chạy lại' });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('SyncJobMonitorCard', () => {
  it('job đang chạy: có Huỷ và Buộc dừng, không có Chạy lại, thấy cửa hàng khi xem mọi cửa hàng', async () => {
    getSyncJobMonitor.mockResolvedValue({ jobs: [job()], failedStores: [] });

    renderCard();

    expect(await screen.findByText('Đồng bộ sản phẩm + tồn kho')).toBeInTheDocument();
    expect(getSyncJobMonitor).toHaveBeenCalledWith('allStores');
    expect(screen.getByText('storeb')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Huỷ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buộc dừng' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chạy lại' })).not.toBeInTheDocument();
  });

  it('xem theo cửa hàng: không có cột cửa hàng, gọi phạm vi ownStore', async () => {
    getSyncJobMonitor.mockResolvedValue({ jobs: [job()], failedStores: [] });

    renderCard('ownStore');

    await screen.findByText('Đồng bộ sản phẩm + tồn kho');
    expect(getSyncJobMonitor).toHaveBeenCalledWith('ownStore');
    expect(screen.queryByText('storeb')).not.toBeInTheDocument();
  });

  it('buộc dừng: hộp thoại nói rõ tác dụng, xác nhận mới gọi API đúng job', async () => {
    const running = job();
    getSyncJobMonitor.mockResolvedValue({ jobs: [running], failedStores: [] });
    const windowConfirm = vi.spyOn(window, 'confirm');
    const user = userEvent.setup();

    renderCard();

    await user.click(await screen.findByRole('button', { name: 'Buộc dừng' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Chờ tối đa 60 giây rồi worker bỏ đợi/)).toBeInTheDocument();
    expect(within(dialog).getByText(/cửa hàng storeb/)).toBeInTheDocument();
    expect(forceCancelSyncJob).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Buộc dừng' }));

    await waitFor(() => expect(forceCancelSyncJob).toHaveBeenCalledWith('allStores', running));
    expect(windowConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith('Đã gửi lệnh buộc dừng', { variant: 'info' }));
    windowConfirm.mockRestore();
  });

  it('bấm Không trong hộp thoại: không gọi API', async () => {
    getSyncJobMonitor.mockResolvedValue({ jobs: [job()], failedStores: [] });
    const user = userEvent.setup();

    renderCard();

    await user.click(await screen.findByRole('button', { name: 'Huỷ' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Không' }));

    expect(cancelSyncJob).not.toHaveBeenCalled();
  });

  it('job đã lỗi: Chạy lại qua xác nhận', async () => {
    const failed = job(
      { status: 'Failed', completedAt: now, error: 'Lỗi KiotViet' },
      { canCancel: false, canForce: false, canRetry: true, retryNote: 'Tạo job mới cùng tham số' }
    );
    getSyncJobMonitor.mockResolvedValue({ jobs: [failed], failedStores: [] });
    const user = userEvent.setup();

    renderCard('ownStore');

    await user.click(await screen.findByRole('button', { name: 'Chạy lại' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Chạy lại' }));

    await waitFor(() => expect(retrySyncJob).toHaveBeenCalledWith('ownStore', failed));
  });

  it('job đẩy KiotViet: không có nút nào, nói rõ vì sao', async () => {
    const note = 'Job đẩy chứng từ sang KiotViet không huỷ được';
    getSyncJobMonitor.mockResolvedValue({
      jobs: [
        job(
          { type: 'PushSalesOrder' },
          { canCancel: false, cancelMode: 'None', cancelNote: note, canForce: false, forceMode: 'None', forceNote: note }
        ),
      ],
      failedStores: [],
    });

    renderCard();

    expect(await screen.findByText(note)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Huỷ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buộc dừng' })).not.toBeInTheDocument();
  });

  it('nghi treo + đã buộc dừng + ai đã làm: hiện đủ trên dòng', async () => {
    getSyncJobMonitor.mockResolvedValue({
      jobs: [
        job(
          {
            status: 'Cancelled',
            completedAt: now,
            forceStoppedAt: now,
            forceStopMode: 'Detached',
            detachedTaskAlive: true,
            controlEvents: [{ action: 'ForceCancel', actorId: 'u1', actorName: 'Nguyễn Văn A', at: now, note: null }],
          },
          { canCancel: false, canForce: false, canRetry: true }
        ),
        job({ jobId: 'job-2' }, { suspected: true, suspectNote: 'Không có tiến độ mới hơn 15 phút' }),
      ],
      failedStores: [],
    });

    renderCard();

    expect(await screen.findByText('Đã buộc dừng')).toBeInTheDocument();
    expect(screen.getByText(/Buộc dừng · Nguyễn Văn A/)).toBeInTheDocument();
    expect(screen.getByText(/Tác vụ cũ của job chưa thoát hẳn/)).toBeInTheDocument();
    expect(screen.getByText('Nghi treo')).toBeInTheDocument();
    expect(screen.getByText('Không có tiến độ mới hơn 15 phút')).toBeInTheDocument();
  });

  it('API từ chối: hiện đúng lý do của core-be', async () => {
    getSyncJobMonitor.mockResolvedValue({ jobs: [job()], failedStores: [] });
    cancelSyncJob.mockRejectedValue({ response: { data: { message: 'Job đã kết thúc' } } });
    const user = userEvent.setup();

    renderCard();

    await user.click(await screen.findByRole('button', { name: 'Huỷ' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Huỷ tiến trình' }));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith('Job đã kết thúc', { variant: 'error' }));
  });
});
