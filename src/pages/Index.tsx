import { useNavigate } from 'react-router-dom';
import { SplashScreen } from '@/components/SplashScreen';
import { useCampus } from '@/context/CampusContext';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';

export default function Index() {
  const navigate = useNavigate();
  const { hasCampus } = useCampus();
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [splashFinished, setSplashFinished] = useState(false);

  useEffect(() => {
    if (splashFinished && !isAuthLoading) {
      if (!hasCampus) {
        navigate('/select-campus');
      } else if (isAuthenticated && user) {
        // Route based on role
        if (user.role === 'admin') {
          navigate('/admin');
        } else if (user.role === 'kiosk') {
          navigate('/kiosk-scanner');
        } else if (user.role === 'super_admin') {
          navigate('/super-admin');
        } else {
          navigate('/menu');
        }
      } else {
        navigate('/auth');
      }
    }
  }, [splashFinished, isAuthLoading, isAuthenticated, user, hasCampus, navigate]);

  const handleComplete = () => {
    setSplashFinished(true);
  };

  return <SplashScreen onComplete={handleComplete} />;
}