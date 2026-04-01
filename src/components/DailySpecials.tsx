import { Sparkles, Tag, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useDailySpecials } from '@/hooks/useDailySpecials';
import { useCart } from '@/context/CartContext';
import { useMenu } from '@/context/MenuContext';
import { cn } from '@/lib/utils';

export function DailySpecials() {
  const { specials, isLoading } = useDailySpecials();
  const { addToCart } = useCart();
  const { getMenuItem } = useMenu();

  if (isLoading || specials.length === 0) return null;

  const handleAdd = (menuItemId: string | null) => {
    if (!menuItemId) return;
    const item = getMenuItem(menuItemId);
    if (item && item.isAvailable) addToCart(item);
  };

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-bold text-sm text-foreground">Today's Specials</h3>
          <p className="text-[10px] text-muted-foreground">Limited-time deals just for you</p>
        </div>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-none">
        {specials.map((special, index) => (
          <motion.div
            key={special.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06 }}
            className="relative flex-shrink-0 w-[200px] snap-start rounded-xl overflow-hidden shadow-soft bg-card border border-border/50"
          >
            {/* Image */}
            {special.image_url && (
              <div className="h-24 overflow-hidden">
                <img
                  src={special.image_url}
                  alt={special.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 h-24 bg-gradient-to-t from-foreground/40 to-transparent" />
              </div>
            )}

            {/* Badge */}
            {special.badge_text && (
              <div className="absolute top-2 left-2 z-10">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider">
                  <Tag size={8} />
                  {special.badge_text}
                </span>
              </div>
            )}

            {/* Content */}
            <div className="p-2.5">
              <h4 className="font-semibold text-xs text-foreground line-clamp-1">{special.title}</h4>
              {special.description && (
                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{special.description}</p>
              )}
              <div className="flex items-center justify-between mt-2">
                {special.discount_text && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {special.discount_text}
                  </span>
                )}
                {special.menu_item_id && (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleAdd(special.menu_item_id)}
                    className={cn(
                      "ml-auto w-6 h-6 rounded-lg flex items-center justify-center",
                      "bg-primary text-primary-foreground"
                    )}
                  >
                    <ArrowRight size={12} strokeWidth={2.5} />
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
