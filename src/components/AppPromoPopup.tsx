import { useState, useEffect } from 'react';
import { X, Smartphone, Download, CheckCircle2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

export function AppPromoPopup() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 1. If they are already INSIDE the native app, kill this immediately.
    if (Capacitor.isNativePlatform()) return;

    // 2. Are they on an Android phone? (Regex checks the browser's User-Agent)
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isAndroid = /android/i.test(userAgent.toLowerCase());

    // 3. Smart Memory Checks
    // 'app_installed' is permanent (they downloaded it or already have it)
    const isInstalled = localStorage.getItem('grabthebyte_app_installed') === 'true';
    
    // 'session_dismissed' only lasts until they close the browser tab
    const sessionDismissed = sessionStorage.getItem('grabthebyte_promo_dismissed') === 'true';

    // 4. The Logic: Android + Not Installed + Not dismissed this session
    if (isAndroid && !isInstalled && !sessionDismissed) {
      // 2.5-second delay. We wait for the page to load so we don't jump scare them!
      const timer = setTimeout(() => setShow(true), 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismissSession = () => {
    // Hides it for now, but will show again next time they visit the website
    sessionStorage.setItem('grabthebyte_promo_dismissed', 'true');
    setShow(false);
  };

  const handleDownload = () => {
    // They clicked download! Mark as installed permanently so we never annoy them again.
    localStorage.setItem('grabthebyte_app_installed', 'true');
    setShow(false);
    
    // Trigger the actual APK download
    window.open('/download/app.apk', '_blank'); 
  };

  const handleAlreadyInstalled = () => {
    // They already have it! Mark as installed permanently.
    localStorage.setItem('grabthebyte_app_installed', 'true');
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        // Fixed at the bottom, doesn't block the whole screen
        <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 pointer-events-none flex justify-center">
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl rounded-3xl p-4 relative pointer-events-auto"
          >
            {/* Soft Close Button */}
            <button 
              onClick={handleDismissSession}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>

            <div className="flex gap-4 items-center">
              {/* App Icon Box */}
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center shrink-0 text-primary border border-primary/20">
                <Smartphone size={28} />
              </div>

              {/* Text Content */}
              <div className="flex-1 pr-4">
                <h3 className="font-display font-bold text-base text-foreground leading-tight">
                  GrabTheByte App is Live
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Faster ordering, instant notifications. Skip the browser next time!
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex flex-col gap-2">
              <Button 
                onClick={handleDownload} 
                className="w-full rounded-xl font-bold shadow-md btn-glow" 
                size="sm"
              >
                <Download size={16} className="mr-2" /> Download APK (12MB)
              </Button>
              
              <button 
                onClick={handleAlreadyInstalled} 
                className="text-xs text-muted-foreground hover:text-foreground font-medium py-1 transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={12} /> I already have the app installed
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}