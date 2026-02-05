import { ReactNode, useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCampus } from '@/context/CampusContext';
import { useAuth } from '@/context/AuthContext';

interface CampusGateProps {
  children: ReactNode;
}

/**
 * CampusGate ensures a campus is selected before allowing access to protected routes.
 * If no campus is selected, redirects to /select-campus.
 */
export function CampusGate({ children }: CampusGateProps) {
  const { hasCampus, isLoading, campus, clearCampus } = useCampus();
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();

  const isCampusMismatch = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    if (user.role === 'super_admin') return false;
    if (!campus?.id || !user.campusId) return false;
    return campus.id !== user.campusId;
  }, [isAuthenticated, user, campus?.id]);

  // If someone selects a different campus after logging in, force them back to campus selection.
  useEffect(() => {
    if (!isCampusMismatch) return;
    clearCampus();
  }, [isCampusMismatch, clearCampus]);

  // Show loading while checking campus
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading campus...</p>
        </div>
      </div>
    );
  }

  // No campus selected - redirect to selector
  if (!hasCampus) {
    return <Navigate to="/select-campus" state={{ from: location }} replace />;
  }

  // Campus mismatch - redirect to selector
  if (isCampusMismatch) {
    return <Navigate to="/select-campus" replace />;
  }

  // Campus is set - render children
  return <>{children}</>;
}
