import { useState, useEffect, useCallback } from 'react';
import { MenuItem, TimePeriod } from '@/types/canteen';
import { useMenu } from '@/context/MenuContext';
import { categories } from '@/data/menuData'; 

interface UseMenuItemsReturn {
  items: MenuItem[]; // RAW DATA FOR OUR BYPASS
  filteredItems: MenuItem[];
  popularItems: MenuItem[];
  categories: typeof categories;
  currentPeriod: TimePeriod | null;
  canteenClosed: boolean;
  nextOpenTime: string | null;
  isLoading: boolean;
  error: string | null;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  refetch: () => Promise<void>;
}

export function useMenuItems(): UseMenuItemsReturn {
  // 1. We pull menuItems (the raw array) and the loading state from Context
  const { menuItems, refreshMenu, isLoading: contextLoading } = useMenu();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await refreshMenu();
    } catch (err) {
      setError('Failed to load menu items. Please try again.');
      console.error('Error fetching menu items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshMenu]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // 2. Global Status Config
  const canteenClosed = false;
  const nextOpenTime = null;
  const currentPeriod = null; 

  // 3. 🔥 THE HOOK FILTER (Safety Net) 🔥
  // Even though Menu.tsx does its own bypass, we keep this clean
  const filteredItems = (menuItems || []).filter(item => {
    if (selectedCategory === 'all') return true;
    
    const itemCategory = (item.category || '').toLowerCase().trim();
    const targetCategory = selectedCategory.toLowerCase().trim();
    
    return itemCategory === targetCategory;
  });

  // 4. Popular Items logic
  const popularItems = (menuItems || []).filter(item => {
    // Treat null/undefined as false for production stability
    const isAvail = item.isAvailable === true || (item as any).is_available === true;
    return item.isPopular && isAvail;
  });

  return {
    items: menuItems || [], // 👈 This is what Menu.tsx uses for the bypass!
    filteredItems,
    popularItems,
    categories,
    currentPeriod,
    canteenClosed,
    nextOpenTime,
    // 🌟 THE LOADING SHIELD: Prevents "No Items" flash while database is thinking
    isLoading: isLoading || contextLoading,
    error,
    selectedCategory,
    setSelectedCategory,
    refetch: fetchItems,
  };
}