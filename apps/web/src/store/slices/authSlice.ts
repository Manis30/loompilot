import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { setAuthCookies, clearAuthCookies, getAuthCookie } from '../../utils/cookieUtils';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  avatarUrl?: string;
  processAreas?: string[];
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  realm: 'user' | 'client';
  isAuthenticated: boolean;
}

const getInitialToken = (): string | null => {
  try {
    return (
      localStorage.getItem('loompilot_token') ||
      getAuthCookie('loompilot_token') ||
      getAuthCookie('access_token')
    );
  } catch {
    return null;
  }
};

const getInitialUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem('loompilot_user');
    if (raw) return JSON.parse(raw);

    const token = getAuthCookie('loompilot_token') || getAuthCookie('access_token');
    const roleCookie = getAuthCookie('loompilot_role');
    if (token && roleCookie) {
      return {
        id: 'auth_restored',
        email: '',
        name: roleCookie.toUpperCase(),
        role: roleCookie,
        tenantId: 'tenant_loompilot_tn_01',
      };
    }
    return null;
  } catch {
    return null;
  }
};

const getInitialRealm = (): 'user' | 'client' => {
  try {
    const realm = localStorage.getItem('loompilot_realm');
    if (realm === 'client') return 'client';
    const roleCookie = getAuthCookie('loompilot_role');
    if (roleCookie === 'client') return 'client';
    return 'user';
  } catch {
    return 'user';
  }
};

const token = getInitialToken();
const user = getInitialUser();

const initialState: AuthState = {
  user,
  token,
  realm: getInitialRealm(),
  isAuthenticated: !!token,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: AuthUser; token: string; realm?: 'user' | 'client' }>
    ) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.realm = action.payload.realm || (action.payload.user.role === 'client' ? 'client' : 'user');
      state.isAuthenticated = true;

      try {
        localStorage.setItem('loompilot_token', action.payload.token);
        localStorage.setItem('loompilot_user', JSON.stringify(action.payload.user));
        localStorage.setItem('loompilot_realm', state.realm);
      } catch (err) {
        console.warn('Failed to persist auth credentials:', err);
      }

      // Persist to document.cookie as well
      setAuthCookies(action.payload.token, action.payload.user.role);
    },
    updateUser: (state, action: PayloadAction<Partial<AuthUser>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        try {
          localStorage.setItem('loompilot_user', JSON.stringify(state.user));
        } catch (err) {
          console.warn('Failed to persist updated user:', err);
        }
        if (action.payload.role) {
          setAuthCookies(state.token || '', action.payload.role);
        }
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;

      try {
        localStorage.removeItem('loompilot_token');
        localStorage.removeItem('loompilot_user');
        localStorage.removeItem('loompilot_realm');
      } catch (err) {
        console.warn('Failed to clear auth from localStorage:', err);
      }

      // Remove tokens and role from cookies
      clearAuthCookies();
    },
  },
});

export const { setCredentials, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;
