import { cn } from '@/lib/utils';
import logoImg from '@/assets/grabthebyte-logo.png';

interface LogoProps { size?: 'sm' | 'md' | 'lg' | 'xl'; showText?: boolean; className?: string; }

const sizeConfig = {
  sm:  { img: 'w-7 h-7',   text: 'text-[13px]' },
  md:  { img: 'w-9 h-9',   text: 'text-base' },
  lg:  { img: 'w-11 h-11', text: 'text-xl' },
  xl:  { img: 'w-16 h-16', text: 'text-3xl' },
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const c = sizeConfig[size];
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img src={logoImg} alt="GrabTheByte" className={cn('rounded-xl object-contain', c.img)} />
      {showText && (
        <div className="flex items-baseline leading-none">
          <span className={cn('font-display font-semibold text-foreground tracking-tight', c.text)}>Grab</span>
          <span className={cn('font-display font-bold text-primary tracking-tight', c.text)}>TheByte</span>
        </div>
      )}
    </div>
  );
}
