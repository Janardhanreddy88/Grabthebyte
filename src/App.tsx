import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import { PrinterProvider } from "@/context/PrinterContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SuperAdminProvider } from "@/context/SuperAdminContext";

import { MenuProvider } from "@/context/MenuContext";
import { OrdersProvider } from "@/context/OrdersContext";
import { CampusProvider } from "@/context/CampusContext";
import { ProtectedRoute, AdminRoute, KioskRoute, SuperAdminRoute } from "@/components/ProtectedRoute";
import { CampusGate } from "@/components/CampusGate";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineDetector } from "@/components/OfflineDetector";
import { SessionExpiryHandler } from "@/components/SessionExpiryHandler";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import SelectCampus from "./pages/SelectCampus";
import Menu from "./pages/Menu";
import Checkout from "./pages/Checkout";
import Payment from "./pages/Payment";
import OrderSuccess from "./pages/OrderSuccess";
import AdminDashboard from "./pages/AdminDashboard";
import DedicatedScanner from "./pages/DedicatedScanner";
import MyOrders from "./pages/MyOrders";
import Profile from "./pages/Profile";
import OrderDetails from "./pages/OrderDetails";
import NotFound from "./pages/NotFound";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import TermsAndConditions from "./pages/TermsAndConditions";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import RefundPolicy from "./pages/RefundPolicy";
import Support from "./pages/Support"; // <--- IMPORT ADDED HERE

