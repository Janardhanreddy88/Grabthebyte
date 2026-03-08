import { cn } from '@/lib/utils';
import logoImg from '@/assets/grabthebyte-logo.png';

interface LogoProps { size?: 'sm' | 'md' | 'lg' | 'xl'; showText?: boolean; className?: string; }

const sizeConfig = {
  sm:  { img: 'w-8 h-8',   text: 'text-[13px]' },
  md:  { img: 'w-10 h-10', text: 'text-base' },
  lg:  { img: 'w-14 h-14', text: 'text-xl' },
  xl:  { img: 'w-20 h-20', text: 'text-3xl' },
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const c = sizeConfig[size];
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <img src={logoImg} alt="GrabTheByte" loading="eager" decoding="async" className={cn('rounded-lg object-contain', c.img)} />
      {showText && (
        <div className="flex items-baseline leading-none">
          <span className={cn('font-display font-semibold text-foreground tracking-tight', c.text)}>Grab</span>
          <span className={cn('font-display font-bold text-primary tracking-tight', c.text)}>TheByte</span>
        </div>
      )}
    </div>
  );
}
