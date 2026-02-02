import { useState, useEffect, useCallback } from 'react';
import { MenuItem, TimePeriod } from '@/types/canteen';
import { useMenu } from '@/context/MenuContext';
import { getCurrentTimePeriod, categories } from '@/data/menuData';

interface UseMenuItemsReturn {
  items: MenuItem[];
  filteredItems: MenuItem[];
  popularItems: MenuItem[];
  categories: typeof categories;
  currentPeriod: TimePeriod | null;
  isLoading: boolean;
  error: string | null;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching and filtering menu items
 * Uses global MenuContext for real-time availability updates
 */
export function useMenuItems(): UseMenuItemsReturn {
  const { menuItems, refreshMenu } = useMenu();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentPeriod, setCurrentPeriod] = useState<TimePeriod | null>(null);

  const fetchItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      refreshMenu();
      setCurrentPeriod(getCurrentTimePeriod());
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

  // Update time period every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPeriod(getCurrentTimePeriod());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Filter items based on category, time period, AND availability
  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    // If no current period (outside all time slots), only show items that have no time restrictions
    // OR if current period exists, check if item is available in that period
    const matchesTime = currentPeriod 
      ? item.availableTimePeriods.includes(currentPeriod.id)
      : false; // Hide all items when outside operational hours
    const isAvailable = item.isAvailable; // Only show available items
    return matchesCategory && matchesTime && isAvailable;
  });

  // Get popular items for current time period (only available ones)
  const popularItems = menuItems.filter(item => {
    if (!item.isPopular || !item.isAvailable) return false;
    if (!currentPeriod) return false; // Hide popular items when outside operational hours
    return item.availableTimePeriods.includes(currentPeriod.id);
  });

  return {
    items: menuItems,
    filteredItems,
    popularItems,
    categories,
    currentPeriod,
    isLoading,
    error,
    selectedCategory,
    setSelectedCategory,
    refetch: fetchItems,
  };
}
