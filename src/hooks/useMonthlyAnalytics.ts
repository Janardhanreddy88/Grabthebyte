import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCampus } from '@/context/CampusContext';

interface CategoryStats {
  category: string;
  orders: number;
  revenue: number;
}

interface TopItem { name: string; quantity: number; revenue: number; category: string; }
interface DailyTrend { date: string; day: number; orders: number; revenue: number; }

interface MonthlyAnalytics {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  categoryBreakdown: CategoryStats[];
  topItems: TopItem[];
  dailyTrends: DailyTrend[];
  monthName: string;
  year: number;
  daysCount: number;
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function useMonthlyAnalytics() {
  const { campus } = useCampus();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const query = useQuery({
    queryKey: ['monthly-analytics', campus?.id, selectedMonth.getFullYear(), selectedMonth.getMonth()],
    queryFn: async (): Promise<MonthlyAnalytics> => {
      if (!campus?.id) {
        return { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, categoryBreakdown: [], topItems: [], dailyTrends: [], monthName: '', year: 0, daysCount: 0 };
      }

      const year = selectedMonth.getFullYear();
      const month = selectedMonth.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59);
      const now = new Date();
      const effectiveEnd = monthEnd > now ? now : monthEnd;

      // 🦅 THE FIX 1: Fetch platform_fee, discount_amount, and discount_sponsor!
      const [ordersRes, menuRes] = await Promise.all([
        supabase.from('orders')
          .select('id, total, platform_fee, discount_amount, discount_sponsor, created_at, status, order_items (name, quantity, price, menu_item_id)')
          .eq('campus_id', campus.id)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', effectiveEnd.toISOString()),
        supabase.from('menu_items').select('id, category').eq('campus_id', campus.id),
      ]);

      if (ordersRes.error) throw ordersRes.error;

      const categoryMap: Record<string, string> = {};
      (menuRes.data || []).forEach(item => { categoryMap[item.id] = item.category || 'other'; });

      const paidOrders = (ordersRes.data || []).filter(o => o.status === 'confirmed' || o.status === 'collected');
      const totalOrders = paidOrders.length;
      
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

      // 🦅 THE FIX 3: Calculate the total monthly pure compensated revenue
      const totalRevenue = paidOrders.reduce((sum, o) => sum + getTrueCanteenRevenue(o), 0);
      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

      const catStats: Record<string, { orders: Set<string>; revenue: number }> = {};
      const itemCounts: Record<string, { quantity: number; revenue: number; category: string }> = {};

      paidOrders.forEach(order => {
        (order.order_items || []).forEach((item: any) => {
          const cat = (item.menu_item_id && categoryMap[item.menu_item_id]) || 'other';
          if (!catStats[cat]) catStats[cat] = { orders: new Set(), revenue: 0 };
          catStats[cat].orders.add(order.id);
          catStats[cat].revenue += item.price * item.quantity;

          if (!itemCounts[item.name]) itemCounts[item.name] = { quantity: 0, revenue: 0, category: cat };
          itemCounts[item.name].quantity += item.quantity;
          itemCounts[item.name].revenue += item.price * item.quantity;
        });
      });

      const categoryBreakdown: CategoryStats[] = Object.entries(catStats)
        .map(([cat, stats]) => ({
          category: cat.charAt(0).toUpperCase() + cat.slice(1),
          orders: stats.orders.size,
          revenue: stats.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      const topItems: TopItem[] = Object.entries(itemCounts)
        .map(([name, stats]) => ({ name, quantity: stats.quantity, revenue: stats.revenue, category: stats.category.charAt(0).toUpperCase() + stats.category.slice(1) }))
        .sort((a, b) => b.quantity - a.quantity);

      const daysInMonth = monthEnd.getDate();
      const effectiveDay = monthEnd > now ? now.getDate() : daysInMonth;
      const dailyTrends: DailyTrend[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStart = new Date(year, month, day);
        const dayEnd = new Date(year, month, day, 23, 59, 59);
        const dayOrders = paidOrders.filter(o => { const d = new Date(o.created_at); return d >= dayStart && d <= dayEnd; });
        
        // 🦅 THE FIX 4: Make sure the daily chart bars only show compensated net revenue!
        dailyTrends.push({ 
          date: `${day}`, 
          day, 
          orders: dayOrders.length, 
          revenue: dayOrders.reduce((sum, o) => sum + getTrueCanteenRevenue(o), 0) 
        });
      }

      return {
        totalOrders, totalRevenue, avgOrderValue, categoryBreakdown, topItems, dailyTrends,
        monthName: monthNames[month], year, daysCount: effectiveDay,
      };
    },
    enabled: !!campus?.id,
  });

  // Generate month options for last 12 months
  const monthOptions = (() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      options.push({ value: date.toISOString(), label: `${monthNames[date.getMonth()]} ${date.getFullYear()}` });
    }
    return options;
  })();

  return { ...query, selectedMonth, setSelectedMonth, monthOptions };
}