import { cn } from '@/lib/utils';
import { categories } from '@/data/menuData';
import { User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';

import categoryAll from '@/assets/category-all.png';
import categoryBreakfast from '@/assets/category-breakfast.png';
import categoryLunch from '@/assets/category-lunch.png';
import categorySnacks from '@/assets/category-snacks.png';

interface CategorySidebarProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onProfileClick?: () => void;
}

const categoryImages: Record<string, string> = {
  all: categoryAll,
  breakfast: categoryBreakfast,
  lunch: categoryLunch,
  snacks: categorySnacks,
};

export function CategorySidebar({ selectedCategory, onSelectCategory, onProfileClick }: CategorySidebarProps) {
  return (
    <aside className="relative flex flex-col w-[64px] lg:w-[72px] bg-card border-r border-border h-full">
      <ScrollArea className="flex-1 py-2">
        <div className="flex flex-col gap-0.5 px-1">
          {categories.map((category) => {
            const isActive = selectedCategory === category.id;
            return (
              <motion.button key={category.id} whileTap={{ scale: 0.92 }} onClick={() => onSelectCategory(category.id)}
                className={cn('relative flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all duration-200',
                  isActive ? 'bg-primary/8' : 'hover:bg-muted/60')}>
                <div className={cn('w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center transition-all duration-200 overflow-hidden',
                  isActive ? 'ring-2 ring-primary shadow-sm' : 'bg-muted/50')}
                  style={isActive ? { boxShadow: '0 3px 10px -2px hsl(24 95% 53% / 0.3)' } : {}}>
                  <img src={categoryImages[category.id] || categoryAll} alt={category.name} className="w-full h-full object-cover" />
                </div>
                <span className={cn('text-[9px] font-semibold text-center leading-tight max-w-full px-0.5',
                  isActive ? 'text-primary' : 'text-muted-foreground')}>{category.name}</span>
                {isActive && <motion.div layoutId="category-active" className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-6 bg-primary rounded-r-full" transition={{ type: "spring", stiffness: 500, damping: 30 }} />}
              </motion.button>
            );
          })}
        </div>
      </ScrollArea>
      {onProfileClick && (
        <div className="flex-shrink-0 p-1.5 border-t border-border">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onProfileClick}
            className="w-full flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-muted/60 transition-colors">
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-accent flex items-center justify-center text-accent-foreground"><User size={18} /></div>
            <span className="text-[9px] font-semibold text-muted-foreground">Profile</span>
          </motion.button>
        </div>
      )}
    </aside>
  );
}