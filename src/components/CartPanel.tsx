import { ShoppingBag, Minus, Plus, Trash2, Package, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';

export function CartPanel() {
  const navigate = useNavigate();
  const { cart, totalItems, totalPrice, updateQuantity, removeFromCart } = useCart();

  if (cart.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center"><ShoppingBag className="w-4 h-4 text-secondary" /></div>
            <div><h2 className="font-display font-bold text-sm">Your Order</h2><p className="text-[10px] text-muted-foreground">0 items</p></div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center px-6">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3"><Package className="w-5 h-5 text-muted-foreground" /></div>
          <h3 className="font-display font-bold text-sm text-foreground">Cart is empty</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Add items from the menu</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center" style={{ boxShadow: '0 3px 10px -2px hsl(152 69% 31% / 0.3)' }}>
            <ShoppingBag className="w-4 h-4 text-secondary-foreground" />
          </div>
          <div><h2 className="font-display font-bold text-sm">Your Order</h2><p className="text-[10px] text-muted-foreground">{totalItems} item{totalItems > 1 ? 's' : ''}</p></div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          <AnimatePresence>
            {cart.map((item) => (
              <motion.div key={item.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8, height: 0 }}
                className="flex gap-2.5 p-2 rounded-xl bg-muted/30 border border-border/50">
                <img src={item.image} alt={item.name} className="w-11 h-11 rounded-lg object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-xs truncate text-foreground">{item.name}</h4>
                  <p className="text-primary font-bold text-xs mt-0.5 tabular-nums">₹{item.price}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="w-6 h-6 rounded-md bg-card border border-border flex items-center justify-center hover:bg-muted"><Minus size={11} /></motion.button>
                    <span className="font-bold text-xs min-w-[1rem] text-center tabular-nums">{item.quantity}</span>
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center"><Plus size={11} /></motion.button>
                    <motion.button whileTap={{ scale: 0.85 }} onClick={() => removeFromCart(item.id)}
                      className="ml-auto w-6 h-6 rounded-md bg-destructive/10 text-destructive flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"><Trash2 size={11} /></motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border bg-card">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-muted-foreground font-medium">Subtotal</span>
          <span className="text-base font-bold text-foreground tabular-nums">₹{totalPrice}</span>
        </div>
        <Button className="w-full h-9 font-bold rounded-xl bg-secondary hover:bg-secondary/90 text-secondary-foreground gap-1.5 text-xs btn-glow"
          style={{ boxShadow: '0 3px 12px -2px hsl(152 69% 31% / 0.3)' }} onClick={() => navigate('/checkout')}>
          Proceed to Checkout <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}