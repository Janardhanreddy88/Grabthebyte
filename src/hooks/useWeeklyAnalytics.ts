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
interface DayStats {
  day: string;
  date: string;
  orders: number;
  revenue: number;
  items: number;
  lastWeekRevenue: number;
  diffPercent: number;
  isFuture: boolean;
  isToday: boolean;
}

interface WeeklyAnalytics {
  totalOrders: number;
  totalRevenue: number;
  totalItemsSold: number;
  avgOrderValue: number;
  avgRevenuePerDay: number;
  categoryBreakdown: CategoryStats[];
  topItems: TopItem[];
  dailyBreakdown: DayStats[];
  busiestDay: string;
  peakHour: string;
  completionRate: number;
  weekRange: string;
  weeklyGrowth: number;
  daysElapsed: number;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function useWeeklyAnalytics() {
  const { campus } = useCampus();

  return useQuery({
    queryKey: ['weekly-analytics', campus?.id],
    queryFn: async (): Promise<WeeklyAnalytics> => {
      if (!campus?.id) {
        return { totalOrders: 0, totalRevenue: 0, totalItemsSold: 0, avgOrderValue: 0, avgRevenuePerDay: 0, categoryBreakdown: [], topItems: [], dailyBreakdown: [], busiestDay: '-', peakHour: '-', completionRate: 0, weekRange: '', weeklyGrowth: 0, daysElapsed: 0 };
      }

      const now = new Date();
      const currentDay = now.getDay();
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
      const weekStart = new Date(now); weekStart.setDate(now.getDate() + mondayOffset); weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23, 59, 59, 999);

      // Last week range
      const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(weekEnd); lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

      const formatDate = (date: Date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const weekRange = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;

      // 🦅 THE FIX 1: Fetch platform_fee, discount_amount, and discount_sponsor in BOTH queries
      const [thisWeekRes, lastWeekRes, menuRes] = await Promise.all([
        supabase.from('orders').select('id, total, platform_fee, discount_amount, discount_sponsor, created_at, status, order_items (name, quantity, price, menu_item_id)')
          .eq('campus_id', campus.id).gte('created_at', weekStart.toISOString()).lte('created_at', weekEnd.toISOString()),
        supabase.from('orders').select('id, total, platform_fee, discount_amount, discount_sponsor, created_at, status')
          .eq('campus_id', campus.id).gte('created_at', lastWeekStart.toISOString()).lte('created_at', lastWeekEnd.toISOString()),
        supabase.from('menu_items').select('id, category').eq('campus_id', campus.id),
      ]);

      if (thisWeekRes.error) throw thisWeekRes.error;

      const categoryMap: Record<string, string> = {};
      (menuRes.data || []).forEach(item => { categoryMap[item.id] = item.category || 'other'; });

      const ordersList = thisWeekRes.data || [];
      const lastWeekOrders = (lastWeekRes.data || []).filter(o => o.status === 'confirmed' || o.status === 'collected');
      const paidOrders = ordersList.filter(o => o.status === 'confirmed' || o.status === 'collected');
      const collectedOrders = ordersList.filter(o => o.status === 'collected');

      // 🦅 THE FIX 2: The Golden Canteen Compensation Formula
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

      const totalOrders = paidOrders.length;
      
      // 🦅 THE FIX 3: Calculate this week's exact compensated revenue
      const totalRevenue = paidOrders.reduce((sum, o) => sum + getTrueCanteenRevenue(o), 0);
      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
      const completionRate = paidOrders.length > 0 ? Math.round((collectedOrders.length / paidOrders.length) * 100) : 0;

      // 🦅 THE FIX 4: Calculate last week's exact compensated revenue
      const lastWeekTotalRevenue = lastWeekOrders.reduce((sum, o) => sum + getTrueCanteenRevenue(o), 0);
      const weeklyGrowth = lastWeekTotalRevenue > 0
        ? Math.round(((totalRevenue - lastWeekTotalRevenue) / lastWeekTotalRevenue) * 100 * 10) / 10
        : 0;

      // 🦅 THE FIX 5: Build last week's daily revenue map safely with true math
      const lastWeekDailyRevenue: Record<number, number> = {};
      lastWeekOrders.forEach(o => {
        const d = new Date(o.created_at).getDay();
        lastWeekDailyRevenue[d] = (lastWeekDailyRevenue[d] || 0) + getTrueCanteenRevenue(o);
      });

      const catStats: Record<string, { orders: Set<string>; revenue: number }> = {};
      const hourCounts: Record<number, number> = {};
      const dailyStats: Record<number, { orders: number; revenue: number; items: number }> = {};
      for (let i = 0; i < 7; i++) dailyStats[i] = { orders: 0, revenue: 0, items: 0 };
      const itemCounts: Record<string, { quantity: number; revenue: number }> = {};
      let totalItemsSold = 0;

      paidOrders.forEach(order => {
        const orderDate = new Date(order.created_at);
        const hour = orderDate.getHours();
        const dayOfWeek = orderDate.getDay();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        dailyStats[dayOfWeek].orders += 1;
        
        // 🦅 THE FIX 6: Daily chart bars now reflect the pure compensated revenue!
        dailyStats[dayOfWeek].revenue += getTrueCanteenRevenue(order);

        (order.order_items || []).forEach((item: any) => {
          const cat = (item.menu_item_id && categoryMap[item.menu_item_id]) || 'other';
          if (!catStats[cat]) catStats[cat] = { orders: new Set(), revenue: 0 };
          catStats[cat].orders.add(order.id);
          catStats[cat].revenue += item.price * item.quantity;

          if (!itemCounts[item.name]) itemCounts[item.name] = { quantity: 0, revenue: 0 };
          itemCounts[item.name].quantity += item.quantity;
          itemCounts[item.name].revenue += item.price * item.quantity;

          totalItemsSold += item.quantity;
          dailyStats[dayOfWeek].items += item.quantity;
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

      // Build daily breakdown with last week comparison
      const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
      const dailyBreakdown: DayStats[] = dayOrder.map(dayIdx => {
        const dayDate = new Date(weekStart);
        const offset = dayIdx === 0 ? 6 : dayIdx - 1; // Mon=0 offset, Sun=6 offset
        dayDate.setDate(weekStart.getDate() + offset);

        const isFuture = dayDate > now;
        const isToday = dayDate.toDateString() === now.toDateString();
        const lastWkRev = lastWeekDailyRevenue[dayIdx] || 0;
        const thisRev = dailyStats[dayIdx].revenue;
        const diffPercent = lastWkRev > 0 ? Math.round(((thisRev - lastWkRev) / lastWkRev) * 100) : 0;

        return {
          day: shortDayNames[dayIdx],
          date: formatDate(dayDate),
          orders: isFuture ? 0 : dailyStats[dayIdx].orders,
          revenue: isFuture ? 0 : thisRev,
          items: isFuture ? 0 : dailyStats[dayIdx].items,
          lastWeekRevenue: lastWkRev,
          diffPercent: isFuture ? 0 : diffPercent,
          isFuture,
          isToday,
        };
      });

      let busiestDayIdx = 0, maxOrders = 0;
      Object.entries(dailyStats).forEach(([day, stats]) => { if (stats.orders > maxOrders) { maxOrders = stats.orders; busiestDayIdx = parseInt(day); } });

      let peakHourVal = 0, peakHourCount = 0;
      Object.entries(hourCounts).forEach(([hour, count]) => { if (count > peakHourCount) { peakHourCount = count; peakHourVal = parseInt(hour); } });
      const formatHour = (hour: number) => { const s = hour >= 12 ? 'PM' : 'AM'; return `${hour % 12 || 12}:00 ${s}`; };

      const daysElapsed = dailyBreakdown.filter(d => !d.isFuture).length;
      const avgRevenuePerDay = daysElapsed > 0 ? Math.round(totalRevenue / daysElapsed) : 0;

      return {
        totalOrders, totalRevenue, totalItemsSold, avgOrderValue, avgRevenuePerDay,
        categoryBreakdown, topItems, dailyBreakdown,
        busiestDay: maxOrders > 0 ? dayNames[busiestDayIdx] : '-',
        peakHour: peakHourCount > 0 ? formatHour(peakHourVal) : '-',
        completionRate, weekRange, weeklyGrowth, daysElapsed,
      };
    },
    enabled: !!campus?.id,
  });
}