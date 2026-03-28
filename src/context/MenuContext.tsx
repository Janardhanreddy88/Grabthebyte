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

  const fetchMenuItems = useCallback(async () => {
    if (!campus?.id) {
      setMenuItems([]);
      setIsLoading(false);
      return;
    }

    const cacheKey = `menu_cache_${campus.id}`;

    // 1. CACHE LOAD
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      try {
        setMenuItems(JSON.parse(cachedData));
        setIsLoading(false);
      } catch (e) {
        console.error("Failed to parse cached menu");
      }
    } else {
      setIsLoading(true); 
    }

    // 2. OFFLINE SHIELD
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsLoading(false);
      return; 
    }

    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('menu_items')
        .select('*')
        .eq('campus_id', campus.id)
        .order('name');

      if (fetchError) throw fetchError;

      // 🔥 THE SANITIZER: This forces the database data into perfect shapes!
      const items: MenuItem[] = (data || []).map(item => {
        return {
          id: item.id,
          name: item.name,
          description: item.description || '',
          price: Number(item.price),
          image: item.image_url || '/placeholder.svg',
          category: item.category ? String(item.category).toLowerCase().trim() : 'uncategorized',
          isVeg: Boolean(item.is_veg),
          isPopular: Boolean(item.is_popular),
          quantity: Number(item.stock_quantity || 0),
          isAvailable: item.is_available === true, 
        };
      });
        };
      });

      setMenuItems(items);
      localStorage.setItem(cacheKey, JSON.stringify(items));

    } catch (err) {
      console.error("Menu sync failed, relying on cache.", err);
    } finally {
      setIsLoading(false);
    }
  }, [campus?.id]);

  useEffect(() => {
    fetchMenuItems();
  }, [fetchMenuItems]);

  useEffect(() => {
    const handleOnline = () => {
      fetchMenuItems();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchMenuItems]);

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
          fetchMenuItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campus?.id, fetchMenuItems]);

  const updateItemAvailability = useCallback(async (itemId: string, isAvailable: boolean) => {
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
        setMenuItems(prev =>
          prev.map(item =>
            item.id === itemId ? { ...item, isAvailable: !isAvailable } : item
          )
        );
        throw error;
      }
      
      const cacheKey = `menu_cache_${campus?.id}`;
      const currentCache = localStorage.getItem(cacheKey);
      if(currentCache) {
          const parsedCache: MenuItem[] = JSON.parse(currentCache);
          const updatedCache = parsedCache.map(i => i.id === itemId ? { ...i, isAvailable } : i);
          localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
      }
    } catch {
      // Reversion handled
    }
  }, [campus?.id]);

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