'use client';

import { useMemo, useState, useEffect, useReducer, useCallback } from 'react';

import axios, { endpoints } from 'src/utils/axios';
import { getStorageUrl } from 'src/utils/storage';
import {
  IAuthResponse,
  ILoginRequest,
  IRegisterRequest,
  ILogoutRequest,
  IVerifyOtpRequest,
  IResendOtpRequest,
  IRestoreSessionRequest,
  IOAuthLoginRequest,
} from 'src/types/corecms-api';

import { AuthContext } from './auth-context';
import { setSession, isValidToken, getRefreshToken } from './utils';
import { AuthUserType, ActionMapType, AuthStateType } from '../../types';

// ----------------------------------------------------------------------
/**
 * Core CMS Backend Integration
 * Integrated with .NET Core backend API at http://localhost:2510
 * Supports: OTP email verification, login sessions (7-day persistence)
 */
// ----------------------------------------------------------------------

enum Types {
  INITIAL = 'INITIAL',
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  LOGOUT = 'LOGOUT',
}

type Payload = {
  [Types.INITIAL]: {
    user: AuthUserType;
  };
  [Types.LOGIN]: {
    user: AuthUserType;
  };
  [Types.REGISTER]: {
    user: AuthUserType;
  };
  [Types.LOGOUT]: undefined;
};

type ActionsType = ActionMapType<Payload>[keyof ActionMapType<Payload>];

// ----------------------------------------------------------------------

const initialState: AuthStateType = {
  user: null,
  loading: true,
};

const reducer = (state: AuthStateType, action: ActionsType) => {
  if (action.type === Types.INITIAL) {
    return {
      loading: false,
      // Race-condition guard: nếu initialize() kết thúc với user=null (vd: tryRestoreSession
      // fail sau khi user đã login xong), không override user đang có → giữ trạng thái login.
      // LOGOUT dùng riêng Types.LOGOUT nên trường hợp đó không bị ảnh hưởng.
      user: action.payload.user !== null ? action.payload.user : state.user,
    };
  }
  if (action.type === Types.LOGIN) {
    return {
      ...state,
      user: action.payload.user,
    };
  }
  if (action.type === Types.REGISTER) {
    return {
      ...state,
      user: action.payload.user,
    };
  }
  if (action.type === Types.LOGOUT) {
    return {
      ...state,
      user: null,
    };
  }
  return state;
};

// ----------------------------------------------------------------------

const STORAGE_KEY = 'accessToken';
const SESSION_TOKEN_KEY = 'sessionToken';

type Props = {
  children: React.ReactNode;
};

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

