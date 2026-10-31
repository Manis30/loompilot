import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Toaster } from '../common/Toaster';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

export const ClientLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/client/login" replace />;
  }

  return (
    <div className="min-h-screen bg-ivory font-sans text-charcoal flex">
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={cn(
          'flex-1 flex flex-col min-h-screen transition-all duration-300',
          collapsed ? 'lg:ml-20' : 'lg:ml-64'
        )}
      >
        <Header onOpenMobile={() => setMobileOpen(true)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Subtle Textile Top Accent Bar */}
          <div className="w-full h-1 bg-gradient-to-r from-vermilion via-charcoal to-warning rounded-full opacity-80 mb-6" />
          <Outlet />
        </main>
      </div>

      {/* Global Toast Container */}
      <Toaster />
    </div>
  );
};

