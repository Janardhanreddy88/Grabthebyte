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
 * If no campus is selected, or if the campus is archived, it boots the user.
 */
export function CampusGate({ children }: CampusGateProps) {
  const { hasCampus, isLoading: isCampusLoading, campus, switchCampus } = useCampus();
  
  // 🚀 UPDATED: Pulled in `logout` so we can destroy the session if they get booted
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  const location = useLocation();

  const isCampusMismatch = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    if (user.role === 'super_admin') return false;
    if (!campus?.id || !user.campusId) return false;
    return campus.id !== user.campusId;
  }, [isAuthenticated, user, campus?.id]);

  // 🛡️ THE TRAPDOOR: Check if the campus has been shut down
  const isCampusArchived = useMemo(() => {
    if (!campus) return false;
    // If it's archived OR marked inactive, it triggers the trapdoor
    return campus.status === 'archived' || campus.is_active === false;
  }, [campus]);

  // 💥 THE KICKER: Boot them out if there is a mismatch OR the campus is archived
  useEffect(() => {
    // Super admins are immune to getting kicked out
    if (user?.role === 'super_admin') return;

    if (isCampusMismatch) {
      switchCampus();
    }

    // If the campus is archived, clear the campus AND log them out instantly
    if (isCampusArchived) {
      switchCampus(); 
      if (logout) {
        logout();
      }
    }
  }, [isCampusMismatch, isCampusArchived, switchCampus, logout, user?.role]);

  // Show loading while checking BOTH campus AND auth status
  if (isCampusLoading || isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Loading GrabTheByte...</p>
        </div>
      </div>
    );
  }

  // No campus selected - redirect to selector
  if (!hasCampus) {
    return <Navigate to="/select-campus" state={{ from: location }} replace />;
  }

  // 🛑 BLOCKED: If the campus is archived, redirect them out (Admins bypass this)
  if (isCampusArchived && user?.role !== 'super_admin') {
    return <Navigate to="/select-campus" replace />;
  }

  // Campus mismatch - redirect to selector (user's account belongs elsewhere)
  if (isCampusMismatch) {
    return <Navigate to="/select-campus" replace />;
  }

  // Campus is set, active, and user is verified - render children!
  return <>{children}</>;
}