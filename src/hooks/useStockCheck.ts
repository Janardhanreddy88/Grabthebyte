import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CartItem } from '@/types/canteen';

interface StockCheckResult {
  success: boolean;
  unavailableItems: CartItem[];
}

// ✅ FIX: Define the expected DB structure locally to silence errors
interface DbMenuItem {
  id: string;
  name: string;
  quantity: number | null;
  is_available: boolean;
}

/**
 * Hook for checking REAL database stock before payment
 */
export function useStockCheck() {
  
  const checkStock = useCallback(async (cartItems: CartItem[]): Promise<StockCheckResult> => {
    const unavailableItems: CartItem[] = [];

    try {
      if (cartItems.length === 0) return { success: true, unavailableItems: [] };

      // 1. Get all Item IDs from the cart
      const itemIds = cartItems.map(item => item.id);

      // 2. Fetch the LATEST quantity from Supabase
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, quantity, is_available')
        .in('id', itemIds);

      if (error || !data) {
        console.error("Stock check failed:", error);
        // Fail safe: If DB check fails, we prevent purchase to avoid issues
        return { success: false, unavailableItems: cartItems }; 
      }

      // ✅ FIX: Cast the data to our local type to remove the "Property does not exist" error
      const dbItems = data as unknown as DbMenuItem[];

      // 3. Compare Cart vs Database
      for (const cartItem of cartItems) {
        const dbItem = dbItems.find(i => i.id === cartItem.id);

        // Case A: Item was deleted or hidden by Admin
        // We check explicit false because is_available might be missing/null in some legacy rows
        if (!dbItem || dbItem.is_available === false) {
          unavailableItems.push(cartItem);
          continue;
        }

        // Case B: Not enough stock
        // Handle null quantity by treating it as 0
        const currentStock = dbItem.quantity !== null ? dbItem.quantity : 0;
        
        if (currentStock < cartItem.quantity) {
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