import { Flame, Plus, Minus } from "lucide-react";
import { MenuItem } from "@/types/canteen";
import { useCart } from "@/context/CartContext";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface PopularNowProps { items: MenuItem[]; }

export function PopularNow({ items }: PopularNowProps) {
  const { cart, addToCart, updateQuantity } = useCart();
  if (items.length === 0) return null;
  const getCartItem = (id: string) => cart.find((i) => i.id === id);

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-canteen-warning/15 flex items-center justify-center">
          <Flame className="w-3.5 h-3.5 text-canteen-warning" />
        </div>
        <div>
          <h3 className="font-display font-bold text-sm text-foreground">Popular Now</h3>
          <p className="text-[10px] text-muted-foreground">Most ordered today</p>
        </div>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-none">
        {items.slice(0, 6).map((item, index) => {
          const cartItem = getCartItem(item.id);
          const quantity = cartItem?.quantity || 0;
          return (
            <motion.div key={item.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}
              className={cn("relative flex-shrink-0 w-[120px] snap-start bg-card rounded-xl overflow-hidden transition-all duration-200",
                quantity > 0 ? "ring-2 ring-primary shadow-medium" : "shadow-soft hover:shadow-medium")}>
              <div className="absolute top-1.5 left-1.5 z-10">
                <div className={cn("w-3.5 h-3.5 rounded-[2px] border-[1.5px] flex items-center justify-center bg-card/95",
                  item.isVeg ? "border-emerald-600" : "border-red-600")}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", item.isVeg ? "bg-emerald-600" : "bg-red-600")} />
                </div>
              </div>
              <div className="aspect-square overflow-hidden">
                <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
              </div>
              <div className="p-2">
                <h4 className="font-semibold text-[10px] line-clamp-1 text-foreground">{item.name}</h4>
                <div className="flex items-center justify-between mt-1.5 gap-1">
                  <span className="font-bold text-xs text-foreground tabular-nums">₹{item.price}</span>
                  {quantity > 0 ? (
                    <div className="flex items-center gap-0.5">
                      <motion.button whileTap={{ scale: 0.85 }} onClick={() => updateQuantity(item.id, quantity - 1)}
                        className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Minus size={10} strokeWidth={2.5} /></motion.button>
                      <span className="font-bold text-[10px] min-w-[0.75rem] text-center tabular-nums text-primary">{quantity}</span>
                      <motion.button whileTap={{ scale: 0.85 }} onClick={() => addToCart(item)}
                        className="w-5 h-5 rounded-md bg-primary text-primary-foreground flex items-center justify-center"><Plus size={10} strokeWidth={2.5} /></motion.button>
                    </div>
                  ) : (
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => addToCart(item)}
                      className="w-6 h-6 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Plus size={12} strokeWidth={2.5} /></motion.button>
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