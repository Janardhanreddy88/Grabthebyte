import { useState, useEffect, useCallback } from 'react';
import { MenuItem, TimePeriod } from '@/types/canteen';
import { useMenu } from '@/context/MenuContext';
import { getCurrentTimePeriod, categories, timePeriods } from '@/data/menuData';

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

  // Check if an item is marked as "all day" (has all 4 time periods including dinner)
  const isAllDayItem = (item: MenuItem) => {
    const allPeriods = ['breakfast', 'lunch', 'snacks', 'dinner'];
    return allPeriods.every(p => item.availableTimePeriods.includes(p));
  };

  // Determine if canteen is closed (but all-day items still show)
  const hasAllDayItems = menuItems.some(isAllDayItem);
  const canteenClosed = !currentPeriod && !hasAllDayItems;

  // Compute next opening time
  const getNextOpenTime = (): string | null => {
    if (!canteenClosed) return null;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    // Find the next period that starts after now
    const upcoming = timePeriods
      .filter(p => p.startHour * 60 + p.startMinute > currentMinutes)
      .sort((a, b) => (a.startHour * 60 + a.startMinute) - (b.startHour * 60 + b.startMinute));
    const next = upcoming.length > 0 ? upcoming[0] : timePeriods[0]; // wrap to first period tomorrow
    const h = next.startHour % 12 || 12;
    const m = next.startMinute.toString().padStart(2, '0');
    const ampm = next.startHour < 12 ? 'AM' : 'PM';
    const label = upcoming.length > 0 ? 'today' : 'tomorrow';
    return `${next.name} at ${h}:${m} ${ampm} ${label}`;
  };
  const nextOpenTime = getNextOpenTime();

  // Filter items based on category and current time period
  const filteredItems = canteenClosed
    ? [] // Hide all items when canteen is closed
    : menuItems.filter(item => {
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        const matchesTime = currentPeriod
          ? item.availableTimePeriods.includes(currentPeriod.id)
          : true;
        return matchesCategory && matchesTime;
      });

  // Get popular items for current time period
  const popularItems = menuItems.filter(item => {
    if (!item.isPopular) return false;
    if (!item.isAvailable) return false;
    // If a time period is active, only show popular items for that period
    if (currentPeriod) return item.availableTimePeriods.includes(currentPeriod.id);
    return true;
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