// Super Admin Pages
import { SuperAdminDashboard } from "./pages/super-admin/SuperAdminDashboard";
import { PaymentVerification } from "./pages/super-admin/PaymentVerification";
import { SuperAdminOrders } from "./pages/super-admin/SuperAdminOrders";
import { Settlements } from "./pages/super-admin/Settlements";
import { CampusManagement } from "./pages/super-admin/CampusManagement";
import { SuperAdminSettings } from "./pages/super-admin/SuperAdminSettings";
import { SupportTickets } from "./pages/super-admin/SupportTickets";
import { UserManagement } from "./pages/super-admin/UserManagement";
import { AuditLogs } from "./pages/super-admin/AuditLogs";
import { Analytics } from "./pages/super-admin/Analytics";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminLayout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <CampusProvider>
          <AuthProvider>
            <AdminAuthProvider>
              <SuperAdminProvider>
                <MenuProvider>
                  <OrdersProvider>
                    <CartProvider>
                        <PrinterProvider>
                          <TooltipProvider>
                            <Toaster />
                            <Sonner />
                            <OfflineDetector />
                            <BrowserRouter>
                              <SessionExpiryHandler warningThresholdMinutes={5} />
                              <Routes>
                                {/* Public routes */}
                                <Route path="/" element={<Index />} />
                                <Route path="/select-campus" element={<SelectCampus />} />
                                
                                {/* Campus-gated routes */}
                                <Route path="/auth" element={
                                  <CampusGate>
                                    <Auth />
                                  </CampusGate>
                                } />
                                <Route path="/menu" element={
                                  <CampusGate>
                                    <Menu />
                                  </CampusGate>
                                } />
                                <Route path="/checkout" element={
                                  <CampusGate>
                                    <Checkout />
                                  </CampusGate>
                                } />
                                <Route path="/payment" element={
                                  <CampusGate>
                                    <Payment />
                                  </CampusGate>
                                } />
                                <Route path="/order-success" element={
                                  <CampusGate>
                                    <OrderSuccess />
                                  </CampusGate>
                                } />
                                <Route path="/forgot-password" element={<ForgotPassword />} />
                                <Route path="/reset-password" element={<ResetPassword />} />
                                <Route path="/verify-email" element={<VerifyEmail />} />
                                
                                {/* Policy & Support Routes */}
                                <Route path="/terms" element={<TermsAndConditions />} />
                                <Route path="/privacy" element={<PrivacyPolicy />} />
                                <Route path="/refund-policy" element={<RefundPolicy />} />
                                <Route path="/support" element={<Support />} /> {/* <--- ROUTE ADDED HERE */}
                                
                                <Route path="/my-orders" element={
                                  <CampusGate>
                                    <MyOrders />
                                  </CampusGate>
                                } />
                                <Route path="/order/:orderId" element={
                                  <CampusGate>
                                    <OrderDetails />
                                  </CampusGate>
                                } />
                                <Route path="/profile" element={
                                  <CampusGate>
                                    <Profile />
                                  </CampusGate>
                                } />
                                <Route 
                                  path="/admin" 
                                  element={
                                    <CampusGate>
                                      <AdminRoute>
                                        <AdminDashboard />
                                      </AdminRoute>
                                    </CampusGate>
                                  } 
                                />
                                <Route 
                                  path="/kiosk-scanner" 
                                  element={
                                    <CampusGate>
                                      <KioskRoute>
                                        <DedicatedScanner />
                                      </KioskRoute>
                                    </CampusGate>
                                  } 
                                />
                                
                                {/* Super Admin Routes */}
                                <Route 
                                  path="/super-admin" 
                                  element={
                                    <SuperAdminRoute>
                                      <SuperAdminLayout>
                                        <SuperAdminDashboard />
                                      </SuperAdminLayout>
                                    </SuperAdminRoute>
                                  } 
                                />
                                <Route 
                                  path="/super-admin/verification" 
                                  element={
                                    <SuperAdminRoute>
                                      <SuperAdminLayout>
                                        <PaymentVerification />
                                      </SuperAdminLayout>
                                    </SuperAdminRoute>
                                  } 
                                />
                                <Route 
                                  path="/super-admin/orders" 
                                  element={
                                    <SuperAdminRoute>
                                      <SuperAdminLayout>
                                        <SuperAdminOrders />
                                      </SuperAdminLayout>
                                    </SuperAdminRoute>
                                  } 
                                />
                                <Route 
                                  path="/super-admin/settlements" 
                                  element={
                                    <SuperAdminRoute>
                                      <SuperAdminLayout>
                                        <Settlements />
                                      </SuperAdminLayout>
                                    </SuperAdminRoute>
                                  } 
                                />
                                <Route 
                                  path="/super-admin/campuses" 
                                  element={
                                    <SuperAdminRoute>
                                      <SuperAdminLayout>
                                        <CampusManagement />
                                      </SuperAdminLayout>
                                    </SuperAdminRoute>
                                  } 
                                />
                                <Route 
                                  path="/super-admin/settings" 
                                  element={
                                    <SuperAdminRoute>
                                      <SuperAdminLayout>
                                        <SuperAdminSettings />
                                      </SuperAdminLayout>
                                    </SuperAdminRoute>
                                  } 
                                />
                                <Route 
                                  path="/super-admin/support" 
                                  element={
                                    <SuperAdminRoute>
                                      <SuperAdminLayout>
                                        <SupportTickets />
                                      </SuperAdminLayout>
                                    </SuperAdminRoute>
                                  } 
                                />
                                <Route 
                                  path="/super-admin/users" 
                                  element={
                                    <SuperAdminRoute>
                                      <SuperAdminLayout>
                                        <UserManagement />
                                      </SuperAdminLayout>
                                    </SuperAdminRoute>
                                  } 
                                />
                                <Route 
                                  path="/super-admin/audit-logs" 
                                  element={
                                    <SuperAdminRoute>
                                      <SuperAdminLayout>
                                        <AuditLogs />
                                      </SuperAdminLayout>
                                    </SuperAdminRoute>
                                  } 
                                />
                                <Route 
                                  path="/super-admin/analytics" 
                                  element={
                                    <SuperAdminRoute>
                                      <SuperAdminLayout>
                                        <Analytics />
                                      </SuperAdminLayout>
                                    </SuperAdminRoute>
                                  } 
                                />
                                
                                <Route path="*" element={<NotFound />} />
                              </Routes>
                            </BrowserRouter>
                          </TooltipProvider>
                        </PrinterProvider>
                    </CartProvider>
                  </OrdersProvider>
                </MenuProvider>
              </SuperAdminProvider>
            </AdminAuthProvider>
          </AuthProvider>
        </CampusProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;