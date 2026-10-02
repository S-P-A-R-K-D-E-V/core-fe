import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { ThemeProvider, createTheme } from '@mui/material/styles';

// ----------------------------------------------------------------------
// Trang liên kết Google/Apple (/sso/start/?link=1): mỗi tài khoản chỉ một Google + một Apple. BE trả 409
// errorCodes ['Auth.ProviderAlreadyLinked'] →
//  - web: báo gỡ liên kết cũ trước, KHÔNG kèm câu "bấm Liên kết lần nữa" (bấm lại vẫn bị chặn);
//  - app: về redirect_uri với status=error&result=error&provider=<p>&reason=provider_already_linked,
//    nút "Quay lại ứng dụng" mang cùng lý do.
// ----------------------------------------------------------------------

const http = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('src/utils/axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('src/utils/axios')>();
  return { ...actual, default: http };
});

let query = '';
vi.mock('src/routes/hooks', () => ({
  useSearchParams: () => new URLSearchParams(query),
}));

vi.mock('src/auth/utils/saas-host', async (importOriginal) => ({
  ...(await importOriginal<typeof import('src/auth/utils/saas-host')>()),
  AUTH_HOST: 'auth.example.test',
  APPLE_SERVICES_ID: 'apple-services-id',
  isAuthHost: () => true,
}));

vi.mock('@react-oauth/google', () => ({
  GoogleLogin: ({ onSuccess }: any) => (
    <button type="button" onClick={() => onSuccess({ credential: 'google-id-token' })}>
      Google
    </button>
  ),
}));

vi.mock('src/sections/auth/sso/apple-web', () => ({
  signInWithAppleWeb: vi.fn(),
}));

vi.mock('src/components/iconify', () => ({
  default: () => null,
}));

// Imported after the mocks above so the view picks up the mocked modules.
import SsoLinkView from 'src/sections/auth/sso/sso-link-view';

const ALREADY_LINKED = {
  status: 409,
  title: 'Tài khoản đã liên kết một tài khoản Google khác.',
  errorCodes: ['Auth.ProviderAlreadyLinked'],
};

const APP_QUERY =
  'link=1&provider=google&app=1&redirect_uri=sparkstore%3A%2F%2Flinked%3Fprovider%3Dapple';

const realLocation = window.location;
const assign = vi.fn();

function renderView() {
  return render(
    <ThemeProvider theme={createTheme()}>
      <SsoLinkView />
    </ThemeProvider>
  );
}

async function clickGoogle() {
  fireEvent.click(await screen.findByText('Google'));
  await waitFor(() => expect(http.post).toHaveBeenCalledTimes(1));
}

beforeEach(() => {
  // Vé liên kết đi qua fragment (#t=…); window.location.assign của jsdom không điều hướng được → thay.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      hash: '#t=ticket-1',
      pathname: '/sso/start/',
      search: '',
      host: 'auth.example.test',
      origin: 'https://auth.example.test',
      assign,
    },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  vi.clearAllMocks();
});

describe('SsoLinkView — đã liên kết loại này (409 Auth.ProviderAlreadyLinked)', () => {
  it('web: báo gỡ liên kết cũ, không kèm câu "thử lại", không chuyển trang', async () => {
    query = 'link=1&provider=google';
    http.post.mockRejectedValue(ALREADY_LINKED);

    renderView();
    await clickGoogle();

    expect(
      await screen.findByText(
        'Tài khoản của bạn đã liên kết một tài khoản Google khác. Gỡ liên kết đó ở trang tài khoản (hoặc trong ứng dụng) rồi liên kết lại.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/bấm Liên kết lần nữa/)).not.toBeInTheDocument();
    expect(http.post).toHaveBeenCalledWith('https://auth.example.test/api/app-hub/link', {
      linkToken: 'ticket-1',
      provider: 'google',
      token: 'google-id-token',
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it('web tiếng Anh: thông điệp tiếng Anh', async () => {
    query = 'link=1&provider=google&lang=en';
    http.post.mockRejectedValue(ALREADY_LINKED);

    renderView();
    await clickGoogle();

    expect(
      await screen.findByText(
        'Your account already has a different Google account linked. Remove it on your account page (or in the app), then link again.'
      )
    ).toBeInTheDocument();
  });

  it('app: về app với reason=provider_already_linked; nút "Quay lại ứng dụng" mang cùng lý do', async () => {
    query = APP_QUERY;
    http.post.mockRejectedValue(ALREADY_LINKED);

    renderView();
    await clickGoogle();

    // provider=apple có sẵn trong redirect_uri bị ghi đè bằng đúng loại vừa thử
    const expected =
      'sparkstore://linked?provider=google&status=error&result=error&reason=provider_already_linked';
    await waitFor(() => expect(assign).toHaveBeenCalledWith(expected));

    fireEvent.click(await screen.findByText('Quay lại ứng dụng'));
    expect(assign).toHaveBeenLastCalledWith(expected);
  });

  it('lỗi khác: giữ thông điệp BE + hướng dẫn bấm liên kết lại; app không nhận reason', async () => {
    query = APP_QUERY;
    http.post.mockRejectedValue({ status: 400, title: 'Vé liên kết đã hết hạn.' });

    renderView();
    await clickGoogle();

    expect(
      await screen.findByText(/Vé liên kết đã hết hạn\. Mỗi liên kết chỉ dùng một lần/)
    ).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Quay lại ứng dụng'));
    expect(assign).toHaveBeenCalledWith('sparkstore://linked?status=error&result=error');
  });

  it('app: liên kết xong → về app với status=linked + provider', async () => {
    query = APP_QUERY;
    http.post.mockResolvedValue({
      data: { provider: 'google', email: 'a@gmail.com', returnHost: 'cici.example.test' },
    });

    renderView();
    await clickGoogle();

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        'sparkstore://linked?provider=google&status=linked&result=linked'
      )
    );
  });
});
