import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import type { IBranchBoard, IStorePresenceChanged } from 'src/types/attendance-live';

// ----------------------------------------------------------------------
// Chấm công trực tiếp: KPI + hai bảng (có ca / có trong hình mà không có ca), cảnh báo lượt mở từ ngày trước, ô
// camera theo trạng thái agent, và sự kiện "camera nhận ra" làm tải lại bảng.
// ----------------------------------------------------------------------

vi.mock('src/components/iconify', () => ({ default: ({ icon }: any) => <span data-icon={icon} /> }));
vi.mock('src/routes/components', async () => {
  const { forwardRef } = await import('react');
  return { RouterLink: forwardRef<HTMLAnchorElement, any>((props, ref) => <a ref={ref} {...props} />) };
});
// Hàm ổn định như notistack thật — hàm mới mỗi render làm callback đổi identity và lặp vô hạn.
const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/store/working-branch-store', () => ({
  useWorkingBranch: (selector: any) => selector({ branch: null }),
}));

const api = { getBranchBoard: vi.fn(), getBranchBoardBranches: vi.fn() };
vi.mock('src/api/attendance-live', () => ({
  getBranchBoard: (...a: any[]) => api.getBranchBoard(...a),
  getBranchBoardBranches: (...a: any[]) => api.getBranchBoardBranches(...a),
}));

let hubState: any = { connectionState: 'connected', frames: {}, sources: {}, error: null };
let lastHubOptions: any = null;
vi.mock('src/hooks/use-store-live-hub', () => ({
  frameKey: (deviceId: string, cameraKey: string) => `${deviceId}|${cameraKey}`,
  useStoreLiveHub: (options: any) => {
    lastHubOptions = options;
    return hubState;
  },
}));

// Imported after the mocks above.
import { AttendanceLiveView } from '../view/attendance-live-view';

const board: IBranchBoard = {
  date: '2026-10-15',
  branchId: 'b1',
  branchName: 'CiCi Cầu Giấy',
  generatedAt: '2026-10-15T03:00:00Z',
  counts: { assigned: 2, working: 1, done: 0, notIn: 1, absent: 0, upcoming: 0, late: 1, unassignedSeen: 1, staleOpen: 1 },
  assigned: [
    {
      assignmentId: 'a1', staffId: 's1', staffName: 'Trần Thị Lan', avatarUrl: null, shiftName: 'Ca sáng',
      startTime: '08:00', endTime: '16:00', status: 'working', lateMinutes: 7,
      checkInTime: '2026-10-15T01:07:00Z', checkOutTime: null, branchAssigned: true,
      firstSeenAt: '2026-10-15T01:05:00Z', lastSeenAt: '2026-10-15T02:55:00Z', bestSimilarity: 0.68,
    },
    {
      assignmentId: 'a2', staffId: 's2', staffName: 'Lê Văn Minh', avatarUrl: null, shiftName: 'Ca chiều',
      startTime: '09:00', endTime: '17:00', status: 'not_in', lateMinutes: 0,
      checkInTime: null, checkOutTime: null, branchAssigned: false,
      firstSeenAt: null, lastSeenAt: null, bestSimilarity: null,
    },
  ],
  unassigned: [
    {
      staffId: 's3', staffName: 'Phạm Thị Hoa', avatarUrl: null, firstSeenAt: '2026-10-15T02:00:00Z',
      lastSeenAt: '2026-10-15T02:30:00Z', seenCount: 3, lastAction: 'noaction',
      checkInTime: null, checkOutTime: null, hasShiftElsewhere: true, bestSimilarity: 0.61,
    },
  ],
  staleOpen: [
    {
      logId: 'l1', staffId: 's4', staffName: 'Xuân Vũ', avatarUrl: null, checkInTime: '2026-08-24T10:00:00Z',
      hoursOpen: 1249.5, shiftName: null, checkInMethod: 'Kiosk', deviceName: 'Kiosk quầy',
    },
  ],
  devices: [
    {
      id: 'd1', name: 'Camera quầy', online: true, liveConnected: true,
      cameras: [{ key: 'quay1', name: 'Quầy thu ngân', role: 'counter_face', online: true, fps: 5,
        lastFrameAt: null, inToday: 0, outToday: 0, liveView: true }],
    },
  ],
};

