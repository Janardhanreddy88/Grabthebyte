import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SplashScreen } from '@/components/SplashScreen';
import { useCampus } from '@/context/CampusContext';
import { useAuth } from '@/context/AuthContext';

export default function Index() {
  const navigate = useNavigate();
  const { hasCampus } = useCampus();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    // 🦅 1. The Gatekeeper: Wait for Auth/Supabase to finish checking
    if (isAuthLoading) return;

    // 🦅 2. Instant Routing: Teleport the user the second checking is done
    if (!hasCampus) {
      navigate('/select-campus', { replace: true });
    } else if (isAuthenticated && user) {
      // Route based on exact role
      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (user.role === 'kiosk') {
        navigate('/kiosk-scanner', { replace: true });
      } else if (user.role === 'super_admin') {
        navigate('/super-admin', { replace: true });
      } else {
        navigate('/menu', { replace: true });
      }
    } else {
      navigate('/auth', { replace: true });
    }
  }, [isAuthLoading, isAuthenticated, user, hasCampus, navigate]);

  // 🦅 3. The Visuals: Render the smart Splash Screen while the useEffect waits!
  return <SplashScreen />;
}