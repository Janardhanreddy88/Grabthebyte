import { cn } from '@/lib/utils';
import { Utensils } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

const iconSizes = {
  sm: 18,
  md: 22,
  lg: 28,
  xl: 40,
};

const textSizes = {
  sm: 'text-[15px]',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-4xl',
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div 
        className={cn(
          'relative flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft',
          sizeClasses[size]
        )}
      >
        <Utensils size={iconSizes[size]} strokeWidth={2} />
        <div 
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full bg-secondary border-2 border-background',
            size === 'sm' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'
          )} 
        />
      </div>
      {showText && (
        <div className="flex items-baseline leading-none">
          <span className={cn('font-display font-semibold text-foreground tracking-tight', textSizes[size])}>
            Grab
          </span>
          <span className={cn('font-display font-bold text-primary tracking-tight', textSizes[size])}>
            TheByte
          </span>
        </div>
      )}
    </div>
  );
}
