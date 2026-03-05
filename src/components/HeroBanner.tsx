import { Clock, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import heroBannerImg from '@/assets/hero-banner.jpg';

export function HeroBanner() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-xl mb-4">
      <div className="absolute inset-0">
        <img src={heroBannerImg} alt="Fresh campus food" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-foreground/90 via-foreground/60 to-foreground/20" />
      </div>
      <div className="relative z-10 p-4 md:p-5">
        <div className="flex items-center gap-2 mb-2">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
            <Clock size={10} />
            <span className="text-[9px] font-bold uppercase tracking-wider">Open Now</span>
          </motion.div>
        </div>
        <h2 className="font-display text-lg md:text-xl font-bold text-background mb-1 tracking-tight">Fresh, Fast & Delicious</h2>
        <p className="text-xs text-background/80 max-w-xs leading-relaxed flex items-center gap-1">
          <Sparkles size={12} className="text-canteen-warning" />Made with love, served with a smile
        </p>
      </div>
    </motion.div>
  );
}