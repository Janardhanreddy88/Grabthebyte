import { useState, useRef, useCallback, ReactNode } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
}

const THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({ onRefresh, children, className = '' }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const y = useMotionValue(0);

  const rotate = useTransform(y, [0, THRESHOLD], [0, 360]);
  const opacity = useTransform(y, [0, 40, THRESHOLD], [0, 0.5, 1]);
  const scale = useTransform(y, [0, THRESHOLD], [0.5, 1]);

  const isScrolledToTop = () => {
    if (!containerRef.current) return true;
    // Check if the scrollable parent is at top
    let el: HTMLElement | null = containerRef.current;
    while (el) {
      if (el.scrollTop > 0) return false;
      el = el.parentElement;
    }
    return true;
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    if (isScrolledToTop()) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = Math.max(0, currentY - startY.current);
    
    if (diff > 0 && isScrolledToTop()) {
      const dampened = Math.min(MAX_PULL, diff * 0.5);
      y.set(dampened);
    }
  }, [isRefreshing, y]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || isRefreshing) return;
    pulling.current = false;

    if (y.get() >= THRESHOLD) {
      setIsRefreshing(true);
      animate(y, 60, { duration: 0.2 });
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
      }
    } else {
      animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
    }
  }, [isRefreshing, onRefresh, y]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <motion.div
        style={{ opacity, y: useTransform(y, (v) => v - 40) }}
        className="absolute left-1/2 -translate-x-1/2 z-50 flex items-center justify-center"
      >
        <motion.div
          style={{ scale, rotate: isRefreshing ? undefined : rotate }}
          className="w-9 h-9 rounded-full bg-card border border-border shadow-lg flex items-center justify-center"
        >
          <RefreshCw
            size={16}
            className={`text-primary ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </motion.div>
      </motion.div>

      <motion.div style={{ y: useTransform(y, (v) => v * 0.3) }}>
        {children}
      </motion.div>
    </div>
  );
}
