import { cn } from '@/lib/utils';
import { Utensils } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizeConfig = {
  sm:  { box: 'w-9 h-9',   icon: 18, dot: 'w-2.5 h-2.5', text: 'text-[15px]', radius: 'rounded-xl' },
  md:  { box: 'w-11 h-11', icon: 22, dot: 'w-3 h-3',     text: 'text-lg',     radius: 'rounded-xl' },
  lg:  { box: 'w-14 h-14', icon: 28, dot: 'w-4 h-4',     text: 'text-2xl',    radius: 'rounded-2xl' },
  xl:  { box: 'w-20 h-20', icon: 40, dot: 'w-5 h-5',     text: 'text-4xl',    radius: 'rounded-3xl' },
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const c = sizeConfig[size];

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative">
        <div
          className={cn(
            'relative flex items-center justify-center bg-primary text-primary-foreground',
            c.box, c.radius,
          )}
          style={{ boxShadow: '0 4px 14px -3px hsl(24 95% 53% / 0.35)' }}
        >
          <Utensils size={c.icon} strokeWidth={2} />
        </div>
        <div
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-lg bg-secondary border-2 border-background',
            c.dot,
          )}
        />
      </div>
      {showText && (
        <div className="flex items-baseline leading-none">
          <span className={cn('font-display font-semibold text-foreground tracking-tight', c.text)}>
            Grab
          </span>
          <span className={cn('font-display font-bold text-primary tracking-tight', c.text)}>
            TheByte
          </span>
        </div>
      )}
    </div>
  );
}