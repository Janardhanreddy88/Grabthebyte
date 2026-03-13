import { Plus, Minus } from "lucide-react";
import { MenuItem as BaseMenuItem } from "@/types/canteen";
import { useCart } from "@/context/CartContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface MenuItem extends BaseMenuItem { quantity?: number; }
interface MenuItemCardProps { item: MenuItem; }

export function MenuItemCard({ item }: MenuItemCardProps) {
  const { cart, addToCart, updateQuantity } = useCart();
  const cartItem = cart.find((i) => i.id === item.id);
  const quantity = cartItem?.quantity || 0;
  const isOutOfStock = (item.quantity !== undefined && item.quantity !== null) ? item.quantity <= 0 : false;
  const isSoldOut = !item.isAvailable || isOutOfStock;

  return (
    <motion.div whileHover={!isSoldOut ? { y: -2 } : {}} whileTap={!isSoldOut ? { scale: 0.98 } : {}}
      className={cn("group relative bg-card rounded-2xl overflow-hidden transition-all duration-200",
        quantity > 0 ? "ring-2 ring-primary shadow-medium" : "shadow-soft hover:shadow-medium",
        isSoldOut && "opacity-70")}>
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <div className="absolute top-2.5 left-2.5 z-10">
          <div className={cn("w-5 h-5 rounded-[4px] border-2 flex items-center justify-center bg-card/95",
            item.isVeg ? "border-emerald-600" : "border-red-600")}>
            <div className={cn("w-2.5 h-2.5 rounded-full", item.isVeg ? "bg-emerald-600" : "bg-red-600")} />
          </div>
        </div>
        {item.isPopular && !isSoldOut && (
          <div className="absolute top-2.5 right-2.5 z-10">
            <span className="px-2 py-1 rounded-md bg-canteen-warning text-canteen-dark text-[10px] font-bold uppercase tracking-wider">Popular</span>
          </div>
        )}
        <img src={item.image || "/placeholder.svg"} alt={item.name} loading="lazy"
          className={cn("w-full h-full object-cover transition-transform duration-500",
            !isSoldOut && "group-hover:scale-105", isSoldOut && "grayscale-[0.5]")}
          onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }} />
        {isSoldOut && (
          <div className="absolute inset-0 bg-background/55 flex items-center justify-center backdrop-blur-[2px]">
            <span className={cn("px-3 py-1.5 rounded-lg font-bold text-xs border",
              isOutOfStock ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-muted text-muted-foreground border-border")}>
              {isOutOfStock ? "Out of Stock" : "Unavailable"}
            </span>
          </div>
        )}
      </div>

      <div className="p-3 lg:p-4">
        <h3 className="font-display font-semibold text-sm lg:text-base text-foreground line-clamp-1 leading-snug">{item.name}</h3>
        <p className="text-xs lg:text-sm text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
        <div className="flex items-center justify-between mt-2.5 gap-2">
          <span className="text-base lg:text-lg font-bold text-foreground tabular-nums">₹{item.price}</span>
          {!isSoldOut ? (
            quantity > 0 ? (
              <div className="flex items-center gap-1">
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => updateQuantity(item.id, quantity - 1)}
                  className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Minus size={14} strokeWidth={2.5} /></motion.button>
                <span className="font-bold text-sm min-w-[1.5rem] text-center tabular-nums text-primary">{quantity}</span>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => addToCart(item)}
                  className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"><Plus size={14} strokeWidth={2.5} /></motion.button>
              </div>
            ) : (
              <Button size="sm" className="h-8 px-4 rounded-lg text-xs font-bold shadow-none gap-1 btn-glow" onClick={() => addToCart(item)}>
                <Plus size={14} strokeWidth={2.5} />ADD
              </Button>
            )
          ) : (
            <Button disabled size="sm" variant="outline" className="h-8 px-3 rounded-lg text-xs font-medium border-dashed text-muted-foreground bg-transparent">Sold Out</Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
