import React, { createContext, useContext, useState, useEffect } from 'react';
import { ClientProfile } from '../types';
import { storageService } from '../services/storageService';
import { useGetMeQuery, useLogoutClientMutation } from '../../store/api/authApi';
import { useAppDispatch } from '../../store/hooks';
import { logout as authLogout } from '../../store/slices/authSlice';

const isDemoEnabled = (import.meta as any).env?.VITE_ENABLE_DEMO_LOGIN === 'true';

interface AuthContextType {
  user: ClientProfile | null;
  isAuthenticated: boolean;
  login: (email: string, pass: string, profileOverride?: ClientProfile) => { success: boolean; error?: string };
  directLoginClient: () => { success: boolean; error?: string };
  register: (data: Partial<ClientProfile> & { password?: string }) => { success: boolean; error?: string };
  logout: () => void;
  updateProfile: (updates: Partial<ClientProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const [logoutClientMutation] = useLogoutClientMutation();

  const token = typeof window !== 'undefined' ? localStorage.getItem('loompilot_token') : null;
  const realm = typeof window !== 'undefined' ? localStorage.getItem('loompilot_realm') : null;
  const isClientSession = !!token && (realm === 'client' || !realm);

  // In normal mode, do not treat a cached profile alone as proof of authentication
  const [user, setUser] = useState<ClientProfile | null>(() => {
    if (isDemoEnabled) {
      const savedUser = storageService.getAuthUser();
      if (savedUser) return savedUser;
    }
    return null;
  });

  // Use existing auth API session restoration (/api/v1/me)
  const { data: meData, isSuccess: isMeSuccess, isError: isMeError } = useGetMeQuery(
    undefined,
    { skip: !isClientSession }
  );

  useEffect(() => {
    if (isMeSuccess && meData) {
      const profile = (meData as any)?.profile;
      if (profile && ((meData as any)?.realm === 'client' || !meData.realm)) {
        const restored: ClientProfile = {
          id: profile.id || profile._id || 'CLT-RESTORED',
          clientCode: `CLT-${(profile.id || profile._id || '').slice(-6).toUpperCase()}`,
          company: profile.clientName || profile.name || 'Client Corporation',
          brand: profile.clientName || profile.name || 'Commercial Line',
          contactPerson: profile.name,
          designation: 'Authorized Sourcing Representative',
          email: profile.email || '',
          phone: profile.phone || '+91 98765 43210',
          shippingPlant: 'Designated Mill Inward Dock',
          billingAddress: [profile.city, profile.country].filter(Boolean).join(', ') || 'Corporate Office',
          accountTier: 'Enterprise Verified',
          accountManager: {
            name: 'Operations Desk',
            email: 'ops@mill.loompilot.local',
            phone: '+91 80 4000 1122',
          },
        };
        setUser(restored);
        storageService.setAuthUser(restored);
      }
    } else if (isMeError && !isDemoEnabled) {
      // Backend rejected token — clear client session
      logout();
    }
  }, [isMeSuccess, isMeError, meData]);

  useEffect(() => {
    if (user) {
      storageService.setAuthUser(user);
    } else {
      storageService.setAuthUser(null);
    }
  }, [user]);

  const login = (email: string, _pass: string, profileOverride?: ClientProfile) => {
    // When called with confirmed backend profileOverride from loginClient mutation
    if (profileOverride) {
      setUser(profileOverride);
      storageService.setClient(profileOverride);
      return { success: true };
    }

    // In normal mode without verified backend credentials, reject unauthenticated login
    return {
      success: false,
      error: 'Invalid corporate credentials. Authentication must be verified through the mill security gateway.',
    };
  };

  const directLoginClient = () => {
    if (!isDemoEnabled) {
      return { success: false, error: 'Direct demo authentication is disabled in standard operation.' };
    }
    const storedClient = storageService.getClient();
    setUser(storedClient);
    return { success: true };
  };

  const register = (_data: Partial<ClientProfile> & { password?: string }) => {
    return {
      success: false,
      error: 'Client entity registration must be provisioned through mill administration and enterprise onboarding contracts.',
    };
  };

  const logout = () => {
    setUser(null);
    storageService.setAuthUser(null);
    try {
      logoutClientMutation().unwrap().catch(() => {});
    } catch {}
    dispatch(authLogout());
    try {
      localStorage.removeItem('loompilot_token');
      localStorage.removeItem('loompilot_user');
      localStorage.removeItem('loompilot_realm');
      localStorage.removeItem('loompilot_client_profile');
      localStorage.removeItem('loompilot_auth_user');
    } catch (e) {
      console.warn('Failed to clear storage on logout:', e);
    }
  };

  const updateProfile = (updates: Partial<ClientProfile>) => {
    if (user) {
      const updated = { ...user, ...updates };
      setUser(updated);
      storageService.setClient(updated);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && (isDemoEnabled || (!!token && (realm === 'client' || !realm))),
        login,
        directLoginClient,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
