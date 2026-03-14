import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action, children }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-5">
        <Icon className="w-9 h-9 text-muted-foreground" />
      </div>
      <h2 className="font-display font-bold text-xl text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs leading-relaxed">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="rounded-2xl px-6 font-bold text-sm">
          {action.label}
        </Button>
      )}
      {children}
    </motion.div>
  );
}
