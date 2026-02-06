import { Check, Clock, Package, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { OrderStatus } from '@/types/canteen';

interface OrderTimelineProps {
  status: OrderStatus;
}

// Simplified token system - only 3 steps (failed/expired shows as failed state)
const steps = [
  { id: 'pending', label: 'Pending', icon: Clock },
  { id: 'confirmed', label: 'Approved', icon: Check },
  { id: 'collected', label: 'Collected', icon: Package },
];

const statusIndex: Record<string, number> = {
  pending: 0,
  confirmed: 1,
  collected: 2,
  failed: -1, // Special state
  expired: -1, // Special state
};

export function OrderTimeline({ status }: OrderTimelineProps) {
  const isFailed = status === 'failed' || status === 'expired';
  const currentIndex = isFailed ? -1 : (statusIndex[status] ?? 0);

  // For failed/expired orders, show a different UI
  if (isFailed) {
    return (
      <div className="py-4">
        <div className="flex items-center justify-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex flex-col items-center"
          >
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
            <span className="text-sm mt-2 font-medium text-destructive">
              {status === 'expired' ? 'Order Expired' : 'Payment Failed'}
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              {status === 'expired' ? 'Not collected in time' : 'Order failed'}
            </span>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-muted mx-8" />
        <motion.div 
          className="absolute left-0 top-5 h-0.5 bg-primary mx-8"
          initial={{ width: 0 }}
          animate={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />

        {steps.map((step, index) => {
          const isCompleted = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const Icon = step.icon;

          return (
            <motion.div
              key={step.id}
              className="flex flex-col items-center relative z-10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <motion.div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                  isCompleted
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                  isCurrent && 'ring-4 ring-primary/20'
                )}
                animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                transition={{ repeat: isCurrent ? Infinity : 0, duration: 2 }}
              >
                <Icon size={18} />
              </motion.div>
              <span
                className={cn(
                  'text-[10px] mt-2 font-medium text-center',
                  isCompleted ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
