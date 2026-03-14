import { cn } from '@/lib/utils';
import { categories } from '@/data/menuData';
import { motion } from 'framer-motion';

interface CategoryChipsProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export function CategoryChips({ selectedCategory, onSelectCategory }: CategoryChipsProps) {
  return (
    <div className="mb-5 -mx-4 px-4">
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((category) => {
          const isActive = selectedCategory === category.id;
          return (
            <motion.button
              key={category.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectCategory(category.id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-full text-sm font-semibold transition-all duration-200 border',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground'
              )}
            >
              <span className="text-base">{category.icon}</span>
              <span>{category.name}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
