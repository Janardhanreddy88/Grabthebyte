import { useNavigate } from 'react-router-dom';
import { SplashScreen } from '@/components/SplashScreen';
import { useCampus } from '@/context/CampusContext';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';

export default function Index() {
  const navigate = useNavigate();
  const { hasCampus } = useCampus();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth(); // 🚀 Added isAuthLoading
  const [splashFinished, setSplashFinished] = useState(false);

  // 🧠 THE SMART SYNC: Wait for BOTH the animation AND the Auth data
  useEffect(() => {
    if (splashFinished && !isAuthLoading) {
      if (!hasCampus) {
        navigate('/select-campus');
      } else if (isAuthenticated) {
        navigate('/menu');
      } else {
        navigate('/auth');
      }
    }
  }, [splashFinished, isAuthLoading, isAuthenticated, hasCampus, navigate]);

  const handleComplete = () => {
    setSplashFinished(true); // Animation is done, now we wait for Auth to be ready
  };

  return <SplashScreen onComplete={handleComplete} />;
}