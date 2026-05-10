import { Plus, Minus, Check, X } from "lucide-react";
import { useState } from "react";
import { MenuItem as BaseMenuItem } from "@/types/canteen";
import { useCart } from "@/context/CartContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ImageWithFallback } from "@/components/ImageWithFallback"; 

interface MenuItem extends BaseMenuItem { 
  quantity?: number; 
  is_available?: boolean; 
}
interface MenuItemCardProps { item: MenuItem; }

export function MenuItemCard({ item }: MenuItemCardProps) {
  const { cart, addToCart, updateQuantity } = useCart();
  const cartItem = cart.find((i) => i.id === item.id);
  const quantity = cartItem?.quantity || 0;
  
  // 🦅 NEW: State for the Token Inline Input
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenAmount, setTokenAmount] = useState("");
  
  const isItemEnabled = item.isAvailable === true || item.is_available === true;
  const isUnavailable = !isItemEnabled;

  // 🦅 THE FIX: Identify the token and grant it infinite stock!
  const isToken = item.category === 'token' || item.name.toLowerCase().includes('token');
  const currentStock = isToken ? 999999 : (item.quantity ?? (item as any).stock_quantity ?? 0);
  const isOutOfStock = currentStock <= 0;

  const isSoldOut = isUnavailable || isOutOfStock;

  const handleTokenSubmit = () => {
    const amount = parseInt(tokenAmount);
    if (!isNaN(amount) && amount > 0) {
      // Add the new amount to whatever they already have in the cart
      if (quantity > 0) {
        updateQuantity(item.id, quantity + amount);
      } else {
        // We use a loop here so the CartContext registers the initial addition properly
    addToCart(item, amount);
      }
      setShowTokenInput(false);
      setTokenAmount("");
    }
  };

  return (
    <motion.div 
      whileHover={!isSoldOut ? { y: -2 } : {}} 
      whileTap={!isSoldOut ? { scale: 0.98 } : {}}
      className={cn(
        "group relative bg-card rounded-2xl overflow-hidden transition-all duration-200",
        quantity > 0 ? "ring-2 ring-primary shadow-lg" : "shadow-md hover:shadow-xl",
        isSoldOut && "opacity-60 grayscale-[0.3]" 
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {/* Veg/Non-Veg Badge */}
        <div className="absolute top-3 left-3 z-10">
          <div className={cn(
            "w-5 h-5 rounded-[4px] border-2 flex items-center justify-center bg-card/95",
            item.isVeg ? "border-emerald-600" : "border-red-600"
          )}>
            <div className={cn("w-2.5 h-2.5 rounded-full", item.isVeg ? "bg-emerald-600" : "bg-red-600")} />
          </div>
        </div>

        {/* Popular Badge */}
        {item.isPopular && !isSoldOut && (
          <div className="absolute top-3 right-3 z-10">
            <span className="px-2.5 py-1 rounded-md bg-yellow-400 text-black text-[10px] font-black uppercase tracking-tighter">Popular</span>
          </div>
        )}

        <ImageWithFallback 
          src={item.image || "/placeholder.svg"} 
          alt={item.name} 
          loading="lazy"
          containerClassName="w-full h-full"
          className={cn(
            "w-full h-full object-cover transition-transform duration-500",
            !isSoldOut && "group-hover:scale-105"
          )}
          fallbackIcon={true}
        />
        
        {/* 🔥 OVERLAY LOGIC */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
            <span className={cn(
              "px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-widest border shadow-xl",
              isUnavailable 
                ? "bg-white text-black border-white" 
                : "bg-red-600 text-white border-red-500"
            )}>
              {isUnavailable ? "Unavailable" : "Sold Out"}
            </span>
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="font-bold text-xs lg:text-sm text-foreground line-clamp-1">{item.name}</h3>
        <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{item.description}</p>
        
        <div className="flex items-center justify-between mt-3 gap-2">
          {/* If it's a token, don't show "₹1", just show "Custom" */}
          <span className="text-sm lg:text-base font-black text-foreground">
            {isToken ? "Custom ₹" : `₹${item.price}`}
          </span>
          
          {!isSoldOut ? (
            showTokenInput ? (
              // 🦅 THE INLINE TOKEN INPUT
              <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl">
                <input 
                  type="number" 
                  autoFocus 
                  className="w-12 h-7 text-xs font-bold border-none rounded-md text-center focus:ring-1 focus:ring-primary bg-background" 
                  value={tokenAmount} 
                  onChange={e => setTokenAmount(e.target.value)} 
                  placeholder="₹"
                  onKeyDown={(e) => e.key === 'Enter' && handleTokenSubmit()}
                />
                <button onClick={handleTokenSubmit} className="h-7 w-7 bg-emerald-500 text-white rounded-md flex items-center justify-center active:scale-95"><Check size={14}/></button>
                <button onClick={() => setShowTokenInput(false)} className="h-7 w-7 bg-muted-foreground/20 text-foreground rounded-md flex items-center justify-center active:scale-95"><X size={14}/></button>
              </div>
            ) : quantity > 0 && !isToken ? (
              // Normal Plus/Minus buttons for food items
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => updateQuantity(item.id, quantity - 1)}
                  className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Minus size={14} strokeWidth={3} />
                </button>
                <span className="font-bold text-sm min-w-[1rem] text-center tabular-nums">{quantity}</span>
                <button 
                  onClick={() => addToCart(item)}
                  className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Plus size={14} strokeWidth={3} />
                </button>
              </div>
            ) : quantity > 0 && isToken ? (
              // Custom button if they already have tokens in the cart
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-primary">₹{quantity} in cart</span>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="rounded-xl h-8 text-[10px] font-black px-3 active:scale-95 transition-all" 
                  onClick={() => setShowTokenInput(true)}
                >
                  + ADD MORE
                </Button>
              </div>
            ) : (
              // The default ADD button
              <Button 
                size="sm" 
                className="rounded-xl h-8 text-[10px] font-black px-4 bg-primary hover:bg-primary/90 shadow-md active:scale-95 transition-all" 
                onClick={() => isToken ? setShowTokenInput(true) : addToCart(item)}
              >
                ADD
              </Button>
            )
          ) : (
            <div className="h-8 flex items-center">
               <span className="text-[10px] font-bold text-muted-foreground italic">
                 {isUnavailable ? "Check back later" : "Out of stock"}
               </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}