import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, LogIn, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface SessionExpiryHandlerProps {
  warningThresholdMinutes?: number; // Show warning X minutes before expiry
}

export function SessionExpiryHandler({ 
  warningThresholdMinutes = 5 
}: SessionExpiryHandlerProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSessionExpired = useCallback(() => {
    setShowWarning(false);
    setShowExpired(true);
  }, []);

  const handleRefreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      
      if (data.session) {
        setShowWarning(false);
        setTimeRemaining(null);
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
      handleSessionExpired();
    }
  }, [handleSessionExpired]);

  const handleLoginRedirect = useCallback(() => {
    setShowExpired(false);
    navigate('/auth', { state: { from: location.pathname } });
  }, [navigate, location.pathname]);

  const dismissWarning = () => {
    setShowWarning(false);
  };

  useEffect(() => {
    let warningTimer: ReturnType<typeof setTimeout>;
    let expiryTimer: ReturnType<typeof setTimeout>;
    let countdownTimer: ReturnType<typeof setInterval>;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const expiresAt = session.expires_at;
      if (!expiresAt) return;

      const expiryTime = expiresAt * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiryTime - now;
      const warningTime = warningThresholdMinutes * 60 * 1000;

      // Clear existing timers
      clearTimeout(warningTimer);
      clearTimeout(expiryTimer);
      clearInterval(countdownTimer);

      if (timeUntilExpiry <= 0) {
        // Already expired
        handleSessionExpired();
      } else if (timeUntilExpiry <= warningTime) {
        // Within warning threshold
        setShowWarning(true);
        setTimeRemaining(Math.floor(timeUntilExpiry / 1000));
        
        // Countdown timer
        countdownTimer = setInterval(() => {
          setTimeRemaining(prev => {
            if (prev === null || prev <= 1) {
              clearInterval(countdownTimer);
              handleSessionExpired();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        // Set warning timer
        warningTimer = setTimeout(() => {
          setShowWarning(true);
          setTimeRemaining(warningThresholdMinutes * 60);
          
          countdownTimer = setInterval(() => {
            setTimeRemaining(prev => {
              if (prev === null || prev <= 1) {
                clearInterval(countdownTimer);
                handleSessionExpired();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }, timeUntilExpiry - warningTime);

        // Set expiry timer
        expiryTimer = setTimeout(handleSessionExpired, timeUntilExpiry);
      }
    };

    checkSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        setShowWarning(false);
        setShowExpired(false);
        setTimeRemaining(null);
        checkSession();
      } else if (event === 'SIGNED_OUT') {
        setShowWarning(false);
        setShowExpired(false);
      }
    });

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(expiryTimer);
      clearInterval(countdownTimer);
      subscription.unsubscribe();
    };
  }, [warningThresholdMinutes, handleSessionExpired]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Session Expiring Warning Banner */}
      <AnimatePresence>
        {showWarning && timeRemaining !== null && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[99] bg-canteen-warning text-canteen-dark px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
              <div className="flex items-center gap-2">
                <Clock size={18} />
                <span className="text-sm font-medium">
                  Session expires in {formatTime(timeRemaining)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleRefreshSession}
                  className="h-7 px-3 text-xs bg-canteen-dark text-canteen-warning hover:bg-canteen-dark/90"
                >
                  Extend
                </Button>
                <button
                  onClick={dismissWarning}
                  className="p-1 hover:bg-canteen-dark/10 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session Expired Modal */}
      <AnimatePresence>
        {showExpired && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full text-center shadow-elevated"
            >
              <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock size={24} className="text-muted-foreground" />
              </div>
              
              <h2 className="text-xl font-bold mb-2">Session Expired</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Your session has expired for security reasons. Please log in again to continue.
              </p>
              
              <Button onClick={handleLoginRedirect} className="w-full gap-2">
                <LogIn size={16} />
                Log In Again
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
