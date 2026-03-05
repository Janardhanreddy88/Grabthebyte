import { Flame, Plus, Minus } from "lucide-react";
import { MenuItem } from "@/types/canteen";
import { useCart } from "@/context/CartContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface PopularNowProps {
  items: MenuItem[];
}

export function PopularNow({ items }: PopularNowProps) {
  const { cart, addToCart, updateQuantity } = useCart();

  if (items.length === 0) return null;

  const getCartItem = (id: string) => cart.find((i) => i.id === id);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-canteen-warning/15 flex items-center justify-center">
            <Flame className="w-[18px] h-[18px] text-canteen-warning" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-foreground">Popular Now</h3>
            <p className="text-[11px] text-muted-foreground">Most ordered today</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory scrollbar-none">
        {items.slice(0, 6).map((item, index) => {
          const cartItem = getCartItem(item.id);
          const quantity = cartItem?.quantity || 0;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06 }}
              className={cn(
                "relative flex-shrink-0 w-[140px] snap-start bg-card rounded-2xl overflow-hidden transition-all duration-200",
                quantity > 0
                  ? "ring-2 ring-primary shadow-medium"
                  : "shadow-soft hover:shadow-medium"
              )}
            >
              {/* Veg indicator */}
              <div className="absolute top-2 left-2 z-10">
                <div
                  className={cn(
                    "w-4 h-4 rounded-[3px] border-[1.5px] flex items-center justify-center bg-card/95",
                    item.isVeg ? "border-emerald-600" : "border-red-600"
                  )}
                >
                  <div className={cn("w-2 h-2 rounded-full", item.isVeg ? "bg-emerald-600" : "bg-red-600")} />
                </div>
              </div>

              {/* Image */}
              <div className="aspect-square overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                />
              </div>

              {/* Content */}
              <div className="p-2.5">
                <h4 className="font-semibold text-xs line-clamp-1 text-foreground">{item.name}</h4>
                <div className="flex items-center justify-between mt-2 gap-1">
                  <span className="font-bold text-sm text-foreground tabular-nums">₹{item.price}</span>
                  {quantity > 0 ? (
                    <div className="flex items-center gap-0.5">
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => updateQuantity(item.id, quantity - 1)}
                        className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center"
                      >
                        <Minus size={12} strokeWidth={2.5} />
                      </motion.button>
                      <span className="font-bold text-xs min-w-[1rem] text-center tabular-nums text-primary">
                        {quantity}
                      </span>
                      <motion.button
                        whileTap={{ scale: 0.85 }}
                        onClick={() => addToCart(item)}
                        className="w-6 h-6 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"
                      >
                        <Plus size={12} strokeWidth={2.5} />
                      </motion.button>
                    </div>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.85 }}
                      onClick={() => addToCart(item)}
                      className="w-7 h-7 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors"
                    >
                      <Plus size={14} strokeWidth={2.5} />
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}