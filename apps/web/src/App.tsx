import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './client-supervisor/context/AuthContext';
import { AppProvider } from './client-supervisor/context/AppContext';
import { SupervisorProvider } from './client-supervisor/context/SupervisorContext';

// Global Role & Portal Switcher
import { GlobalPortalSwitcher } from './components/common/GlobalPortalSwitcher';

// 1. Factory Admin Portal (Lazy)
const AdminPortalApp = lazy(() =>
  import('./AdminPortalApp').then((m) => ({ default: m.AdminPortalApp }))
);

// 2. Client Portal Layout & Pages (Lazy)
const ClientLayout = lazy(() =>
  import('./client-supervisor/components/layout/ClientLayout').then((m) => ({ default: m.ClientLayout }))
);
const OverviewPage = lazy(() =>
  import('./client-supervisor/pages/dashboard/OverviewPage').then((m) => ({ default: m.OverviewPage }))
);
const ProductCataloguePage = lazy(() =>
  import('./client-supervisor/pages/products/ProductCataloguePage').then((m) => ({ default: m.ProductCataloguePage }))
);
const ProductDetailPage = lazy(() =>
  import('./client-supervisor/pages/products/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage }))
);
const CreateOrderPage = lazy(() =>
  import('./client-supervisor/pages/orders/CreateOrderPage').then((m) => ({ default: m.CreateOrderPage }))
);
const MyOrdersPage = lazy(() =>
  import('./client-supervisor/pages/orders/MyOrdersPage').then((m) => ({ default: m.MyOrdersPage }))
);
const OrderDetailPage = lazy(() =>
  import('./client-supervisor/pages/orders/OrderDetailPage').then((m) => ({ default: m.OrderDetailPage }))
);
const ProductionTrackingPage = lazy(() =>
  import('./client-supervisor/pages/orders/ProductionTrackingPage').then((m) => ({ default: m.ProductionTrackingPage }))
);
const QuotationsPage = lazy(() =>
  import('./client-supervisor/pages/quotations/QuotationsPage').then((m) => ({ default: m.QuotationsPage }))
);
const MessagesPage = lazy(() =>
  import('./client-supervisor/pages/messages/MessagesPage').then((m) => ({ default: m.MessagesPage }))
);
const PaymentsPage = lazy(() =>
  import('./client-supervisor/pages/payments/PaymentsPage').then((m) => ({ default: m.PaymentsPage }))
);
const NotificationsPage = lazy(() =>
  import('./client-supervisor/pages/notifications/NotificationsPage').then((m) => ({ default: m.NotificationsPage }))
);
const SettingsPage = lazy(() =>
  import('./client-supervisor/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

// 3. Supervisor Portal Layout & Pages (Lazy)
const SupervisorLayout = lazy(() =>
  import('./client-supervisor/components/layout/SupervisorLayout').then((m) => ({ default: m.SupervisorLayout }))
);
const SupervisorDashboardPage = lazy(() =>
  import('./client-supervisor/pages/supervisor/SupervisorDashboardPage').then((m) => ({ default: m.SupervisorDashboardPage }))
);
const SupervisorOrdersPage = lazy(() =>
  import('./client-supervisor/pages/supervisor/SupervisorOrdersPage').then((m) => ({ default: m.SupervisorOrdersPage }))
);
const SupervisorMaterialsPage = lazy(() =>
  import('./client-supervisor/pages/supervisor/SupervisorMaterialsPage').then((m) => ({ default: m.SupervisorMaterialsPage }))
);
const SupervisorResourcesPage = lazy(() =>
  import('./client-supervisor/pages/supervisor/SupervisorResourcesPage').then((m) => ({ default: m.SupervisorResourcesPage }))
);
const SupervisorProductionPage = lazy(() =>
  import('./client-supervisor/pages/supervisor/SupervisorProductionPage').then((m) => ({ default: m.SupervisorProductionPage }))
);
const SupervisorIssuesPage = lazy(() =>
  import('./client-supervisor/pages/supervisor/SupervisorIssuesPage').then((m) => ({ default: m.SupervisorIssuesPage }))
);
const SupervisorNotificationsPage = lazy(() =>
  import('./client-supervisor/pages/supervisor/SupervisorNotificationsPage').then((m) => ({ default: m.SupervisorNotificationsPage }))
);
const SupervisorProfilePage = lazy(() =>
  import('./client-supervisor/pages/supervisor/SupervisorProfilePage').then((m) => ({ default: m.SupervisorProfilePage }))
);

// 4. Platform Hub & Unified Direct Login (Lazy)
const UnifiedGatewayPage = lazy(() =>
  import('./client-supervisor/pages/landing/UnifiedGatewayPage').then((m) => ({ default: m.UnifiedGatewayPage }))
);
const UnifiedLoginPage = lazy(() =>
  import('./client-supervisor/pages/auth/UnifiedLoginPage').then((m) => ({ default: m.UnifiedLoginPage }))
);

const PageFallback: React.FC = () => (
  <div style={{ display: 'flex', minHeight: '60vh', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px' }}>
    Loading module...
  </div>
);

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppProvider>
        <SupervisorProvider>
          <BrowserRouter>
            {/* Global Portal Switcher (Switch between Admin, Client, Supervisor, and Hub anywhere) */}
            <GlobalPortalSwitcher />

            <Suspense fallback={<PageFallback />}>
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
            </Suspense>
          </BrowserRouter>
        </SupervisorProvider>
      </AppProvider>
    </AuthProvider>
  );
};

export default App;
