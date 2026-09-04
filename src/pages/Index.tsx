import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SplashScreen } from '@/components/SplashScreen';
import { useCampus } from '@/context/CampusContext';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const navigate = useNavigate();
  const { hasCampus, isLoading: isCampusLoading } = useCampus();
  const { user, isAuthenticated, isInitializing } = useAuth();

  useEffect(() => {
    // 🛡️ FIX: Wait for BOTH auth AND campus to finish initializing
    // isInitializing = true until the very first boot check completes
    // Without this, we redirect before the real role is fetched
    if (isInitializing || isCampusLoading) return;

    // No campus selected yet → go to campus selection
    if (!hasCampus) {
      navigate('/select-campus', { replace: true });
      return;
    }

    // Campus exists but not logged in → go to auth
    if (!isAuthenticated || !user) {
      navigate('/auth', { replace: true });
      return;
    }

    // ✅ Role-based routing — runs only after real role is confirmed
    if (user.role === 'super_admin') {
      navigate('/super-admin', { replace: true });
    } else if (user.role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (user.role === 'kiosk') {
      navigate('/kiosk-scanner', { replace: true });
    } else {
      navigate('/menu', { replace: true });
    }
  }, [isInitializing, isCampusLoading, isAuthenticated, user, hasCampus, navigate]);

  // Show splash screen while waiting for auth + campus to initialize
  return <SplashScreen />;
}