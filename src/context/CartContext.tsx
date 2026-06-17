/* @refresh reset */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { CartItem, MenuItem, Order } from '@/types/canteen';
import { supabase } from '@/integrations/supabase/client';

interface CartContextType {
  cart: CartItem[];
  // 🦅 UPGRADED: addToCart now accepts a custom quantity!
  addToCart: (item: MenuItem, quantity?: number) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  currentOrder: Order | null;
  setCurrentOrder: (order: Order | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'grabthebyte_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        return JSON.parse(savedCart);
      }
    } catch (error) {
      console.error("Failed to load cart from storage:", error);
    }
    return [];
  });

  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  // ─── EXISTING: Save to localStorage ────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error("Failed to save cart to storage:", error);
    }
  }, [cart]);

  // ─── NEW: Sync cart to Supabase ─────────────────────────────
  const syncCartToSupabase = useCallback(async (updatedCart: CartItem[]) => {
    try {
      // Get current session directly — no AuthContext dependency
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      const isAnonymous = session?.user?.is_anonymous ?? false;

      console.log("🛒 Sync attempt — user:", userId, "items:", updatedCart.length);

      // Only sync for logged-in non-anonymous users
      if (!userId || isAnonymous) return;

      const total = updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0);

      if (updatedCart.length === 0) {
        // Cart is empty — delete their cart row from DB
        await supabase
          .from('carts')
          .delete()
          .eq('user_id', userId);
        return;
      }

      // Upsert — insert if not exists, update if exists
 const { error } = await supabase
  .from('carts')
  .upsert(
    {
      user_id: userId,
      campus_id: session?.user?.user_metadata?.campus_id ?? null,
      items: updatedCart,
      total: total,
      updated_at: new Date().toISOString(),
      // ✅ notified_at REMOVED — never touch it from frontend
    },
    { onConflict: 'user_id' }
  );
      if (error) {
        console.error("Cart sync error:", error.message);
      }

    } catch (err) {
      // Silent fail — localStorage is the source of truth
      console.error("Cart sync to Supabase failed (non-critical):", err);
    }
  }, []);

  // ─── NEW: Debounced sync on cart change ──────────────────────
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      syncCartToSupabase(cart);
    }, 1500);
    return () => clearTimeout(debounceTimer);
  }, [cart, syncCartToSupabase]);

  // ─── EXISTING: All cart operations — UNTOUCHED ───────────────

  // 🦅 UPGRADE 4: Smart limits & Bulk Additions
  const addToCart = (item: MenuItem, quantityToAdd: number = 1) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      
      // Safety Check: Tokens can go up to ₹10,000. Normal food is capped at 50.
      const isToken = item.category === 'token' || item.name.toLowerCase().includes('token');
      const maxLimit = isToken ? 10000 : 50; 

      if (existing) {
        const newQuantity = Math.min(existing.quantity + quantityToAdd, maxLimit);
        return prev.map(i => 
          i.id === item.id ? { ...i, quantity: newQuantity } : i
        );
      }
      const initialQty = Math.min(quantityToAdd, maxLimit);
      return [...prev, { ...item, quantity: initialQty }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    
    setCart(prev => 
      prev.map(i => {
        if (i.id === itemId) {
           const isToken = i.category === 'token' || i.name.toLowerCase().includes('token');
           const maxLimit = isToken ? 10000 : 50; 
           return { ...i, quantity: Math.min(quantity, maxLimit) };
        }
        return i;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
    localStorage.removeItem(CART_STORAGE_KEY);
    // Also clear from Supabase
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id) {
        supabase.from('carts').delete().eq('user_id', session.user.id);
      }
    });
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      currentOrder,
      setCurrentOrder,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}