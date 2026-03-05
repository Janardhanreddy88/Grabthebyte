import { cn } from '@/lib/utils';
import { Utensils } from 'lucide-react';

interface LogoProps { size?: 'sm' | 'md' | 'lg' | 'xl'; showText?: boolean; className?: string; }

const sizeConfig = {
  sm:  { box: 'w-7 h-7',   icon: 14, dot: 'w-2 h-2',     text: 'text-[13px]', radius: 'rounded-lg' },
  md:  { box: 'w-9 h-9',   icon: 18, dot: 'w-2.5 h-2.5', text: 'text-base',   radius: 'rounded-xl' },
  lg:  { box: 'w-11 h-11', icon: 22, dot: 'w-3 h-3',     text: 'text-xl',     radius: 'rounded-xl' },
  xl:  { box: 'w-16 h-16', icon: 32, dot: 'w-4 h-4',     text: 'text-3xl',    radius: 'rounded-2xl' },
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const c = sizeConfig[size];
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative">
        <div className={cn('relative flex items-center justify-center bg-primary text-primary-foreground', c.box, c.radius)}
          style={{ boxShadow: '0 3px 10px -2px hsl(24 95% 53% / 0.3)' }}>
          <Utensils size={c.icon} strokeWidth={2} />
        </div>
        <div className={cn('absolute -bottom-0.5 -right-0.5 rounded-md bg-secondary border-2 border-background', c.dot)} />
      </div>
      {showText && (
        <div className="flex items-baseline leading-none">
          <span className={cn('font-display font-semibold text-foreground tracking-tight', c.text)}>Grab</span>
          <span className={cn('font-display font-bold text-primary tracking-tight', c.text)}>TheByte</span>
        </div>
      )}
    </div>
  );
}