import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OfflineDetector() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        // Show "back online" message briefly
        setShowBanner(true);
        setTimeout(() => setShowBanner(false), 3000);
      }
      setWasOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setIsOnline(false);
      setShowBanner(true);
      setWasOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`fixed top-0 left-0 right-0 z-[100] px-4 ${
            isOnline 
              ? 'bg-secondary text-secondary-foreground' 
              : 'bg-destructive text-destructive-foreground'
          }`}
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingBottom: '12px' }}
        >
          <div className="flex items-center justify-center gap-3 max-w-lg mx-auto">
            {isOnline ? (
              <>
                <Wifi size={18} />
                <span className="text-sm font-medium">Back online</span>
              </>
            ) : (
              <>
                <WifiOff size={18} />
                <span className="text-sm font-medium">You're offline</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRetry}
                  className="ml-2 h-7 px-2 text-xs bg-background/20 hover:bg-background/30 text-current"
                >
                  <RefreshCw size={12} className="mr-1" />
                  Retry
                </Button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
