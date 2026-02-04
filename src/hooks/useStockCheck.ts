import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CartItem } from '@/types/canteen';

interface StockCheckResult {
  success: boolean;
  unavailableItems: CartItem[];
}

// ✅ FIX: Use the REAL column name from your database
interface DbMenuItem {
  id: string;
  name: string;
  stock_quantity: number | null; // Changed from 'quantity' to 'stock_quantity'
  is_available: boolean;
}

export function useStockCheck() {
  
  const checkStock = useCallback(async (cartItems: CartItem[]): Promise<StockCheckResult> => {
    const unavailableItems: CartItem[] = [];

    try {
      if (cartItems.length === 0) return { success: true, unavailableItems: [] };

      const itemIds = cartItems.map(item => item.id);

      // ✅ FIX: Select 'stock_quantity' instead of 'quantity'
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, stock_quantity, is_available') 
        .in('id', itemIds);

      if (error || !data) {
        console.error("Stock check failed:", error);
        return { success: false, unavailableItems: cartItems }; 
      }

      const dbItems = data as unknown as DbMenuItem[];

      for (const cartItem of cartItems) {
        const dbItem = dbItems.find(i => i.id === cartItem.id);

        if (!dbItem || dbItem.is_available === false) {
          unavailableItems.push(cartItem);
          continue;
        }

        // ✅ FIX: Check 'stock_quantity' for NULL (Unlimited)
        if (dbItem.stock_quantity === null) {
            continue; 
        }

        // ✅ FIX: Compare 'stock_quantity' vs Cart Quantity
        if (dbItem.stock_quantity < cartItem.quantity) {
          unavailableItems.push(cartItem);
        }
      }

    } catch (err) {
      console.error("Stock check error:", err);
      return { success: false, unavailableItems: cartItems };
    }

    return {
      success: unavailableItems.length === 0,
      unavailableItems,
    };
  }, []);

  return { checkStock };
}