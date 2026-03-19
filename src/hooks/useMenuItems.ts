import { useState, useEffect, useCallback } from 'react';
import { MenuItem, TimePeriod } from '@/types/canteen';
import { useMenu } from '@/context/MenuContext';
import { categories } from '@/data/menuData'; // We removed the time imports!

interface UseMenuItemsReturn {
  items: MenuItem[];
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
  const { menuItems, refreshMenu } = useMenu();
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

  // 🔥 PLAN A: THE UNIFIED MENU OVERHAUL
  // 1. We tell the UI the canteen is ALWAYS open for browsing. 
  // (If you want a global shut-off switch later, we can add it to the admin panel!)
  const canteenClosed = false;
  const nextOpenTime = null;
  const currentPeriod = null; // Setting this to null safely hides your TimePeriodBanner

  // 2. Filter items ONLY based on the Category Chips. No time restrictions!
  const filteredItems = menuItems.filter(item => {
    // If "All" is selected, show everything. Otherwise, match the category.
    return selectedCategory === 'all' || item.category === selectedCategory;
  });

  // 3. Popular items are simply popular items that are currently in stock.
  const popularItems = menuItems.filter(item => {
    return item.isPopular && item.isAvailable;
  });

  return {
    items: menuItems,
    filteredItems,
    popularItems,
    categories,
    currentPeriod,
    canteenClosed,
    nextOpenTime,
    isLoading,
    error,
    selectedCategory,
    setSelectedCategory,
    refetch: fetchItems,
  };
}