function buildUserFromToken(accessToken: string) {
  const tokenData = jwtDecode(accessToken);
  const rolesClaim =
    tokenData['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
    tokenData.role ||
    'User';
  const roles = Array.isArray(rolesClaim) ? rolesClaim : [rolesClaim];
  const permissionsClaim = tokenData.permission || [];
  const permissions = Array.isArray(permissionsClaim) ? permissionsClaim : [permissionsClaim];

  const firstName = tokenData.given_name || tokenData.firstName || '';
  const lastName = tokenData.family_name || tokenData.lastName || '';
  const displayName =
    tokenData.name ||
    tokenData['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ||
    `${firstName} ${lastName}`.trim() ||
    'User';

  return {
    id: tokenData.sub || tokenData.id || tokenData.userId,
    email:
      tokenData.email ||
      tokenData['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
    displayName,
    firstName,
    lastName,
    role: roles[0] || 'User',
    roles,
    permissions,
    photoURL: tokenData.picture || '/assets/images/avatar/avatar_default.jpg',
    accessToken,
  };
}

function buildUserFromResponse(res: IAuthResponse, avatarUrl?: string) {
  const { token, refreshToken, firstName, lastName, id, email, roles, permissions, role, sessionToken, hasShiftPreference } = res;
  return {
    id,
    email,
    displayName: `${firstName} ${lastName}`,
    firstName,
    lastName,
    role: role || (roles && roles[0]) || 'User',
    roles: roles || [],
    permissions: permissions || [],
    photoURL: avatarUrl || '/assets/images/avatar/avatar_default.jpg',
    accessToken: token,
    refreshToken,
    sessionToken,
    hasShiftPreference: hasShiftPreference ?? true,
  };
}

export function AuthProvider({ children }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [pendingVerification, setPendingVerification] = useState<{ email: string } | null>(null);

  // Try to restore session from localStorage (7-day persistence)
  const tryRestoreSession = useCallback(async (): Promise<boolean> => {
    try {
      const savedSessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
      if (!savedSessionToken) return false;

      const data: IRestoreSessionRequest = { sessionToken: savedSessionToken };
      const res = await axios.post<IAuthResponse>(endpoints.auth.restoreSession, data);
      const { token, refreshToken, sessionToken } = res.data;

      setSession(token, refreshToken);

      // Update session token if rotated
      if (sessionToken) {
        localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
      }

      const user = buildUserFromResponse(res.data);
      dispatch({ type: Types.INITIAL, payload: { user } });
      return true;
    } catch (error) {
      // Session expired or invalid, clean up
      localStorage.removeItem(SESSION_TOKEN_KEY);
      return false;
    }
  }, []);

  const fetchAndPatchAvatar = useCallback(async (baseUser: any) => {
    try {
      const res = await axios.get(endpoints.users.me);
      const profileImageUrl: string | undefined = res.data?.profileImageUrl;
      if (profileImageUrl) {
        dispatch({ type: Types.LOGIN, payload: { user: { ...baseUser, photoURL: getStorageUrl(profileImageUrl) } } });
      }
    } catch {
      // non-blocking — keep existing photoURL
    }
  }, []);

  const initialize = useCallback(async () => {
    try {
      const accessToken = sessionStorage.getItem(STORAGE_KEY);

      if (accessToken && isValidToken(accessToken)) {
        setSession(accessToken);
        const user = buildUserFromToken(accessToken);
        dispatch({ type: Types.INITIAL, payload: { user: { ...user, accessToken } } });
        fetchAndPatchAvatar({ ...user, accessToken });
        return;
      }

      // No valid access token — try to restore from login session (7-day cookie)
      // NOTE: này là async — user có thể login trong lúc chờ API
      const restored = await tryRestoreSession();
      if (restored) return;

      // Double-check sau khi await: nếu user đã login trong lúc tryRestoreSession chạy
      // (race condition), token đã được lưu vào sessionStorage → dùng nó thay vì dispatch null.
      const newToken = sessionStorage.getItem(STORAGE_KEY);
      if (newToken && isValidToken(newToken)) {
        setSession(newToken);
        const user = buildUserFromToken(newToken);
        dispatch({ type: Types.INITIAL, payload: { user: { ...user, accessToken: newToken } } });
        fetchAndPatchAvatar({ ...user, accessToken: newToken });
        return;
      }

      dispatch({ type: Types.INITIAL, payload: { user: null } });
    } catch (error) {
      console.error(error);
      // Tương tự: nếu lỗi xảy ra nhưng user đã login, không xoá state
      const savedToken = sessionStorage.getItem(STORAGE_KEY);
      if (savedToken && isValidToken(savedToken)) {
        setSession(savedToken);
        const user = buildUserFromToken(savedToken);
        dispatch({ type: Types.INITIAL, payload: { user: { ...user, accessToken: savedToken } } });
        return;
      }
      dispatch({ type: Types.INITIAL, payload: { user: null } });
    }
  }, [tryRestoreSession, fetchAndPatchAvatar]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // LOGIN
  const login = useCallback(async (email: string, password: string) => {
    const data: ILoginRequest = { email, password };
    let res: Awaited<ReturnType<typeof axios.post<IAuthResponse>>>;
    try {
      res = await axios.post<IAuthResponse>(endpoints.auth.login, data);
    } catch (error: any) {
      // Backend returns 400 with errors['User.EmailNotVerified'] when email is unverified
      if (error?.response?.data?.errors?.['User.EmailNotVerified']) {
        setPendingVerification({ email });
        throw new Error('OTP_REQUIRED');
      }
      throw error;
    }
    const { token, refreshToken, sessionToken, requiresOtpVerification } = res.data;

    // If OTP required (email not verified), redirect to verification
    if (requiresOtpVerification) {
      setPendingVerification({ email });
      throw new Error('OTP_REQUIRED');
    }

    setSession(token, refreshToken);

    // Save session token for 7-day quick login
    if (sessionToken) {
      localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    }

    const user = buildUserFromResponse(res.data);
    dispatch({ type: Types.LOGIN, payload: { user } });
    fetchAndPatchAvatar(user);
  }, [fetchAndPatchAvatar]);

  // REGISTER (now requires OTP verification before activation)
  const register = useCallback(
    async (email: string, password: string, firstName: string, lastName: string) => {
      const data: IRegisterRequest = { email, password, firstName, lastName };
      await axios.post<IAuthResponse>(endpoints.auth.register, data);

      // After registration, set pending verification
      // User must verify OTP before they can login
      setPendingVerification({ email });
    },
    []
  );

  // VERIFY OTP
  const verifyOtp = useCallback(async (email: string, otpCode: string) => {
    const data: IVerifyOtpRequest = { email, otpCode };
    const res = await axios.post<IAuthResponse>(endpoints.auth.verifyOtp, data);
    const { token, refreshToken, sessionToken } = res.data;

    setSession(token, refreshToken);

    if (sessionToken) {
      localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    }

    const user = buildUserFromResponse(res.data);
    setPendingVerification(null);
    dispatch({ type: Types.LOGIN, payload: { user } });
  }, []);

  // RESEND OTP
  const resendOtp = useCallback(async (email: string) => {
    const data: IResendOtpRequest = { email };
    await axios.post(endpoints.auth.resendOtp, data);
  }, []);

  // RESTORE SESSION (manual call from UI)
  const restoreSession = useCallback(async (sessionToken: string) => {
    const data: IRestoreSessionRequest = { sessionToken };
    const res = await axios.post<IAuthResponse>(endpoints.auth.restoreSession, data);
    const { token, refreshToken, sessionToken: newSessionToken } = res.data;

    setSession(token, refreshToken);

    if (newSessionToken) {
      localStorage.setItem(SESSION_TOKEN_KEY, newSessionToken);
    }

    const user = buildUserFromResponse(res.data);
    dispatch({ type: Types.LOGIN, payload: { user } });
  }, []);

  // OAUTH LOGIN (Google / Facebook)
  const loginWithOAuth = useCallback(async (provider: 'google' | 'facebook', token: string, avatarUrl?: string) => {
    const data: IOAuthLoginRequest = { provider, token };
    const res = await axios.post<IAuthResponse>(endpoints.auth.oauthLogin, data);
    const { token: accessToken, refreshToken, sessionToken } = res.data;

    setSession(accessToken, refreshToken);

    if (sessionToken) {
      localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    }

    const user = buildUserFromResponse(res.data, avatarUrl);
    dispatch({ type: Types.LOGIN, payload: { user } });
  }, []);

  // UPDATE USER (e.g. after avatar/profile change)
  const updateUser = useCallback((updates: Partial<NonNullable<typeof state.user>>) => {
    if (!state.user) return;
    dispatch({ type: Types.LOGIN, payload: { user: { ...state.user, ...updates } } });
  }, [state.user]);

  // LOGOUT
  const logout = useCallback(async () => {
    try {
      const userId = state.user?.id;
      const refreshToken = getRefreshToken();

      if (userId && refreshToken) {
        const logoutData: ILogoutRequest = { userId };
        await axios.post(endpoints.auth.logout, logoutData);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setSession(null);
      localStorage.removeItem(SESSION_TOKEN_KEY);
      setPendingVerification(null);
      dispatch({ type: Types.LOGOUT });
    }
  }, [state.user]);

  // ----------------------------------------------------------------------

  const checkAuthenticated = state.user ? 'authenticated' : 'unauthenticated';

  const status = state.loading ? 'loading' : checkAuthenticated;

  const memoizedValue = useMemo(
    () => ({
      user: state.user,
      method: 'jwt',
      loading: status === 'loading',
      authenticated: status === 'authenticated',
      unauthenticated: status === 'unauthenticated',
      //
      login,
      register,
      logout,
      verifyOtp,
      resendOtp,
      restoreSession,
      loginWithOAuth,
      pendingVerification,
      updateUser,
    }),
    [login, logout, register, verifyOtp, resendOtp, restoreSession, loginWithOAuth, updateUser, state.user, status, pendingVerification]
  );

  return <AuthContext.Provider value={memoizedValue}>{children}</AuthContext.Provider>;
}
