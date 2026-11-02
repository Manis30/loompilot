import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { SupervisorProvider } from './context/SupervisorContext';

// Layouts
import { ClientLayout } from './components/layout/ClientLayout';
import { SupervisorLayout } from './components/layout/SupervisorLayout';

// Unified Direct Login Page
import { UnifiedLoginPage } from './pages/auth/UnifiedLoginPage';

// Client Portal Pages
import { OverviewPage } from './pages/dashboard/OverviewPage';
import { ProductCataloguePage } from './pages/products/ProductCataloguePage';
import { ProductDetailPage } from './pages/products/ProductDetailPage';
import { CreateOrderPage } from './pages/orders/CreateOrderPage';
import { MyOrdersPage } from './pages/orders/MyOrdersPage';
import { OrderDetailPage } from './pages/orders/OrderDetailPage';
import { ProductionTrackingPage } from './pages/orders/ProductionTrackingPage';
import { QuotationsPage } from './pages/quotations/QuotationsPage';
import { MessagesPage } from './pages/messages/MessagesPage';
import { PaymentsPage } from './pages/payments/PaymentsPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { SettingsPage } from './pages/settings/SettingsPage';

// Supervisor Portal Pages (React)
import { SupervisorDashboardPage } from './pages/supervisor/SupervisorDashboardPage';
import { SupervisorOrdersPage } from './pages/supervisor/SupervisorOrdersPage';
import { SupervisorMaterialsPage } from './pages/supervisor/SupervisorMaterialsPage';
import { SupervisorResourcesPage } from './pages/supervisor/SupervisorResourcesPage';
import { SupervisorProductionPage } from './pages/supervisor/SupervisorProductionPage';
import { SupervisorIssuesPage } from './pages/supervisor/SupervisorIssuesPage';
import { SupervisorNotificationsPage } from './pages/supervisor/SupervisorNotificationsPage';
import { SupervisorProfilePage } from './pages/supervisor/SupervisorProfilePage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppProvider>
        <SupervisorProvider>
          <BrowserRouter>
            <Routes>
              {/* Unified Login for Both Client & Supervisor */}
              <Route path="/" element={<UnifiedLoginPage />} />
              <Route path="/login" element={<UnifiedLoginPage />} />
              <Route path="/client/login" element={<UnifiedLoginPage />} />

              {/* No registration - redirect directly to login */}
              <Route path="/client/register" element={<Navigate to="/" replace />} />

              {/* Protected Client Portal Routes */}
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

              {/* Supervisor Portal Routes (100% Native React) */}
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

              {/* Global Catch-All Redirect to Login */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </SupervisorProvider>
      </AppProvider>
    </AuthProvider>
  );
};

export default App;
