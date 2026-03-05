import { Clock } from 'lucide-react';
import { TimePeriod } from '@/types/canteen';
import { motion } from 'framer-motion';

interface TimePeriodBannerProps {
  period: TimePeriod;
}

export function TimePeriodBanner({ period }: TimePeriodBannerProps) {
  const formatTime = (hour: number, minute: number) => {
    const h = hour % 12 || 12;
    const m = minute.toString().padStart(2, '0');
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h}:${m} ${ampm}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 px-4 py-4 rounded-2xl bg-accent/50 mb-5 border border-primary/10"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="text-3xl">{period.icon}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-primary">
          <Clock className="w-4 h-4" />
          <span className="font-bold text-sm">{period.name} Time</span>
        </div>
        <p className="text-foreground font-semibold text-sm mt-0.5">
          Showing items available now
        </p>
        <p className="text-muted-foreground text-xs mt-0.5">
          {formatTime(period.startHour, period.startMinute)} – {formatTime(period.endHour, period.endMinute)}
        </p>
      </div>
    </motion.div>
  );
}