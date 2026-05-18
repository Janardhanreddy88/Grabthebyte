import { motion } from "framer-motion";
import logoImg from "@/assets/grabthebyte-logo.png";

export function SplashScreen() {
  // 🦅 NO TIMERS. NO PHASES. 
  // It stays mounted and animates the dots until App.tsx unmounts it!

  return (
    <motion.div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background" 
      exit={{ opacity: 0 }} 
      transition={{ duration: 0.4 }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/4 -right-1/4 w-[400px] h-[400px] rounded-full bg-primary/[0.03] blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[350px] h-[350px] rounded-full bg-secondary/[0.03] blur-3xl" />
      </div>
      
      <div className="relative flex flex-col items-center gap-4">
        
        {/* 🦅 STIFF LOGO: No zoom animation. It loads instantly and stays perfectly solid. */}
        <div className="relative">
          <img 
            src={logoImg} 
            alt="GrabTheByte" 
            loading="eager" 
            decoding="async" 
            className="w-20 h-20 rounded-xl object-cover" 
            style={{ boxShadow: "0 4px 16px -4px hsl(0 85% 50% / 0.3)" }} 
          />
          <div 
            className="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-secondary rounded-lg border-2 border-background" 
            style={{ width: 18, height: 18 }} 
          />
        </div>
        
        {/* 🦅 STIFF BRAND TEXT: Loads instantly, completely solid. No fading in. */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-baseline">
            <span className="font-display text-xl font-semibold text-foreground tracking-tight">Grab</span>
            <span className="font-display text-xl font-bold text-primary tracking-tight">TheByte</span>
          </div>
          <span className="text-xs text-muted-foreground">Beat the crowd. Grab the byte.</span>
        </div>
        
        {/* 🦅 THE CONTINUOUS 3-DOT BOUNCE: The only thing moving on the screen! */}
        <div className="flex gap-1.5 h-4 items-center mt-2">
          <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 rounded-full bg-primary/70 animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce"></div>
        </div>

      </div>
    </motion.div>
  );
}