function renderView() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <AttendanceLiveView />
    </ThemeProvider>
  );
}

describe('AttendanceLiveView', () => {
  beforeEach(() => {
    api.getBranchBoard.mockReset();
    api.getBranchBoardBranches.mockReset();
    enqueueSnackbar.mockReset();
    hubState = { connectionState: 'connected', frames: {}, sources: { d1: true }, error: null };
    api.getBranchBoardBranches.mockResolvedValue([{ branchId: 'b1', branchName: 'CiCi Cầu Giấy', deviceCount: 1, liveDeviceCount: 1 }]);
    api.getBranchBoard.mockResolvedValue(board);
  });

  it('shows assigned staff, staff seen without a shift, and stale open attendance', async () => {
    renderView();

    await waitFor(() => expect(screen.getByText('Trần Thị Lan')).toBeTruthy());
    expect(api.getBranchBoard).toHaveBeenCalledWith('b1');
    expect(screen.getByText('Muộn 7′')).toBeTruthy();
    expect(screen.getByText('Ca chưa gắn chi nhánh')).toBeTruthy();
    expect(screen.getByText(/khớp 68%/)).toBeTruthy();

    expect(screen.getByText('Phạm Thị Hoa')).toBeTruthy();
    expect(screen.getByText('Có ca ở chi nhánh khác')).toBeTruthy();

    expect(screen.getByText(/Lượt chấm công đang mở từ ngày trước/)).toBeTruthy();
    expect(screen.getByText('Xuân Vũ')).toBeTruthy();
    expect(screen.getByText(/~52 ngày/)).toBeTruthy();
    expect(screen.getByText('Ngoài ca')).toBeTruthy();
    const staleTile = screen.getByText('Lượt mở từ ngày trước').parentElement!;
    expect(within(staleTile).getByText('1')).toBeTruthy();

    // Ô camera quầy: agent đã nối nhưng chưa có hình.
    expect(lastHubOptions.deviceIds).toEqual(['d1']);
    expect(screen.getByText('Đang chờ hình…')).toBeTruthy();
  });

  it('shows the latest live frame and refetches the board when the camera recognises someone', async () => {
    hubState = {
      connectionState: 'connected',
      frames: { 'd1|quay1': { data: 'QUJD', at: '2026-10-15T03:00:00Z', receivedAt: Date.now() } },
      sources: { d1: true },
      error: null,
    };
    renderView();
    await waitFor(() => expect(screen.getByText('Trần Thị Lan')).toBeTruthy());

    const img = document.querySelector('img[src^="data:image/jpeg;base64,QUJD"]');
    expect(img).toBeTruthy();
    expect(screen.getByText('LIVE')).toBeTruthy();

    const calls = api.getBranchBoard.mock.calls.length;
    const event: IStorePresenceChanged = {
      deviceId: 'd1', branchId: 'b1', staffId: 's3', staffName: 'Phạm Thị Hoa', action: 'noaction',
      similarity: 0.61, at: '2026-10-15T03:00:05Z',
    };
    act(() => lastHubOptions.onPresence(event));
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining('Phạm Thị Hoa'), expect.anything());
    await waitFor(() => expect(api.getBranchBoard.mock.calls.length).toBeGreaterThan(calls), { timeout: 3000 });
  });

  it('explains how to add a camera when no branch has one', async () => {
    api.getBranchBoardBranches.mockResolvedValue([]);
    renderView();

    await waitFor(() => expect(screen.getByText(/Chưa có chi nhánh nào có camera chấm công/)).toBeTruthy());
    expect(screen.getByText('Thiết bị cửa hàng').getAttribute('href')).toContain('/attendance/kiosk-devices');
    expect(api.getBranchBoard).not.toHaveBeenCalled();
  });
});
