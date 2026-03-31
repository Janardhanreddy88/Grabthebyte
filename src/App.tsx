import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
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


import { Loader2 } from "lucide-react";
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// INSTANT LOAD FOR SPLASH SCREEN
import Index from "./pages/Index"; 

// Lazy loaded pages
const Auth = lazy(() => import("./pages/Auth"));
const SelectCampus = lazy(() => import("./pages/SelectCampus"));
const Menu = lazy(() => import("./pages/Menu"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Payment = lazy(() => import("./pages/Payment"));

const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const DedicatedScanner = lazy(() => import("./pages/DedicatedScanner"));
const MyOrders = lazy(() => import("./pages/MyOrders"));
const Profile = lazy(() => import("./pages/Profile"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/RefundPolicy"));
// 🌟 NEW HELP & SUPPORT PAGE LAZY IMPORT 🌟
const HelpSupport = lazy(() => import("./pages/HelpSupport"));

// Super Admin Pages
const SuperAdminDashboard = lazy(() => import("./pages/super-admin/SuperAdminDashboard").then(m => ({ default: m.SuperAdminDashboard })));
const SuperAdminOrders = lazy(() => import("./pages/super-admin/SuperAdminOrders").then(m => ({ default: m.SuperAdminOrders })));
const Settlements = lazy(() => import("./pages/super-admin/Settlements").then(m => ({ default: m.Settlements })));
const CampusManagement = lazy(() => import("./pages/super-admin/CampusManagement").then(m => ({ default: m.CampusManagement })));
const SuperAdminSettings = lazy(() => import("./pages/super-admin/SuperAdminSettings").then(m => ({ default: m.SuperAdminSettings })));
const UserManagement = lazy(() => import("./pages/super-admin/UserManagement").then(m => ({ default: m.UserManagement })));
const AuditLogs = lazy(() => import("./pages/super-admin/AuditLogs").then(m => ({ default: m.AuditLogs })));
const Analytics = lazy(() => import("./pages/super-admin/Analytics").then(m => ({ default: m.Analytics })));
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

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

// 🌟 THE NATIVE HARDWARE BACK BUTTON CONTROLLER 🌟
function HardwareBackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: { remove: () => void } | null = null;

    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (location.pathname === '/menu' || location.pathname === '/auth' || location.pathname === '/admin' || location.pathname === '/') {
        CapacitorApp.exitApp();
      } else if (canGoBack) {
        navigate(-1);
      } else {
        CapacitorApp.exitApp();
      }
    }).then(handle => { listener = handle; });

    return () => {
      listener?.remove();
    };
  }, [location, navigate]);

  return null; 
}

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
                              <HardwareBackButtonHandler /> 
                              <SessionExpiryHandler warningThresholdMinutes={5} />
                              <Suspense fallback={<PageLoader />}>
                                <Routes>
                                  {/* Public routes */}
                                  <Route path="/" element={<Index />} />
                                  <Route path="/select-campus" element={<SelectCampus />} />
                                  
                                  {/* Campus-gated routes */}
                                  <Route path="/auth" element={<CampusGate><Auth /></CampusGate>} />
                                  <Route path="/menu" element={<CampusGate><Menu /></CampusGate>} />
                                  <Route path="/checkout" element={<CampusGate><Checkout /></CampusGate>} />
                                  <Route path="/payment" element={<CampusGate><Payment /></CampusGate>} />
                                  <Route path="/forgot-password" element={<ForgotPassword />} />
                                  <Route path="/reset-password" element={<ResetPassword />} />
                                  <Route path="/verify-email" element={<VerifyEmail />} />
                                  
                                  {/* Policy & Support Routes */}
                                  <Route path="/terms" element={<TermsAndConditions />} />
                                  <Route path="/privacy" element={<PrivacyPolicy />} />
                                  <Route path="/refund-policy" element={<RefundPolicy />} />
                                  <Route path="/support" element={<HelpSupport />} /> {/* 🌟 ADDED HELP & SUPPORT ROUTE HERE */}
                                  
                                  <Route path="/my-orders" element={<CampusGate><MyOrders /></CampusGate>} />
                                  <Route path="/order/:orderId" element={<CampusGate><OrderDetails /></CampusGate>} />
                                  <Route path="/profile" element={<CampusGate><Profile /></CampusGate>} />
                                  
                                  <Route path="/admin" element={<CampusGate><AdminRoute><AdminDashboard /></AdminRoute></CampusGate>} />
                                  <Route path="/kiosk-scanner" element={<CampusGate><KioskRoute><DedicatedScanner /></KioskRoute></CampusGate>} />
                                  
                                  {/* Super Admin Routes */}
                                  <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/orders" element={<SuperAdminRoute><SuperAdminLayout><SuperAdminOrders /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/settlements" element={<SuperAdminRoute><SuperAdminLayout><Settlements /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/campuses" element={<SuperAdminRoute><SuperAdminLayout><CampusManagement /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/settings" element={<SuperAdminRoute><SuperAdminLayout><SuperAdminSettings /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/users" element={<SuperAdminRoute><SuperAdminLayout><UserManagement /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/audit-logs" element={<SuperAdminRoute><SuperAdminLayout><AuditLogs /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/analytics" element={<SuperAdminRoute><SuperAdminLayout><Analytics /></SuperAdminLayout></SuperAdminRoute>} />
                                  
                                  <Route path="*" element={<NotFound />} />
                                </Routes>
                              </Suspense>
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