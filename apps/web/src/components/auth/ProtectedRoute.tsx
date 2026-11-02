import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { getAuthCookie } from '../../utils/cookieUtils';

interface ProtectedRouteProps {
  allowedRoles: ('admin' | 'supervisor' | 'client')[];
  children: React.ReactElement;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const location = useLocation();
  const authState = useAppSelector((state) => state.auth);

  // 1. Verify token existence from state, localStorage, or cookies
  const token =
    authState.token ||
    (typeof window !== 'undefined' ? localStorage.getItem('loompilot_token') : null) ||
    getAuthCookie('loompilot_token') ||
    getAuthCookie('access_token');

  // 2. Resolve authenticated role
  let role: string | null = null;
  if (authState.user?.role) {
    role = authState.user.role.toLowerCase();
  } else if (typeof window !== 'undefined') {
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

  // 3. If unauthenticated, redirect to unified login
  if (!token || !role) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const normalizedRole = role as 'admin' | 'supervisor' | 'client';

  // 4. Role-based isolation: If current role is not permitted, redirect strictly to their own portal
  if (!allowedRoles.includes(normalizedRole)) {
    if (normalizedRole === 'admin') {
      return <Navigate to="/admin" replace />;
    } else if (normalizedRole === 'supervisor') {
      return <Navigate to="/supervisor/dashboard" replace />;
    } else if (normalizedRole === 'client') {
      return <Navigate to="/client/dashboard" replace />;
    } else {
      return <Navigate to="/login" replace />;
    }
  }

  return children;
};
