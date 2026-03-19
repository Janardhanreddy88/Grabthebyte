import { Plus, Minus } from "lucide-react";
import { MenuItem as BaseMenuItem } from "@/types/canteen";
import { useCart } from "@/context/CartContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

// Safely added is_available just in case the backend passes it as snake_case
interface MenuItem extends BaseMenuItem { quantity?: number; is_available?: boolean; }
interface MenuItemCardProps { item: MenuItem; }

export function MenuItemCard({ item }: MenuItemCardProps) {
  const { cart, addToCart, updateQuantity } = useCart();
  const cartItem = cart.find((i) => i.id === item.id);
  const quantity = cartItem?.quantity || 0;
  
  // 🔥 THE NEW PRIORITY LOGIC 🔥
  // 1. Check if the admin explicitly turned it off (Master Toggle / Item Toggle)
  const isItemEnabled = item.isAvailable !== undefined ? item.isAvailable : item.is_available !== undefined ? item.is_available : true;
  const isUnavailable = !isItemEnabled;

  // 2. Check if the stock is zero
  const isOutOfStock = (item.quantity !== undefined && item.quantity !== null) ? item.quantity <= 0 : false;

  // 3. Combine them: The item is un-buyable if EITHER is true
  const isSoldOut = isUnavailable || isOutOfStock;

  return (
    <motion.div whileHover={!isSoldOut ? { y: -2 } : {}} whileTap={!isSoldOut ? { scale: 0.98 } : {}}
      className={cn("group relative bg-card rounded-2xl overflow-hidden transition-all duration-200",
        quantity > 0 ? "ring-2 ring-primary shadow-medium" : "shadow-soft hover:shadow-medium",
        isSoldOut && "opacity-70")}>
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <div className="absolute top-3 left-3 z-10">
          <div className={cn("w-5 h-5 rounded-[4px] border-2 flex items-center justify-center bg-card/95",
            item.isVeg ? "border-emerald-600" : "border-red-600")}>
            <div className={cn("w-2.5 h-2.5 rounded-full", item.isVeg ? "bg-emerald-600" : "bg-red-600")} />
          </div>
        </div>
        {item.isPopular && !isSoldOut && (
          <div className="absolute top-3 right-3 z-10">
            <span className="px-2.5 py-1 rounded-md bg-canteen-warning text-canteen-dark text-[11px] font-bold uppercase tracking-wider">Popular</span>
          </div>
        )}
        <img src={item.image || "/placeholder.svg"} alt={item.name} loading="lazy"
          className={cn("w-full h-full object-cover transition-transform duration-500",
            !isSoldOut && "group-hover:scale-105", isSoldOut && "grayscale-[0.5]")}
          onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }} />
        
        {/* 🔥 OVERLAY LOGIC (Unavailable wins over Out of Stock) */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-background/55 flex items-center justify-center backdrop-blur-[2px]">
            <span className={cn("px-3.5 py-1.5 rounded-lg font-bold text-xs border",
              isUnavailable ? "bg-muted text-muted-foreground border-border" : "bg-destructive/10 text-destructive border-destructive/20")}>
              {isUnavailable ? "Unavailable" : "Out of Stock"}
            </span>
          </div>
        )}
      </div>

      <div className="p-2.5 lg:p-3">
        <h3 className="font-display font-semibold text-xs lg:text-sm text-foreground line-clamp-1 leading-snug">{item.name}</h3>
        <p className="text-[11px] lg:text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
        <div className="flex items-center justify-between mt-2 gap-2">
          <span className="text-sm lg:text-base font-bold text-foreground tabular-nums">₹{item.price}</span>
          {!isSoldOut ? (
            quantity > 0 ? (
              <div className="flex items-center gap-1.5">
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => updateQuantity(item.id, quantity - 1)}
                  className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Minus size={14} strokeWidth={2.5} /></motion.button>
                <span className="font-bold text-xs min-w-[1.5rem] text-center tabular-nums text-primary">{quantity}</span>
                <motion.button whileTap={{ scale: 0.85 }} onClick={() => addToCart(item)}
                  className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center"><Plus size={14} strokeWidth={2.5} /></motion.button>
              </div>
            ) : (
              <Button size="sm" className="rounded-lg text-xs font-bold shadow-none gap-1.5 btn-glow" onClick={() => addToCart(item)}>
                <Plus size={16} strokeWidth={2.5} />ADD
              </Button>
            )
          ) : (
            <Button disabled size="sm" variant="outline" className="rounded-lg text-xs font-medium border-dashed text-muted-foreground bg-transparent">
              {/* 🔥 BUTTON TEXT LOGIC */}
              {isUnavailable ? "Unavailable" : "Sold Out"}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}