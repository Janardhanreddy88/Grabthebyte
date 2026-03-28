import { cn } from '@/lib/utils';
import { useCategories } from '@/hooks/useCategories';
import { motion } from 'framer-motion';

interface CategoryChipsProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export function CategoryChips({ selectedCategory, onSelectCategory }: CategoryChipsProps) {
  const { data: dbCategories = [] } = useCategories();

  // Build chips: "All Items" + DB categories
  const chips = [
    { id: 'all', name: 'All Items', icon: '🍽️' },
    ...dbCategories.map(c => ({ id: c.name.toLowerCase().trim(), name: c.name, icon: c.icon })),
  ];

  return (
    <div className="mb-4 -mx-3 px-3">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {chips.map((category) => {
          const isActive = selectedCategory === category.id;
          return (
            <motion.button
              key={category.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectCategory(category.id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-all duration-200 border',
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
