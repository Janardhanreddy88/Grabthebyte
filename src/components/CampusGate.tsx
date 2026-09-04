import { ReactNode, useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useCampus } from '@/context/CampusContext';
import { useAuth } from '@/context/AuthContext';

interface CampusGateProps {
  children: ReactNode;
}

export function CampusGate({ children }: CampusGateProps) {
  const { hasCampus, isLoading: isCampusLoading, campus, switchCampus } = useCampus();

  // 🛡️ FIX: Use isInitializing instead of isLoading
  // isLoading is for explicit actions (login button etc.)
  // isInitializing is true only during the very first boot check
  const { user, isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  const isCampusMismatch = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    if (user.role === 'super_admin') return false;
    if (!campus?.id || !user.campusId) return false;
    return campus.id !== user.campusId;
  }, [isAuthenticated, user, campus?.id]);

  const isCampusArchived = useMemo(() => {
    if (!campus) return false;
    return campus.status === 'archived' || campus.is_active === false;
  }, [campus]);

  // 🛡️ FIX: Only handle campus mismatch here
  // Campus archive logout is handled ONLY by useCampusBouncer
  // Removed the logout() call here to prevent double logout race condition
  useEffect(() => {
    if (user?.role === 'super_admin') return;

    if (isCampusMismatch) {
      switchCampus();
    }

    // For archived campus — only clear campus data here
    // useCampusBouncer handles the actual sign out
    if (isCampusArchived) {
      switchCampus();
    }
  }, [isCampusMismatch, isCampusArchived, switchCampus, user?.role]);

  // 🛡️ FIX: Wait for BOTH isInitializing AND campusLoading
  // before making any routing decisions
  if (isInitializing || isCampusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading GrabTheByte...</p>
        </div>
      </div>
    );
  }

  // No campus selected → redirect to selector
  if (!hasCampus) {
    return <Navigate to="/select-campus" state={{ from: location }} replace />;
  }

  // Campus is archived → redirect out (super_admin bypasses)
  if (isCampusArchived && user?.role !== 'super_admin') {
    return <Navigate to="/select-campus" replace />;
  }

  // Campus mismatch → redirect to selector
  if (isCampusMismatch) {
    return <Navigate to="/select-campus" replace />;
  }

  return <>{children}</>;
}