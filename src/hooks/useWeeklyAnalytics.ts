import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCampus } from '@/context/CampusContext';

interface TimePeriodStats {
  period: string;
  orders: number;
  revenue: number;
  percentage: number;
}

interface TopItem {
  name: string;
  quantity: number;
  revenue: number;
}

interface DayStats {
  day: string;
  orders: number;
  revenue: number;
}

interface WeeklyAnalytics {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  periodBreakdown: TimePeriodStats[];
  topItems: TopItem[];
  dailyBreakdown: DayStats[];
  busiestDay: string;
  peakHour: string;
  completionRate: number;
  weekRange: string;
}

// Get time period from hour
const getTimePeriod = (hour: number): string => {
  if (hour >= 7 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snacks';
  if (hour >= 18 && hour < 22) return 'dinner';
  return 'other';
};

const periodNames: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snacks: 'Snacks',
  dinner: 'Dinner',
};

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function useWeeklyAnalytics() {
  const { campus } = useCampus();

  return useQuery({
    queryKey: ['weekly-analytics', campus?.id],
    queryFn: async (): Promise<WeeklyAnalytics> => {
      if (!campus?.id) {
        return {
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          periodBreakdown: [],
          topItems: [],
          dailyBreakdown: [],
          busiestDay: '-',
          peakHour: '-',
          completionRate: 0,
          weekRange: '',
        };
      }

      // Get current week boundaries (Monday to Sunday)
      const now = new Date();
      const currentDay = now.getDay();
      const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
      
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + mondayOffset);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Format week range
      const formatDate = (date: Date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      const weekRange = `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;

      // Fetch orders with items
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id, total, created_at, status,
          order_items (name, quantity, price)
        `)
        .eq('campus_id', campus.id)
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString());

      if (error) throw error;

      const ordersList = orders || [];

      // ✅ FIX: STRICT FILTER FOR REVENUE
      // We only count orders that are PAID (confirmed) or COLLECTED.
      // We ignore 'pending', 'cancelled', and 'failed'.
      const paidOrders = ordersList.filter(o => o.status === 'confirmed' || o.status === 'collected');
      const collectedOrders = ordersList.filter(o => o.status === 'collected');

      // Calculate totals based on PAID orders
      const totalOrders = paidOrders.length;
      const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
      
      // Completion rate = Collected / Total Paid
      const completionRate = paidOrders.length > 0 
        ? Math.round((collectedOrders.length / paidOrders.length) * 100) 
        : 0;

      // Period breakdown
      const periodStats: Record<string, { orders: number; revenue: number }> = {
        breakfast: { orders: 0, revenue: 0 },
        lunch: { orders: 0, revenue: 0 },
        snacks: { orders: 0, revenue: 0 },
        dinner: { orders: 0, revenue: 0 },
      };

      // Hour counts for peak hour
      const hourCounts: Record<number, number> = {};

      // Daily breakdown
      const dailyStats: Record<number, { orders: number; revenue: number }> = {};
      for (let i = 0; i < 7; i++) {
        dailyStats[i] = { orders: 0, revenue: 0 };
      }

      // Item counts for top items
      const itemCounts: Record<string, { quantity: number; revenue: number }> = {};

      // ✅ FIX: Iterate only over PAID orders for all charts
      paidOrders.forEach(order => {
        const orderDate = new Date(order.created_at);
        const hour = orderDate.getHours();
        const dayOfWeek = orderDate.getDay();
        const period = getTimePeriod(hour);

        // Period stats
        if (periodStats[period]) {
          periodStats[period].orders += 1;
          periodStats[period].revenue += Number(order.total);
        }

        // Hour counts
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;

        // Daily stats
        dailyStats[dayOfWeek].orders += 1;
        dailyStats[dayOfWeek].revenue += Number(order.total);

        // Item counts
        (order.order_items || []).forEach((item: { name: string; quantity: number; price: number }) => {
          if (!itemCounts[item.name]) {
            itemCounts[item.name] = { quantity: 0, revenue: 0 };
          }
          itemCounts[item.name].quantity += item.quantity;
          itemCounts[item.name].revenue += item.price * item.quantity;
        });
      });

      // Format period breakdown with percentages
      const periodBreakdown: TimePeriodStats[] = ['breakfast', 'lunch', 'snacks', 'dinner'].map(period => ({
        period: periodNames[period],
        orders: periodStats[period].orders,
        revenue: periodStats[period].revenue,
        percentage: totalOrders > 0 ? Math.round((periodStats[period].orders / totalOrders) * 100) : 0,
      }));

      // Top 5 items
      const topItems: TopItem[] = Object.entries(itemCounts)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // Daily breakdown sorted Mon-Sun
      const dailyBreakdown: DayStats[] = [1, 2, 3, 4, 5, 6, 0].map(day => ({
        day: shortDayNames[day],
        orders: dailyStats[day].orders,
        revenue: dailyStats[day].revenue,
      }));

      // Busiest day
      let busiestDayIdx = 0;
      let maxOrders = 0;
      Object.entries(dailyStats).forEach(([day, stats]) => {
        if (stats.orders > maxOrders) {
          maxOrders = stats.orders;
          busiestDayIdx = parseInt(day);
        }
      });
      const busiestDay = maxOrders > 0 ? dayNames[busiestDayIdx] : '-';

      // Peak hour
      let peakHourVal = 0;
      let peakHourCount = 0;
      Object.entries(hourCounts).forEach(([hour, count]) => {
        if (count > peakHourCount) {
          peakHourCount = count;
          peakHourVal = parseInt(hour);
        }
      });
      const formatHour = (hour: number) => {
        const suffix = hour >= 12 ? 'PM' : 'AM';
        const h = hour % 12 || 12;
        return `${h}:00 ${suffix}`;
      };
      const peakHour = peakHourCount > 0 ? formatHour(peakHourVal) : '-';

      return {
        totalOrders,
        totalRevenue,
        avgOrderValue,
        periodBreakdown,
        topItems,
        dailyBreakdown,
        busiestDay,
        peakHour,
        completionRate,
        weekRange,
      };
    },
    enabled: !!campus?.id,
  });
}