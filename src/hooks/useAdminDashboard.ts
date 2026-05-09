import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AdminStats {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  todayOrders: number;
}

interface ChartDataPoint {
  day: string;
  revenue: number;
  orders: number;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  isAvailable: boolean;
}

interface UseAdminDashboardReturn {
  stats: AdminStats;
  chartData: ChartDataPoint[];
  menuItems: MenuItem[];
  isLoading: boolean;
  error: string | null;
  timeRange: 'daily' | 'weekly' | 'monthly';
  setTimeRange: (range: 'daily' | 'weekly' | 'monthly') => void;
  refetch: () => Promise<void>;
  toggleItemAvailability: (itemId: string) => Promise<boolean>;
}

// 🦅 GLOBAL GOLDEN FORMULA
const getTrueCanteenRevenue = (o: any) => {
  const rawTotal = Number(o.total) || 0;
  const platFee = Number(o.platform_fee) || 0;
  const discAmt = Number(o.discount_amount) || 0;
  const sponsor = o.discount_sponsor;
  
  let baseEarnings = rawTotal - platFee;
  if (sponsor === 'platform') {
    baseEarnings += discAmt;
  }
  return Math.max(0, baseEarnings);
};

export function useAdminDashboard(): UseAdminDashboardReturn {
  const [stats, setStats] = useState<AdminStats>({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    todayOrders: 0,
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 1. Fetch Real Menu Items
      const { data: menuData, error: menuError } = await supabase
        .from('menu_items')
        .select('*')
        .order('category');

      if (menuError) throw menuError;

      // 2. Fetch Real Orders (Filtering out failed/cancelled/expired)
      // 🦅 THE FIX 1: Fetch actual discount and fee columns instead of the phantom column
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('total, platform_fee, discount_amount, discount_sponsor, created_at')
        .not('status', 'in', '("failed","cancelled","expired","rejected")');

      if (ordersError) throw ordersError;

      // 3. Calculate Live Stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let totalRev = 0;
      let todayOrds = 0;

      ordersData?.forEach(order => {
        const orderDate = new Date(order.created_at);
        // 🦅 THE FIX 2: Calculate using the Golden Formula
        totalRev += getTrueCanteenRevenue(order);
        
        if (orderDate >= today) {
          todayOrds++;
        }
      });

      const totalOrds = ordersData?.length || 0;
      const avgVal = totalOrds > 0 ? Math.round(totalRev / totalOrds) : 0;

      setStats({
        totalRevenue: totalRev,
        totalOrders: totalOrds,
        avgOrderValue: avgVal,
        todayOrders: todayOrds,
      });

      // 4. Generate Live Chart Data (Last 7 Days)
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          dateString: d.toISOString().split('T')[0],
          day: d.toLocaleDateString('en-US', { weekday: 'short' }),
          revenue: 0,
          orders: 0
        };
      });

      ordersData?.forEach(order => {
        const orderDateStr = new Date(order.created_at).toISOString().split('T')[0];
        const dayMatch = last7Days.find(d => d.dateString === orderDateStr);
        if (dayMatch) {
          // 🦅 THE FIX 3: Chart bars use pure compensated revenue
          dayMatch.revenue += getTrueCanteenRevenue(order);
          dayMatch.orders += 1;
        }
      });

      setChartData(last7Days);

      // 5. Update Menu State (Mapping snake_case DB to camelCase UI)
      if (menuData) {
        setMenuItems(menuData.map(item => ({
          id: item.id,
          name: item.name,
          price: Number(item.price),
          category: item.category || 'misc',
          isAvailable: item.is_available ?? true
        })));
      }

    } catch (err) {
      setError('Failed to load live dashboard data. Please check your connection.');
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]); // timeRange kept in dependency array for future expansion

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleItemAvailability = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      // Find the current status so we can flip it
      const itemToToggle = menuItems.find(i => i.id === itemId);
      if (!itemToToggle) return false;
      
      const newStatus = !itemToToggle.isAvailable;

      // The Real Supabase Update
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: newStatus })
        .eq('id', itemId);

      if (error) throw error;
      
      // Update the UI instantly
      setMenuItems(prev => 
        prev.map(item => 
          item.id === itemId 
            ? { ...item, isAvailable: newStatus }
            : item
        )
      );
      
      return true;
    } catch (err) {
      console.error('Error toggling availability:', err);
      return false;
    }
  }, [menuItems]);

  return {
    stats,
    chartData,
    menuItems,
    isLoading,
    error,
    timeRange,
    setTimeRange,
    refetch: fetchData,
    toggleItemAvailability,
  };
}