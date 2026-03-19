import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CartItem } from '@/types/canteen';

// 🔥 NEW: Smarter return type to handle partial stock!
export interface StockCheckResult {
  success: boolean;
  soldOutItems: CartItem[];
  adjustedItems: { item: CartItem; availableStock: number }[];
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
    const soldOutItems: CartItem[] = [];
    const adjustedItems: { item: CartItem; availableStock: number }[] = [];

    try {
      if (cartItems.length === 0) return { success: true, soldOutItems: [], adjustedItems: [] };

      const itemIds = cartItems.map(item => item.id);

      // ✅ FIX: Select 'stock_quantity' instead of 'quantity'
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, stock_quantity, is_available') 
        .in('id', itemIds);

      if (error || !data) {
        console.error("Stock check failed:", error);
        return { success: false, soldOutItems: cartItems, adjustedItems: [] }; 
      }

      const dbItems = data as unknown as DbMenuItem[];

      for (const cartItem of cartItems) {
        const dbItem = dbItems.find(i => i.id === cartItem.id);

        // 1. COMPLETELY SOLD OUT OR ADMIN TURNED IT OFF
        if (!dbItem || dbItem.is_available === false || dbItem.stock_quantity === 0) {
          soldOutItems.push(cartItem);
          continue;
        }

        // 2. UNLIMITED STOCK (No limits, skip check)
        if (dbItem.stock_quantity === null) {
            continue; 
        }

        // 3. PARTIAL STOCK (e.g., They want 3 Dosas, but only 2 exist)
        if (dbItem.stock_quantity < cartItem.quantity) {
          adjustedItems.push({
            item: cartItem,
            availableStock: dbItem.stock_quantity
          });
        }
      }

    } catch (err) {
      console.error("Stock check error:", err);
      return { success: false, soldOutItems: cartItems, adjustedItems: [] };
    }

    return {
      // It's only successful if BOTH arrays are empty
      success: soldOutItems.length === 0 && adjustedItems.length === 0,
      soldOutItems,
      adjustedItems,
    };
  }, []);

  return { checkStock };
}