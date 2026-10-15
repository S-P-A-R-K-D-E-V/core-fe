import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Đăng ký khuôn mặt bằng camera chấm công của chi nhánh: chọn camera quầy thì ảnh kiểm tra chất lượng là ảnh agent chụp
// (không mở webcam), lỗi từ camera quầy hiện thành gợi ý; máy không có webcam thì gợi ý chuyển sang camera chấm công.
// ----------------------------------------------------------------------

vi.mock('src/components/iconify', () => ({ default: ({ icon }: any) => <span data-icon={icon} /> }));
const enqueueSnackbar = vi.fn();
vi.mock('src/components/snackbar', () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock('src/components/settings', () => ({ useSettingsContext: () => ({ themeStretch: false }) }));
vi.mock('src/components/custom-breadcrumbs', () => ({ default: ({ heading }: any) => <h1>{heading}</h1> }));
vi.mock('src/auth/guard/role-based-guard', () => ({ default: ({ children }: any) => <>{children}</> }));
const user = { role: 'Staff', roles: ['Staff'], hasFaceEmbedding: false };
const refreshUser = vi.fn(() => Promise.resolve());
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => ({ user, refreshUser }) }));
const push = vi.fn();
vi.mock('src/routes/hooks', () => ({ useRouter: () => ({ push }) }));
vi.mock('../view/self-verify-dialog', () => ({ SelfVerifyDialog: () => null }));

const api = { checkEnrollQuality: vi.fn(), submitFaceEnrollment: vi.fn(), getEnrollCameras: vi.fn() };
vi.mock('src/api/faceEnrollment', () => ({
  checkEnrollQuality: (...a: any[]) => api.checkEnrollQuality(...a),
  submitFaceEnrollment: (...a: any[]) => api.submitFaceEnrollment(...a),
  getEnrollCameras: (...a: any[]) => api.getEnrollCameras(...a),
  faceEnrollDebugLog: [],
}));

const capture = vi.fn();
let snapshotTarget: any = 'unset';
vi.mock('src/hooks/use-enroll-snapshot', () => ({
  useEnrollSnapshot: (target: any) => {
    snapshotTarget = target;
    return { state: target ? 'ready' : 'idle', error: null, capture };
  },
}));

// Imported after the mocks above.
import FaceEnrollmentView from '../view/face-enrollment-view';

const camera = {
  deviceId: 'd1', deviceName: 'TAPO', branchId: 'b1', branchName: 'Chi nhánh 21 Chùa Láng',
  cameraKey: 'quay1', cameraName: 'Quầy thu ngân', online: true, sourceConnected: true,
};

function renderView() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <FaceEnrollmentView />
    </ThemeProvider>
  );
}

describe('FaceEnrollmentView with the branch attendance camera', () => {
  beforeEach(() => {
    Object.values(api).forEach((fn) => fn.mockReset());
    capture.mockReset();
    snapshotTarget = 'unset';
    api.getEnrollCameras.mockResolvedValue([camera]);
    // Máy không có webcam (như PC ở quầy không có camera).
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(() => Promise.reject(new Error('NotFound'))) },
    });
  });

  it('offers the attendance camera when the device has no webcam and checks quality on agent snapshots', async () => {
    capture.mockResolvedValue({ data: 'U05BUA==' });
    api.checkEnrollQuality.mockResolvedValue({ qualityScore: 0.2, yaw: 0, pitch: 0, blinkDetected: false });
    renderView();

    const useCam = await screen.findByText('Dùng camera chấm công');
    fireEvent.click(useCam);

    await waitFor(() => expect(snapshotTarget).toEqual({ deviceId: 'd1', cameraKey: 'quay1' }));
    await waitFor(() => expect(api.checkEnrollQuality).toHaveBeenCalledWith('U05BUA=='), { timeout: 3000 });
    expect(document.querySelector('img[src="data:image/jpeg;base64,U05BUA=="]')).toBeTruthy();
    expect(await screen.findByText(/Ảnh chưa đủ rõ/)).toBeTruthy();
  });

  it('shows why the counter camera could not take a picture', async () => {
    capture.mockResolvedValue({ error: 'Chưa thấy khuôn mặt trước camera quầy — đứng gần hơn, nhìn vào camera' });
    renderView();

    const select = await screen.findByLabelText('Nguồn ảnh');
    fireEvent.mouseDown(select);
    fireEvent.click(within(await screen.findByRole('listbox')).getByText(/Camera chấm công: Quầy thu ngân/));

    expect(await screen.findByText(/Chưa thấy khuôn mặt trước camera quầy/, {}, { timeout: 3000 })).toBeTruthy();
    expect(api.checkEnrollQuality).not.toHaveBeenCalled();
  });
});
