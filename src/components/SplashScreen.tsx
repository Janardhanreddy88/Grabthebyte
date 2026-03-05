import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Utensils } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "brand" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("brand"), 300);
    const t2 = setTimeout(() => setPhase("exit"), 1400);
    const t3 = setTimeout(onComplete, 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== "exit" && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Gradient orbs */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-3xl" />
            <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] rounded-full bg-secondary/[0.04] blur-3xl" />
          </div>

          <div className="relative flex flex-col items-center gap-6">
            {/* Animated Logo Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              className="relative"
            >
              <div
                className="flex items-center justify-center w-24 h-24 rounded-3xl bg-primary text-primary-foreground"
                style={{ boxShadow: "0 12px 40px -8px hsl(24 95% 53% / 0.45)" }}
              >
                <Utensils size={44} strokeWidth={1.8} />
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 300 }}
                className="absolute -bottom-1.5 -right-1.5 w-6 h-6 bg-secondary rounded-xl border-[3px] border-background"
              />
            </motion.div>

            {/* Brand Name */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={phase === "brand" ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col items-center gap-1"
            >
              <div className="flex items-baseline">
                <span className="font-display text-3xl font-semibold text-foreground tracking-tight">
                  Grab
                </span>
                <span className="font-display text-3xl font-bold text-primary tracking-tight">
                  TheByte
                </span>
              </div>
              <span className="text-sm text-muted-foreground font-medium">
                Order ahead, skip the queue
              </span>
            </motion.div>

            {/* Loading indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex gap-1"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-primary/40"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}