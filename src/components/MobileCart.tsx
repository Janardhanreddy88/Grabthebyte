import { ShoppingBag, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';

export function MobileCart() {
  const navigate = useNavigate();
  const { totalItems, totalPrice } = useCart();

  return (
    <AnimatePresence>
      {totalItems > 0 && (
        <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }} className="fixed bottom-0 left-0 right-0 p-4 lg:hidden z-50">
          <button onClick={() => navigate('/checkout')}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-secondary text-secondary-foreground active:scale-[0.98] transition-transform fab-shadow">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-secondary-foreground/10 flex items-center justify-center"><ShoppingBag size={18} /></div>
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-canteen-warning text-canteen-dark rounded-full flex items-center justify-center text-[10px] font-bold">{totalItems}</span>
              </div>
              <div className="text-left">
                <span className="font-bold text-sm">{totalItems} item{totalItems > 1 ? 's' : ''}</span>
                <p className="text-[11px] opacity-75">Tap to checkout</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold tabular-nums">₹{totalPrice}</span>
              <ChevronRight size={18} className="opacity-60" />
            </div>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
