import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCampus } from '@/context/CampusContext';
import { UserRole } from '@/types/canteen';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isInitializing, isAuthenticated } = useAuth();
  const { campus, isLoading: campusLoading } = useCampus();
  const location = useLocation();

  // 🛡️ CRITICAL FIX: Wait for the very first boot check to complete.
  // isInitializing is true only during initial app load — never redirect
  // before we've had a chance to restore the immortal cache.
  // Without this, ProtectedRoute sees isAuthenticated=false for ~200ms
  // and redirects the user to /auth on every app open.
  if (isInitializing || campusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in - redirect to auth
  if (!isAuthenticated || !user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Enforce campus isolation for all non-super-admin users
  if (
    user.role !== 'super_admin' &&
    campus?.id &&
    user.campusId &&
    user.campusId !== campus.id
  ) {
    return <Navigate to="/select-campus" replace />;
  }

  // Check role if required
  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      if (user.role === 'admin') return <Navigate to="/admin" replace />;
      if (user.role === 'kiosk') return <Navigate to="/kiosk-scanner" replace />;
      return <Navigate to="/menu" replace />;
    }
  }

  return <>{children}</>;
}

// ─── Convenience wrappers ────────────────────────────────────────────────────

export function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      {children}
    </ProtectedRoute>
  );
}

export function KioskRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['admin', 'kiosk']}>
      {children}
    </ProtectedRoute>
  );
}

export function StudentRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['student', 'admin']}>
      {children}
    </ProtectedRoute>
  );
}

export function SuperAdminRoute({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['super_admin']}>
      {children}
    </ProtectedRoute>
  );
}