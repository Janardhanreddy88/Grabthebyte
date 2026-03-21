import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCampus } from '@/context/CampusContext';

interface CategoryStats {
  category: string;
  orders: number;
  revenue: number;
}

interface DailyTrend { date: string; day: number; orders: number; revenue: number; }

interface MonthlyAnalytics {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  categoryBreakdown: CategoryStats[];
  dailyTrends: DailyTrend[];
  monthName: string;
  year: number;
}

export function useMonthlyAnalytics() {
  const { campus } = useCampus();

  return useQuery({
    queryKey: ['monthly-analytics', campus?.id],
    queryFn: async (): Promise<MonthlyAnalytics> => {
      if (!campus?.id) {
        return { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, categoryBreakdown: [], dailyTrends: [], monthName: '', year: 0 };
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, total, created_at, status, order_items (name, quantity, price, menu_item_id)')
        .eq('campus_id', campus.id)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      if (error) throw error;

      const { data: menuItems } = await supabase.from('menu_items').select('id, category').eq('campus_id', campus.id);
      const categoryMap: Record<string, string> = {};
      (menuItems || []).forEach(item => { categoryMap[item.id] = item.category || 'other'; });

      const paidOrders = (orders || []).filter(o => o.status === 'confirmed' || o.status === 'collected');
      const totalOrders = paidOrders.length;
      const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

      const catStats: Record<string, { orders: Set<string>; revenue: number }> = {};

      paidOrders.forEach(order => {
        (order.order_items || []).forEach((item: any) => {
          const cat = (item.menu_item_id && categoryMap[item.menu_item_id]) || 'other';
          if (!catStats[cat]) catStats[cat] = { orders: new Set(), revenue: 0 };
          catStats[cat].orders.add(order.id);
          catStats[cat].revenue += item.price * item.quantity;
        });
      });

      const categoryBreakdown: CategoryStats[] = Object.entries(catStats)
        .map(([cat, stats]) => ({
          category: cat.charAt(0).toUpperCase() + cat.slice(1),
          orders: stats.orders.size,
          revenue: stats.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      const daysInMonth = monthEnd.getDate();
      const dailyTrends: DailyTrend[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStart = new Date(now.getFullYear(), now.getMonth(), day);
        const dayEnd = new Date(now.getFullYear(), now.getMonth(), day, 23, 59, 59);
        const dayOrders = paidOrders.filter(o => { const d = new Date(o.created_at); return d >= dayStart && d <= dayEnd; });
        dailyTrends.push({ date: `${day}`, day, orders: dayOrders.length, revenue: dayOrders.reduce((sum, o) => sum + Number(o.total), 0) });
      }

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

      return { totalOrders, totalRevenue, avgOrderValue, categoryBreakdown, dailyTrends, monthName: monthNames[now.getMonth()], year: now.getFullYear() };
    },
    enabled: !!campus?.id,
  });
}
