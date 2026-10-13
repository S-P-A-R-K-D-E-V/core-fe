import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Đăng nhập bằng mã QR (hợp đồng với core-be, POST /auth/qr/*):
//  - xin mã bằng SHA-256 của verifier; verifier KHÔNG rời trình duyệt cho tới lúc đổi mã, và không nằm trong QR;
//  - QR là JSON { type: 'corecms-web-login', code } để app nhận ra;
//  - hỏi trạng thái theo nhịp BE trả: scanned → báo chờ duyệt, approved → đổi mã + verifier rồi vào trang,
//    rejected → báo bị từ chối, expired → tự xin mã mới (có giới hạn số lần).
// ----------------------------------------------------------------------

const http = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('src/utils/axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('src/utils/axios')>();
  return { ...actual, default: http };
});

const qr = vi.hoisted(() => ({ toDataURL: vi.fn() }));
vi.mock('qrcode', () => ({ default: qr }));

const auth = vi.hoisted(() => ({ loginWithQr: vi.fn() }));
vi.mock('src/auth/hooks', () => ({ useAuthContext: () => auth }));

let verifierSeq = 0;
vi.mock('src/auth/utils/saas-host', () => ({
  randomToken: () => {
    verifierSeq += 1;
    return `verifier-${verifierSeq}`;
  },
  sha256Hex: async (value: string) => `sha256(${value})`,
}));

// Imported after the mocks above so the view picks up the mocked modules.
import JwtQrLogin from 'src/sections/auth/jwt/jwt-qr-login';

const onSuccess = vi.fn();
const onBack = vi.fn();

/** Trả lời của BE theo từng endpoint; status lấy lần lượt từ hàng đợi, hết thì giữ giá trị cuối. */
function backend(statuses: string[]) {
  let codeSeq = 0;
  const queue = [...statuses];
  http.post.mockImplementation(async (url: string) => {
    if (url === '/auth/qr/start') {
      codeSeq += 1;
      return { data: { code: `code-${codeSeq}`, expiresInSeconds: 120, pollIntervalSeconds: 2 } };
    }
    if (url === '/auth/qr/status') {
      const status = queue.length > 1 ? queue.shift() : queue[0];
      return { data: { status } };
    }
    throw new Error(`unexpected ${url}`);
  });
}

function calls(url: string) {
  return http.post.mock.calls.filter(([u]) => u === url);
}

async function renderView() {
  render(
    <ThemeProvider theme={createTheme()}>
      <JwtQrLogin onSuccess={onSuccess} onBack={onBack} />
    </ThemeProvider>
  );
  // Xin mã + dựng QR là các promise nối tiếp — cho chúng chạy hết.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

/** Chạy qua đúng một nhịp hỏi trạng thái (2 giây). */
async function poll(times = 1) {
  for (let i = 0; i < times; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  verifierSeq = 0;
  qr.toDataURL.mockImplementation(async (payload: string) => `data:qr,${payload}`);
  auth.loginWithQr.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('JwtQrLogin', () => {
  it('xin mã bằng challenge, QR chỉ chứa mã — không lộ verifier', async () => {
    backend(['pending']);

    await renderView();

    expect(calls('/auth/qr/start')).toEqual([['/auth/qr/start', { codeChallenge: 'sha256(verifier-1)' }]]);
    const payload = qr.toDataURL.mock.calls[0][0] as string;
    expect(JSON.parse(payload)).toEqual({ type: 'corecms-web-login', code: 'code-1' });
    expect(payload).not.toContain('verifier');
    expect(screen.getByAltText('Mã QR đăng nhập')).toHaveAttribute('src', `data:qr,${payload}`);
  });

  it('đã quét → báo chờ bấm Đồng ý; được duyệt → đổi mã + verifier rồi vào trang', async () => {
    backend(['pending', 'scanned', 'approved']);

    await renderView();
    await poll();
    expect(screen.queryByText(/Đã quét/)).not.toBeInTheDocument();
    expect(auth.loginWithQr).not.toHaveBeenCalled();

    await poll();
    expect(screen.getByText('Đã quét — bấm Đồng ý trên điện thoại')).toBeInTheDocument();
    expect(auth.loginWithQr).not.toHaveBeenCalled();

    await poll();
    expect(auth.loginWithQr).toHaveBeenCalledTimes(1);
    expect(auth.loginWithQr).toHaveBeenCalledWith('code-1', 'verifier-1');
    expect(onSuccess).toHaveBeenCalledTimes(1);

    // Đã vào trang thì thôi hỏi trạng thái.
    const asked = calls('/auth/qr/status').length;
    await poll(3);
    expect(calls('/auth/qr/status')).toHaveLength(asked);
  });

  it('bị từ chối trên điện thoại → báo rõ, bấm tạo mã mới thì xin mã khác', async () => {
    backend(['rejected']);

    await renderView();
    await poll();

    expect(screen.getByText('Yêu cầu đăng nhập đã bị từ chối trên điện thoại.')).toBeInTheDocument();
    expect(screen.queryByAltText('Mã QR đăng nhập')).not.toBeInTheDocument();
    expect(auth.loginWithQr).not.toHaveBeenCalled();

    backend(['pending']);
    await act(async () => {
      fireEvent.click(screen.getByText('Tạo mã mới'));
      await vi.advanceTimersByTimeAsync(0);
    });

    // Mã mới đi kèm verifier mới — không dùng lại verifier của mã đã bị từ chối.
    expect(calls('/auth/qr/start')).toEqual([
      ['/auth/qr/start', { codeChallenge: 'sha256(verifier-1)' }],
      ['/auth/qr/start', { codeChallenge: 'sha256(verifier-2)' }],
    ]);
    expect(screen.getByAltText('Mã QR đăng nhập')).toBeInTheDocument();
  });

  it('mã hết hạn → tự xin mã mới, quá số lần thì dừng và chờ người dùng', async () => {
    backend(['expired']);

    await renderView();
    // 1 mã đầu + 4 lần tự gia hạn; lần hết hạn thứ 5 thì dừng.
    await poll(5);

    expect(calls('/auth/qr/start')).toHaveLength(5);
    expect(screen.getByText('Mã đã hết hạn.')).toBeInTheDocument();

    const asked = calls('/auth/qr/status').length;
    await poll(5);
    expect(calls('/auth/qr/start')).toHaveLength(5);
    expect(calls('/auth/qr/status')).toHaveLength(asked);
  });

  it('đổi mã thất bại → hiện lỗi của BE, không vào trang', async () => {
    backend(['approved']);
    auth.loginWithQr.mockRejectedValue({ status: 400, title: 'Tài khoản này không thuộc cửa hàng bạn đang truy cập.' });

    await renderView();
    await poll();

    expect(screen.getByText('Tài khoản này không thuộc cửa hàng bạn đang truy cập.')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('không xin được mã → báo lỗi và cho thử lại; lỗi mạng lúc hỏi trạng thái thì hỏi tiếp', async () => {
    http.post.mockRejectedValueOnce('Something went wrong');

    await renderView();
    expect(screen.getByText('Không tạo được mã đăng nhập. Kiểm tra kết nối mạng rồi thử lại.')).toBeInTheDocument();

    backend(['pending']);
    await act(async () => {
      fireEvent.click(screen.getByText('Thử lại'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByAltText('Mã QR đăng nhập')).toBeInTheDocument();

    // Một lần hỏi trạng thái lỗi mạng: QR vẫn còn, lần sau hỏi tiếp.
    http.post.mockRejectedValueOnce('Something went wrong');
    await poll(2);
    expect(screen.getByAltText('Mã QR đăng nhập')).toBeInTheDocument();
    expect(calls('/auth/qr/status').length).toBeGreaterThanOrEqual(2);
  });

  it('rời khỏi màn QR → thôi hỏi trạng thái; nút quay lại gọi onBack', async () => {
    backend(['pending']);

    const view = render(
      <ThemeProvider theme={createTheme()}>
        <JwtQrLogin onSuccess={onSuccess} onBack={onBack} />
      </ThemeProvider>
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByText('Đăng nhập bằng mật khẩu'));
    expect(onBack).toHaveBeenCalledTimes(1);

    view.unmount();
    const asked = calls('/auth/qr/status').length;
    await poll(3);
    expect(calls('/auth/qr/status')).toHaveLength(asked);
  });
});
