import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  ShoppingBag,
  Factory,
  Compass,
  Lock,
  LogOut,
  LogIn
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { logout as authLogout } from '../../store/slices/authSlice';
import { clearAuthCookies, getAuthCookie } from '../../utils/cookieUtils';
import { useLogoutStaffMutation, useLogoutClientMutation } from '../../store/api/authApi';

export const GlobalPortalSwitcher: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const auth = useAppSelector((state) => state.auth);

  const [logoutStaff] = useLogoutStaffMutation();
  const [logoutClient] = useLogoutClientMutation();

  const path = location.pathname;

  // Resolve current active path
  const isClientPath = path.startsWith('/client');
  const isSupervisorPath = path.startsWith('/supervisor');
  const isHubPath = path === '/hub' || path === '/gateway';
  const isLoginPath = path === '/login';
  const isAdminPath = !isClientPath && !isSupervisorPath && !isHubPath && !isLoginPath;

  // Resolve authenticated role
  let role: string | null = auth.user?.role?.toLowerCase() || null;
  if (!role && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('loompilot_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.role) role = parsed.role.toLowerCase();
      }
    } catch {}
  }
  if (!role) {
    const cookieRole = getAuthCookie('loompilot_role');
    if (cookieRole) role = cookieRole.toLowerCase();
  }
  if (!role && typeof window !== 'undefined') {
    const realm = localStorage.getItem('loompilot_realm');
    if (realm === 'client') role = 'client';
  }

  const token =
    auth.token ||
    (typeof window !== 'undefined' ? localStorage.getItem('loompilot_token') : null) ||
    getAuthCookie('loompilot_token') ||
    getAuthCookie('access_token');

  const isAuthenticated = !!token && !!role;

  const handleSignOut = async () => {
    try {
      if (role === 'client') {
        await logoutClient().unwrap().catch(() => {});
      } else {
        await logoutStaff().unwrap().catch(() => {});
      }
    } catch {}
    dispatch(authLogout());
    clearAuthCookies();
    try {
      localStorage.removeItem('loompilot_token');
      localStorage.removeItem('loompilot_user');
      localStorage.removeItem('loompilot_realm');
      localStorage.removeItem('loompilot_client_profile');
      localStorage.removeItem('loompilot_auth_user');
    } catch {}
    navigate('/login');
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 14,
        right: 20,
        zIndex: 9999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 7px',
        background: 'rgba(255, 255, 255, 0.94)',
        backdropFilter: 'blur(12px)',
        border: '1px solid #e2e8f0',
        borderRadius: 9999,
        boxShadow: '0 4px 18px rgba(16, 24, 40, 0.08)',
        userSelect: 'none'
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: '#64748b',
          padding: '0 8px 0 6px'
        }}
      >
        {isAuthenticated ? `Role: ${role?.toUpperCase()}` : 'Portal:'}
      </span>

      {/* Admin Portal Tab */}
      <button
        type="button"
        disabled={isAuthenticated && role !== 'admin'}
        onClick={() => {
          if (!isAuthenticated) navigate('/login');
          else if (role === 'admin') navigate('/admin');
        }}
        title={
          isAuthenticated && role !== 'admin'
            ? 'Restricted: Current session does not have Admin privileges'
            : 'Factory Administrator Portal'
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: isAdminPath ? 700 : 500,
          color: isAuthenticated && role !== 'admin' ? '#94a3b8' : '#18191B',
          background: isAdminPath ? '#79B4B7' : 'transparent',
          border: isAdminPath ? '1px solid #67A4A7' : '1px solid transparent',
          cursor: isAuthenticated && role !== 'admin' ? 'not-allowed' : 'pointer',
          opacity: isAuthenticated && role !== 'admin' ? 0.5 : 1,
          transition: 'all 0.15s ease'
        }}
      >
        {isAuthenticated && role !== 'admin' ? (
          <Lock size={13} color="#94a3b8" />
        ) : (
          <ShieldCheck size={14} color="#18191B" />
        )}
        <span>Admin</span>
      </button>

      {/* Supervisor Portal Tab */}
      <button
        type="button"
        disabled={isAuthenticated && role !== 'supervisor'}
        onClick={() => {
          if (!isAuthenticated) navigate('/login');
          else if (role === 'supervisor') navigate('/supervisor/dashboard');
        }}
        title={
          isAuthenticated && role !== 'supervisor'
            ? 'Restricted: Current session does not have Supervisor privileges'
            : 'Mill Supervisor Portal'
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: isSupervisorPath ? 700 : 500,
          background: isSupervisorPath ? '#E65338' : 'transparent',
          color: isSupervisorPath ? '#ffffff' : (isAuthenticated && role !== 'supervisor' ? '#94a3b8' : '#18191B'),
          border: isSupervisorPath ? '1px solid #D24227' : '1px solid transparent',
          cursor: isAuthenticated && role !== 'supervisor' ? 'not-allowed' : 'pointer',
          opacity: isAuthenticated && role !== 'supervisor' ? 0.5 : 1,
          transition: 'all 0.15s ease'
        }}
      >
        {isAuthenticated && role !== 'supervisor' ? (
          <Lock size={13} color="#94a3b8" />
        ) : (
          <Factory size={14} color={isSupervisorPath ? '#ffffff' : '#18191B'} />
        )}
        <span>Supervisor</span>
      </button>

      {/* Client Portal Tab */}
      <button
        type="button"
        disabled={isAuthenticated && role !== 'client'}
        onClick={() => {
          if (!isAuthenticated) navigate('/login');
          else if (role === 'client') navigate('/client/dashboard');
        }}
        title={
          isAuthenticated && role !== 'client'
            ? 'Restricted: Current session does not have Client privileges'
            : 'Enterprise Client Portal'
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: isClientPath ? 700 : 500,
          color: isClientPath ? '#ffffff' : (isAuthenticated && role !== 'client' ? '#94a3b8' : '#18191B'),
          background: isClientPath ? '#252622' : 'transparent',
          border: isClientPath ? '1px solid #191A16' : '1px solid transparent',
          cursor: isAuthenticated && role !== 'client' ? 'not-allowed' : 'pointer',
          opacity: isAuthenticated && role !== 'client' ? 0.5 : 1,
          transition: 'all 0.15s ease'
        }}
      >
        {isAuthenticated && role !== 'client' ? (
          <Lock size={13} color="#94a3b8" />
        ) : (
          <ShoppingBag size={14} color={isClientPath ? '#ffffff' : '#18191B'} />
        )}
        <span>Client</span>
      </button>

      {/* Sign In / Sign Out Action */}
      {isAuthenticated ? (
        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out and clear session cookies"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 700,
            color: '#dc2626',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <LogOut size={13} color="#dc2626" />
          <span>Logout</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => navigate('/login')}
          title="Sign in with credentials"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 700,
            color: '#2563eb',
            background: 'rgba(37, 99, 235, 0.08)',
            border: '1px solid rgba(37, 99, 235, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <LogIn size={13} color="#2563eb" />
          <span>Login</span>
        </button>
      )}
    </div>
  );
};
