import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './client-supervisor/context/AuthContext';
import { AppProvider } from './client-supervisor/context/AppContext';
import { SupervisorProvider } from './client-supervisor/context/SupervisorContext';

// Global Role & Portal Switcher
import { GlobalPortalSwitcher } from './components/common/GlobalPortalSwitcher';

// 1. Factory Admin Portal (Current Application Modules)
import { AdminPortalApp } from './AdminPortalApp';

// 2. Client Portal Layout & Pages (From Repo)
import { ClientLayout } from './client-supervisor/components/layout/ClientLayout';
import { OverviewPage } from './client-supervisor/pages/dashboard/OverviewPage';
import { ProductCataloguePage } from './client-supervisor/pages/products/ProductCataloguePage';
import { ProductDetailPage } from './client-supervisor/pages/products/ProductDetailPage';
import { CreateOrderPage } from './client-supervisor/pages/orders/CreateOrderPage';
import { MyOrdersPage } from './client-supervisor/pages/orders/MyOrdersPage';
import { OrderDetailPage } from './client-supervisor/pages/orders/OrderDetailPage';
import { ProductionTrackingPage } from './client-supervisor/pages/orders/ProductionTrackingPage';
import { QuotationsPage } from './client-supervisor/pages/quotations/QuotationsPage';
import { MessagesPage } from './client-supervisor/pages/messages/MessagesPage';
import { PaymentsPage } from './client-supervisor/pages/payments/PaymentsPage';
import { NotificationsPage } from './client-supervisor/pages/notifications/NotificationsPage';
import { SettingsPage } from './client-supervisor/pages/settings/SettingsPage';

// 3. Supervisor Portal Layout & Pages (From Repo)
import { SupervisorLayout } from './client-supervisor/components/layout/SupervisorLayout';
import { SupervisorDashboardPage } from './client-supervisor/pages/supervisor/SupervisorDashboardPage';
import { SupervisorOrdersPage } from './client-supervisor/pages/supervisor/SupervisorOrdersPage';
import { SupervisorMaterialsPage } from './client-supervisor/pages/supervisor/SupervisorMaterialsPage';
import { SupervisorResourcesPage } from './client-supervisor/pages/supervisor/SupervisorResourcesPage';
import { SupervisorProductionPage } from './client-supervisor/pages/supervisor/SupervisorProductionPage';
import { SupervisorIssuesPage } from './client-supervisor/pages/supervisor/SupervisorIssuesPage';
import { SupervisorNotificationsPage } from './client-supervisor/pages/supervisor/SupervisorNotificationsPage';
import { SupervisorProfilePage } from './client-supervisor/pages/supervisor/SupervisorProfilePage';

// 4. Platform Hub & Unified Direct Login (From Repo)
import { UnifiedGatewayPage } from './client-supervisor/pages/landing/UnifiedGatewayPage';
import { UnifiedLoginPage } from './client-supervisor/pages/auth/UnifiedLoginPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppProvider>
        <SupervisorProvider>
          <BrowserRouter>
            {/* Global Portal Switcher (Switch between Admin, Client, Supervisor, and Hub anywhere) */}
            <GlobalPortalSwitcher />

            <Routes>
              {/* 1. Factory Admin Portal Routes (Default on root) */}
              <Route path="/" element={<AdminPortalApp />} />
              <Route path="/admin" element={<AdminPortalApp />} />
              <Route path="/admin/:tab" element={<AdminPortalApp />} />

              {/* 2. Platform Hub & Unified Gateway */}
              <Route path="/hub" element={<UnifiedGatewayPage />} />
              <Route path="/gateway" element={<UnifiedGatewayPage />} />
              <Route path="/login" element={<UnifiedLoginPage />} />
              <Route path="/client/login" element={<UnifiedLoginPage />} />
              <Route path="/client/register" element={<Navigate to="/client/dashboard" replace />} />

              {/* 3. Protected Client Portal Routes */}
              <Route path="/client" element={<ClientLayout />}>
                <Route index element={<Navigate to="/client/dashboard" replace />} />
                <Route path="dashboard" element={<OverviewPage />} />
                <Route path="products" element={<ProductCataloguePage />} />
                <Route path="products/:id" element={<ProductDetailPage />} />
                <Route path="orders/new" element={<CreateOrderPage />} />
                <Route path="orders" element={<MyOrdersPage />} />
                <Route path="orders/:id" element={<OrderDetailPage />} />
                <Route path="orders/:id/tracking" element={<ProductionTrackingPage />} />
                <Route path="quotations" element={<QuotationsPage />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              {/* 4. Mill Supervisor Portal Routes */}
              <Route path="/supervisor" element={<SupervisorLayout />}>
                <Route index element={<Navigate to="/supervisor/dashboard" replace />} />
                <Route path="dashboard" element={<SupervisorDashboardPage />} />
                <Route path="orders" element={<SupervisorOrdersPage />} />
                <Route path="materials" element={<SupervisorMaterialsPage />} />
                <Route path="resources" element={<SupervisorResourcesPage />} />
                <Route path="production" element={<SupervisorProductionPage />} />
                <Route path="issues" element={<SupervisorIssuesPage />} />
                <Route path="notifications" element={<SupervisorNotificationsPage />} />
                <Route path="profile" element={<SupervisorProfilePage />} />
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SupervisorProvider>
      </AppProvider>
    </AuthProvider>
  );
};

export default App;
