import { Suspense, lazy, useEffect, useState } from "react";
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
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from "@/components/SplashScreen";
import { AppPromoPopup } from "@/components/AppPromoPopup";
import { supabase } from "@/integrations/supabase/client";

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
const HelpSupport = lazy(() => import("./pages/HelpSupport"));
const Settings = lazy(() => import("./pages/Settings"));

// Super Admin Pages
const SuperAdminDashboard = lazy(() => import("./pages/super-admin/SuperAdminDashboard").then(m => ({ default: m.SuperAdminDashboard })));
const SuperAdminOrders = lazy(() => import("./pages/super-admin/SuperAdminOrders").then(m => ({ default: m.SuperAdminOrders })));
const Settlements = lazy(() => import("./pages/super-admin/Settlements").then(m => ({ default: m.Settlements })));
const CampusManagement = lazy(() => import("./pages/super-admin/CampusManagement").then(m => ({ default: m.CampusManagement })));
const SuperAdminSettings = lazy(() => import("./pages/super-admin/SuperAdminSettings").then(m => ({ default: m.SuperAdminSettings })));
const UserManagement = lazy(() => import("./pages/super-admin/UserManagement").then(m => ({ default: m.UserManagement })));
const AuditLogs = lazy(() => import("./pages/super-admin/AuditLogs").then(m => ({ default: m.AuditLogs })));
const Analytics = lazy(() => import("./pages/super-admin/Analytics").then(m => ({ default: m.Analytics })));
const Operations = lazy(() => import("./pages/super-admin/Operations").then(m => ({ default: m.Operations })));
const AdminOffers = lazy(() => import("./pages/super-admin/AdminOffers"));
const AdminAds = lazy(() => import("./pages/super-admin/AdminAds"));
const OfferSettlements = lazy(() => import("./pages/super-admin/OfferSettlements").then(m => ({ default: m.OfferSettlements })));
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminLayout";

// ADDED: Revenue Recovery Dashboard
const RecoveryDashboard = lazy(() => import("./pages/RecoveryDashboard"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => <SplashScreen />;

function HardwareBackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: { remove: () => void } | null = null;

    CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (
        location.pathname === '/menu' ||
        location.pathname === '/auth' ||
        location.pathname === '/admin' ||
        location.pathname === '/'
      ) {
        CapacitorApp.exitApp();
      } else if (canGoBack) {
        navigate(-1);
      } else {
        CapacitorApp.exitApp();
      }
    }).then(handle => { listener = handle; });

    return () => { listener?.remove(); };
  }, [location, navigate]);

  return null;
}

const CURRENT_APP_VERSION = '1.0.0';

const VersionGuard = ({ children }: { children: React.ReactNode }) => {
  const [isOutdated, setIsOutdated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function checkVersion() {
      if (!Capacitor.isNativePlatform()) {
        setIsChecking(false);
        return;
      }
      try {
        const platform = Capacitor.getPlatform();
        const { data, error } = await supabase
          .from('app_versions')
          .select('minimum_required_version')
          .eq('platform', platform)
          .single();

        if (error) throw error;

        const isOld = CURRENT_APP_VERSION.localeCompare(
          data.minimum_required_version,
          undefined,
          { numeric: true }
        ) < 0;

        if (isOld) setIsOutdated(true);
      } catch (error) {
        console.error("Version check failed, letting user in:", error);
      } finally {
        setIsChecking(false);
      }
    }
    checkVersion();
  }, []);

  if (isChecking) return <PageLoader />;

  if (isOutdated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center">
        <h1 className="text-3xl font-bold text-destructive mb-4">🚨 Critical Update</h1>
        <p className="text-muted-foreground mb-8 text-lg">
          Your app is out of date! Update GrabTheByte to continue ordering.
        </p>
        <button
          onClick={() => window.open('https://grabthebyte.com/download/app.apk', '_system')}
          className="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform"
        >
          Update Now
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {/* 🛡️ FIX: AuthProvider is now OUTSIDE CampusProvider so that
            useCampusBouncer can safely call useAuth() from within Menu.tsx.
            CampusProvider is inside AuthProvider so campus checks happen
            only after auth is ready. */}
        <AuthProvider>
          <CampusProvider>
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

                          <VersionGuard>
                            <AppPromoPopup />

                            <BrowserRouter>
                              <HardwareBackButtonHandler />

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
                                  <Route path="/support" element={<HelpSupport />} />
                                  <Route path="/settings" element={<CampusGate><Settings /></CampusGate>} />

                                  <Route path="/my-orders" element={<CampusGate><MyOrders /></CampusGate>} />
                                  <Route path="/order/:orderId" element={<CampusGate><OrderDetails /></CampusGate>} />
                                  <Route path="/profile" element={<CampusGate><Profile /></CampusGate>} />

                                  <Route path="/admin" element={<CampusGate><AdminRoute><AdminDashboard /></AdminRoute></CampusGate>} />
                                  <Route path="/kiosk-scanner" element={<CampusGate><KioskRoute><DedicatedScanner /></KioskRoute></CampusGate>} />

                                  {/* ADDED: Revenue Recovery Dashboard */}
                                  <Route path="/recoverydashboard" element={<RecoveryDashboard />} />

                                  {/* Super Admin Routes */}
                                  <Route path="/super-admin" element={<SuperAdminRoute><SuperAdminLayout><SuperAdminDashboard /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/orders" element={<SuperAdminRoute><SuperAdminLayout><SuperAdminOrders /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/settlements" element={<SuperAdminRoute><SuperAdminLayout><Settlements /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/campuses" element={<SuperAdminRoute><SuperAdminLayout><CampusManagement /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/settings" element={<SuperAdminRoute><SuperAdminLayout><SuperAdminSettings /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/users" element={<SuperAdminRoute><SuperAdminLayout><UserManagement /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/audit-logs" element={<SuperAdminRoute><SuperAdminLayout><AuditLogs /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/analytics" element={<SuperAdminRoute><SuperAdminLayout><Analytics /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/operations" element={<SuperAdminRoute><SuperAdminLayout><Operations /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/offers" element={<SuperAdminRoute><SuperAdminLayout><AdminOffers /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/ads" element={<SuperAdminRoute><SuperAdminLayout><AdminAds /></SuperAdminLayout></SuperAdminRoute>} />
                                  <Route path="/super-admin/offer-payouts" element={<SuperAdminRoute><SuperAdminLayout><OfferSettlements /></SuperAdminLayout></SuperAdminRoute>} />

                                  <Route path="*" element={<NotFound />} />
                                </Routes>
                              </Suspense>
                            </BrowserRouter>
                          </VersionGuard>

                        </TooltipProvider>
                      </PrinterProvider>
                    </CartProvider>
                  </OrdersProvider>
                </MenuProvider>
              </SuperAdminProvider>
            </AdminAuthProvider>
          </CampusProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;