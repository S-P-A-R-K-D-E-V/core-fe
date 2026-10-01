import { sha256Hex, randomToken, APPLE_SERVICES_ID } from 'src/auth/utils/saas-host';

// ----------------------------------------------------------------------
// Sign in with Apple (JS, popup) trên trang auth — dùng cho đăng nhập (/sso/start) và liên kết tài
// khoản (/sso/start?link=1). Gửi Apple SHA-256 của nonce, gửi backend nonce gốc.
// ----------------------------------------------------------------------

type AppleSignInResponse = {
  authorization: { id_token: string; code: string };
  user?: { name?: { firstName?: string; lastName?: string }; email?: string };
};

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: Record<string, unknown>) => void;
        signIn: () => Promise<AppleSignInResponse>;
      };
    };
  }
}

const APPLE_SDK = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/vi_VN/appleid.auth.js';

function loadAppleSdk(): Promise<void> {
  if (window.AppleID) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = APPLE_SDK;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không tải được Sign in with Apple'));
    document.head.appendChild(script);
  });
}

export type AppleWebCredential = {
  token: string;
  nonce: string;
  authorizationCode: string;
  firstName?: string;
  lastName?: string;
};

/**
 * Mở popup Apple. Ném lỗi của Apple JS (object { error: '<mã>' }, vd 'popup_closed_by_user') để nơi
 * gọi tự quyết định có báo hay không.
 */
export async function signInWithAppleWeb(): Promise<AppleWebCredential> {
  await loadAppleSdk();
  const rawNonce = randomToken(24);
  window.AppleID!.auth.init({
    clientId: APPLE_SERVICES_ID,
    scope: 'name email',
    // Tên miền auth đang mở (chính hoặc phụ) — mỗi tên miền đều phải khai báo Return URL với Apple.
    redirectURI: `https://${window.location.host}/sso/start/`,
    nonce: await sha256Hex(rawNonce),
    usePopup: true,
  });
  const res = await window.AppleID!.auth.signIn();
  return {
    token: res.authorization.id_token,
    nonce: rawNonce,
    authorizationCode: res.authorization.code,
    firstName: res.user?.name?.firstName,
    lastName: res.user?.name?.lastName,
  };
}
