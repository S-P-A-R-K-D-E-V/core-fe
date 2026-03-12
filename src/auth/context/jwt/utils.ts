import { paths } from 'src/routes/paths';

import axios, { endpoints } from 'src/utils/axios';
import { IRefreshTokenRequest, IAuthResponse } from 'src/types/corecms-api';

// ----------------------------------------------------------------------

const STORAGE_KEY_ACCESS = 'accessToken';
const STORAGE_KEY_REFRESH = 'refreshToken';

// ----------------------------------------------------------------------

function jwtDecode(token: string) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    window
      .atob(base64)
      .split('')
      .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join('')
  );

  return JSON.parse(jsonPayload);
}

// ----------------------------------------------------------------------

export const isValidToken = (accessToken: string) => {
  if (!accessToken) {
    return false;
  }

  try {
    const decoded = jwtDecode(accessToken);
    const currentTime = Date.now() / 1000;
    return decoded.exp > currentTime;
  } catch (error) {
    return false;
  }
};

// ----------------------------------------------------------------------

export const tokenExpired = (exp: number) => {
  // eslint-disable-next-line prefer-const
  let expiredTimer;

  const currentTime = Date.now();

  // Test token expires after 10s
  // const timeLeft = currentTime + 10000 - currentTime; // ~10s
  const timeLeft = exp * 1000 - currentTime;

  clearTimeout(expiredTimer);

  expiredTimer = setTimeout(async () => {
    console.log('Token expired, attempting refresh...');
    
    const refreshToken = sessionStorage.getItem(STORAGE_KEY_REFRESH);
    
    if (refreshToken) {
      try {
        const response = await axios.post<IAuthResponse>(endpoints.auth.refreshToken, {
          refreshToken,
        } as IRefreshTokenRequest);
        
        const { token, refreshToken: newRefreshToken } = response.data;
        
        setSession(token, newRefreshToken);
        
        console.log('Token refreshed successfully');
        
        // Reload page to reinitialize with new token
        window.location.reload();
      } catch (error) {
        console.error('Failed to refresh token:', error);
        
        // Clear tokens and redirect to login
        sessionStorage.removeItem(STORAGE_KEY_ACCESS);
        sessionStorage.removeItem(STORAGE_KEY_REFRESH);
        
        window.location.href = paths.auth.jwt.login;
      }
    } else {
      sessionStorage.removeItem(STORAGE_KEY_ACCESS);
      window.location.href = paths.auth.jwt.login;
    }
  }, timeLeft);
};

// ----------------------------------------------------------------------

export const setSession = (accessToken: string | null, refreshToken?: string | null) => {
  if (accessToken) {
    sessionStorage.setItem(STORAGE_KEY_ACCESS, accessToken);

    if (refreshToken) {
      sessionStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
    }

    axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

    // This function below will handle when token is expired
    const { exp } = jwtDecode(accessToken);
    tokenExpired(exp);
  } else {
    sessionStorage.removeItem(STORAGE_KEY_ACCESS);
    sessionStorage.removeItem(STORAGE_KEY_REFRESH);

    delete axios.defaults.headers.common.Authorization;
  }
};

// ----------------------------------------------------------------------

export const getRefreshToken = () => sessionStorage.getItem(STORAGE_KEY_REFRESH);
