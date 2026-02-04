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
      // Removed artificial delay for faster production feel
      await refreshMenu();
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

  // Filter items based on category and time period
  const filteredItems = menuItems.filter(item => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    
    const matchesTime = currentPeriod 
      ? item.availableTimePeriods.includes(currentPeriod.id)
      : false; 

    // ✅ FIX: REMOVED "&& isAvailable"
    // Now "Sold Out" items (where isAvailable is false) will PASS this filter
    // and show up on the screen with the red badge.
    return matchesCategory && matchesTime;
  });

  // Get popular items
  const popularItems = menuItems.filter(item => {
    if (!item.isPopular) return false;
    
    // Optional: Hide sold out items from the "Popular Slider" to keep it clean
    if (!item.isAvailable) return false; 
    
    if (!currentPeriod) return false; 
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