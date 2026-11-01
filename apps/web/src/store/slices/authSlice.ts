import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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
    return localStorage.getItem('loompilot_token');
  } catch {
    return null;
  }
};

const getInitialUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem('loompilot_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getInitialRealm = (): 'user' | 'client' => {
  try {
    const realm = localStorage.getItem('loompilot_realm');
    return realm === 'client' ? 'client' : 'user';
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
      state.realm = action.payload.realm || 'user';
      state.isAuthenticated = true;

      try {
        localStorage.setItem('loompilot_token', action.payload.token);
        localStorage.setItem('loompilot_user', JSON.stringify(action.payload.user));
        localStorage.setItem('loompilot_realm', state.realm);
      } catch (err) {
        console.warn('Failed to persist auth credentials:', err);
      }
    },
    updateUser: (state, action: PayloadAction<Partial<AuthUser>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        try {
          localStorage.setItem('loompilot_user', JSON.stringify(state.user));
        } catch (err) {
          console.warn('Failed to persist updated user:', err);
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
    },
  },
});

export const { setCredentials, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;

