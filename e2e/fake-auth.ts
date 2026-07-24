// ----------------------------------------------------------------------
// Builds a locally-decodable (unsigned) JWT so the app's JwtAuthProvider
// (src/auth/context/jwt/auth-provider.tsx) can build a logged-in Admin user
// purely client-side from sessionStorage, with zero network calls. The app
// never verifies the signature client-side (see isValidToken in
// src/auth/context/jwt/utils.ts), so this is sufficient to reach any
// dashboard page under Playwright without a real backend.
// ----------------------------------------------------------------------

function base64url(input: object) {
  return Buffer.from(JSON.stringify(input))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function buildFakeAccessToken(role: 'Admin' | 'Manager' | 'Staff' = 'Admin') {
  const header = { alg: 'none', typ: 'JWT' };
  const payload = {
    sub: 'e2e-user-1',
    id: 'e2e-user-1',
    email: 'e2e-admin@example.com',
    given_name: 'E2E',
    family_name: 'Admin',
    name: 'E2E Admin',
    role,
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': role,
    permission: [],
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // 24h from now
    iat: Math.floor(Date.now() / 1000),
  };
  return `${base64url(header)}.${base64url(payload)}.fake-signature`;
}
