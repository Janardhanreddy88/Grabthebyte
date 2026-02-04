import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { MenuItem } from '@/types/canteen';
import { supabase } from '@/integrations/supabase/client';
import { useCampus } from '@/context/CampusContext';

interface MenuContextType {
  menuItems: MenuItem[];
  isLoading: boolean;
  error: string | null;
  updateItemAvailability: (itemId: string, isAvailable: boolean) => void;
  getMenuItem: (itemId: string) => MenuItem | undefined;
  refreshMenu: () => void;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export function MenuProvider({ children }: { children: ReactNode }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { campus } = useCampus();

  // Fetch menu items from Supabase
  const fetchMenuItems = useCallback(async () => {
    if (!campus?.id) {
      setMenuItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('campus_id', campus.id)
        .order('name');

      if (fetchError) throw fetchError;

      // Transform to match MenuItem type
      const items: MenuItem[] = (data || []).map(item => {
        
        // 1. Get the real stock from DB
        const stockQty = item.stock_quantity; 

        // 2. CALCULATE AVAILABILITY (The Magic Logic) 🪄
        // It is available ONLY IF:
        // - Admin says it is available (item.is_available)
        // - AND Stock is NOT zero (stockQty !== 0)
        // (Note: stockQty === null means "Unlimited", so that is allowed)
        const computedAvailability = item.is_available && (stockQty === null || stockQty > 0);

        return {
          id: item.id,
          name: item.name,
          description: item.description || '',
          price: Number(item.price),
          image: item.image_url || '/placeholder.svg',
          category: item.category || 'snacks',
          isVeg: item.is_veg,
          isPopular: item.is_popular,
          
          quantity: stockQty, // Save the stock number

          // 3. FORCE "SOLD OUT" IF STOCK IS 0
          // ✅ THIS IS THE FIX YOU MISSED
          isAvailable: computedAvailability, 
          
          availableTimePeriods: item.available_time_periods || [],
        };
      });

      setMenuItems(items);
    } catch (err) {
      console.error('Error fetching menu items:', err);
      setError('Failed to load menu items');
      setMenuItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [campus?.id]);

  // Load menu items when campus changes
  useEffect(() => {
    fetchMenuItems();
  }, [fetchMenuItems]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!campus?.id) return;

    const channel = supabase
      .channel('menu-items-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'menu_items',
          filter: `campus_id=eq.${campus.id}`,
        },
        () => {
          // Refetch on any change (Stock update, etc.)
          fetchMenuItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campus?.id, fetchMenuItems]);

  const updateItemAvailability = useCallback(async (itemId: string, isAvailable: boolean) => {
    // Optimistic update
    setMenuItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, isAvailable } : item
      )
    );

    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: isAvailable })
        .eq('id', itemId);

      if (error) {
        // Revert on error
        setMenuItems(prev =>
          prev.map(item =>
            item.id === itemId ? { ...item, isAvailable: !isAvailable } : item
          )
        );
        throw error;
      }
    } catch (err) {
      console.error('Error updating item availability:', err);
    }
  }, []);

  const getMenuItem = useCallback((itemId: string) => {
    return menuItems.find(item => item.id === itemId);
  }, [menuItems]);

  const refreshMenu = useCallback(() => {
    fetchMenuItems();
  }, [fetchMenuItems]);

  return (
    <MenuContext.Provider value={{
      menuItems,
      isLoading,
      error,
      updateItemAvailability,
      getMenuItem,
      refreshMenu,
    }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
}