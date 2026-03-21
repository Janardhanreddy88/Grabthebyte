import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCampus } from '@/context/CampusContext';

interface CategoryStats {
  category: string;
  orders: number;
  revenue: number;
  percentage: number;
}

interface TopItem { name: string; quantity: number; revenue: number; }
interface DayStats { day: string; orders: number; revenue: number; }

interface WeeklyAnalytics {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  categoryBreakdown: CategoryStats[];
  topItems: TopItem[];
  dailyBreakdown: DayStats[];
  busiestDay: string;
  peakHour: string;
  completionRate: number;
  weekRange: string;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function useWeeklyAnalytics() {
  const { campus } = useCampus();

  return useQuery({
    queryKey: ['weekly-analytics', campus?.id],
    queryFn: async (): Promise<WeeklyAnalytics> => {
      if (!campus?.id) {
        return { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, categoryBreakdown: [], topItems: [], dailyBreakdown: [], busiestDay: '-', peakHour: '-', completionRate: 0, weekRange: '' };
      }

      const now = new Date();
      const currentDay = now.getDay();
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
      const weekStart = new Date(now); weekStart.setDate(now.getDate() + mondayOffset); weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23, 59, 59, 999);
      const formatDate = (date: Date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const weekRange = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;

      const { data: orders, error } = await supabase
        .from('orders')
        .select(`id, total, created_at, status, order_items (name, quantity, price, menu_item_id)`)
        .eq('campus_id', campus.id)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString());

      if (error) throw error;

      const { data: menuItems } = await supabase.from('menu_items').select('id, category').eq('campus_id', campus.id);
      const categoryMap: Record<string, string> = {};
      (menuItems || []).forEach(item => { categoryMap[item.id] = item.category || 'other'; });

      const ordersList = orders || [];
      const paidOrders = ordersList.filter(o => o.status === 'confirmed' || o.status === 'collected');
      const collectedOrders = ordersList.filter(o => o.status === 'collected');

      const totalOrders = paidOrders.length;
      const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
      const completionRate = paidOrders.length > 0 ? Math.round((collectedOrders.length / paidOrders.length) * 100) : 0;

      const catStats: Record<string, { orders: Set<string>; revenue: number }> = {};
      const hourCounts: Record<number, number> = {};
      const dailyStats: Record<number, { orders: number; revenue: number }> = {};
      for (let i = 0; i < 7; i++) dailyStats[i] = { orders: 0, revenue: 0 };
      const itemCounts: Record<string, { quantity: number; revenue: number }> = {};

      paidOrders.forEach(order => {
        const orderDate = new Date(order.created_at);
        const hour = orderDate.getHours();
        const dayOfWeek = orderDate.getDay();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dailyStats[dayOfWeek].orders += 1;
        dailyStats[dayOfWeek].revenue += Number(order.total);

        (order.order_items || []).forEach((item: any) => {
          const cat = (item.menu_item_id && categoryMap[item.menu_item_id]) || 'other';
          if (!catStats[cat]) catStats[cat] = { orders: new Set(), revenue: 0 };
          catStats[cat].orders.add(order.id);
          catStats[cat].revenue += item.price * item.quantity;

          if (!itemCounts[item.name]) itemCounts[item.name] = { quantity: 0, revenue: 0 };
          itemCounts[item.name].quantity += item.quantity;
          itemCounts[item.name].revenue += item.price * item.quantity;
        });
      });

      const totalItemRevenue = Object.values(catStats).reduce((s, c) => s + c.revenue, 0);
      const categoryBreakdown: CategoryStats[] = Object.entries(catStats)
        .map(([cat, stats]) => ({
          category: cat.charAt(0).toUpperCase() + cat.slice(1),
          orders: stats.orders.size,
          revenue: stats.revenue,
          percentage: totalItemRevenue > 0 ? Math.round((stats.revenue / totalItemRevenue) * 100) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      const topItems = Object.entries(itemCounts).map(([name, stats]) => ({ name, ...stats })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
      const dailyBreakdown: DayStats[] = [1, 2, 3, 4, 5, 6, 0].map(day => ({ day: shortDayNames[day], orders: dailyStats[day].orders, revenue: dailyStats[day].revenue }));

      let busiestDayIdx = 0, maxOrders = 0;
      Object.entries(dailyStats).forEach(([day, stats]) => { if (stats.orders > maxOrders) { maxOrders = stats.orders; busiestDayIdx = parseInt(day); } });

      let peakHourVal = 0, peakHourCount = 0;
      Object.entries(hourCounts).forEach(([hour, count]) => { if (count > peakHourCount) { peakHourCount = count; peakHourVal = parseInt(hour); } });
      const formatHour = (hour: number) => { const s = hour >= 12 ? 'PM' : 'AM'; return `${hour % 12 || 12}:00 ${s}`; };

      return {
        totalOrders, totalRevenue, avgOrderValue, categoryBreakdown, topItems, dailyBreakdown,
        busiestDay: maxOrders > 0 ? dayNames[busiestDayIdx] : '-',
        peakHour: peakHourCount > 0 ? formatHour(peakHourVal) : '-',
        completionRate, weekRange,
      };
    },
    enabled: !!campus?.id,
  });
}
