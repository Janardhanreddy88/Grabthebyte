import { cn } from '@/lib/utils';
import { categories } from '@/data/menuData';
import { UtensilsCrossed, Utensils, Sunrise, Soup, Cookie, Coffee, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';

interface CategorySidebarProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onProfileClick?: () => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  all: <UtensilsCrossed size={20} />,
  'main-course': <Utensils size={20} />,
  breakfast: <Sunrise size={20} />,
  lunch: <Soup size={20} />,
  snacks: <Cookie size={20} />,
  beverages: <Coffee size={20} />,
};

export function CategorySidebar({ selectedCategory, onSelectCategory, onProfileClick }: CategorySidebarProps) {
  return (
    <aside className="relative flex flex-col w-[72px] lg:w-20 bg-card border-r border-border h-full">
      <ScrollArea className="flex-1 py-3">
        <div className="flex flex-col gap-1 px-1.5">
          {categories.map((category) => {
            const isActive = selectedCategory === category.id;
            return (
              <motion.button
                key={category.id}
                whileTap={{ scale: 0.92 }}
                onClick={() => onSelectCategory(category.id)}
                className={cn(
                  'relative flex flex-col items-center gap-1.5 py-3 px-1 rounded-2xl transition-all duration-200',
                  isActive ? 'bg-primary/8' : 'hover:bg-muted/60'
                )}
              >
                <div
                  className={cn(
                    'w-11 h-11 lg:w-12 lg:h-12 rounded-2xl flex items-center justify-center transition-all duration-250',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 text-muted-foreground'
                  )}
                  style={isActive ? { boxShadow: '0 4px 12px -2px hsl(24 95% 53% / 0.3)' } : {}}
                >
                  {categoryIcons[category.id] || <UtensilsCrossed size={20} />}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-semibold text-center leading-tight max-w-full px-0.5 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {category.name}
                </span>
                {/* Active indicator line */}
                {isActive && (
                  <motion.div
                    layoutId="category-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-primary rounded-r-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Profile button */}
      {onProfileClick && (
        <div className="flex-shrink-0 p-2 border-t border-border">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onProfileClick}
            className="w-full flex flex-col items-center gap-1.5 py-2.5 rounded-2xl hover:bg-muted/60 transition-colors"
          >
            <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground">
              <User size={20} />
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground">Profile</span>
          </motion.button>
        </div>
      )}
    </aside>
  );
}