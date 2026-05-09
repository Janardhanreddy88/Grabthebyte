import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCampus } from '@/context/CampusContext';
import { useState } from 'react';

interface CategoryStats {
  category: string;
  orders: number;
  revenue: number;
  percentage: number;
}

interface TopItem {
  name: string;
  quantity: number;
  revenue: number;
}

interface HourlyData {
  hour: string;
  orders: number;
  revenue: number;
}

interface CategoryOrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface CategoryOrder {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
  customerName: string;
  items: CategoryOrderItem[];
}

interface TodayAnalytics {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  categoryBreakdown: CategoryStats[];
  topItems: TopItem[];
  hourlyData: HourlyData[];
  peakHour: string;
  completionRate: number;
  pendingOrders: number;
  confirmedOrders: number;
  activeOrders: number;
  collectedOrders: number;
  dateString: string;
  categoryOrders: Record<string, CategoryOrder[]>;
}

const formatHour = (hour: number) => {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}${suffix}`;
};

export function useTodayAnalytics() {
  const { campus } = useCampus();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const query = useQuery({
    queryKey: ['today-analytics', campus?.id, selectedDate.toDateString()],
    queryFn: async (): Promise<TodayAnalytics> => {
      const dateString = selectedDate.toLocaleDateString('en-IN', { 
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
      });

      const createDefaultData = (): TodayAnalytics => ({
        totalOrders: 0, totalRevenue: 0, avgOrderValue: 0,
        categoryBreakdown: [], topItems: [], hourlyData: [],
        peakHour: '-', completionRate: 0, pendingOrders: 0,
        confirmedOrders: 0, activeOrders: 0, collectedOrders: 0, dateString,
        categoryOrders: {},
      });

      if (!campus?.id) return createDefaultData();

      const dayStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      const dayEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 23, 59, 59);

      // 🦅 THE FIX 1: Fetching platform_fee, discount_amount, and discount_sponsor!
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id, total, platform_fee, discount_amount, discount_sponsor, created_at, status, order_number, customer_name,
          order_items (name, quantity, price, menu_item_id)
        `)
        .eq('campus_id', campus.id)
        .gte('created_at', dayStart.toISOString())
        .lte('created_at', dayEnd.toISOString());

      if (error) { console.error('Error fetching analytics:', error); return createDefaultData(); }

      const { data: menuItems } = await supabase
        .from('menu_items')
        .select('id, category')
        .eq('campus_id', campus.id);

      const categoryMap: Record<string, string> = {};
      (menuItems || []).forEach(item => {
        categoryMap[item.id] = item.category || 'other';
      });

      const ordersList = orders || [];
      const paidOrders = ordersList.filter(o => o.status === 'confirmed' || o.status === 'collected');
      const collectedOrdersList = ordersList.filter(o => o.status === 'collected');

      // 🦅 THE FIX 2: Bulletproof Net Revenue Calculation
      const getTrueCanteenRevenue = (o: any) => {
        const rawTotal = Number(o.total) || 0;
        const platFee = Number(o.platform_fee) || 0;
        const discAmt = Number(o.discount_amount) || 0;
        const sponsor = o.discount_sponsor;
        
        // Start with what the student paid minus GrabTheByte's fee
        let baseEarnings = rawTotal - platFee;
        
        // If GrabTheByte sponsored the code, we ADD the money back to the canteen's payout!
        if (sponsor === 'platform') {
          baseEarnings += discAmt;
        }
        
        return Math.max(0, baseEarnings);
      };

      const totalOrders = paidOrders.length;
      
      // 🦅 THE FIX 3: Big Green Box now uses the true compensation math!
      const totalRevenue = paidOrders.reduce((sum, o) => sum + getTrueCanteenRevenue(o), 0);
      
      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
      const completionRate = paidOrders.length > 0 
        ? Math.round((collectedOrdersList.length / paidOrders.length) * 100) : 0;

      const pendingOrders = ordersList.filter(o => o.status === 'pending').length;
      const confirmedOrders = ordersList.filter(o => o.status === 'confirmed').length;

      const catStats: Record<string, { orders: Set<string>; revenue: number; itemCount: number }> = {};
      const hourCounts: Record<number, { orders: number; revenue: number }> = {};
      for (let h = 7; h <= 22; h++) hourCounts[h] = { orders: 0, revenue: 0 };
      const itemCounts: Record<string, { quantity: number; revenue: number }> = {};
      const categoryOrders: Record<string, CategoryOrder[]> = {};

      paidOrders.forEach(order => {
        const orderDate = new Date(order.created_at);
        const hour = orderDate.getHours();
        
        // 🦅 THE FIX 4: Hourly chart now maps to true compensated earnings
        if (hourCounts[hour]) {
          hourCounts[hour].orders += 1;
          hourCounts[hour].revenue += getTrueCanteenRevenue(order);
        }

        const items = order.order_items as Array<{ name: string; quantity: number; price: number; menu_item_id: string | null }> || [];
        const orderCategories = new Set<string>();

        items.forEach(item => {
          const cat = (item.menu_item_id && categoryMap[item.menu_item_id]) || 'other';
          const catKey = cat.charAt(0).toUpperCase() + cat.slice(1);
          orderCategories.add(catKey);

          if (!catStats[cat]) catStats[cat] = { orders: new Set(), revenue: 0, itemCount: 0 };
          catStats[cat].orders.add(order.id);
          catStats[cat].revenue += item.price * item.quantity; // Gross item value
          catStats[cat].itemCount += item.quantity;

          if (!itemCounts[item.name]) itemCounts[item.name] = { quantity: 0, revenue: 0 };
          itemCounts[item.name].quantity += item.quantity;
          itemCounts[item.name].revenue += item.price * item.quantity;
        });

        orderCategories.forEach(catKey => {
          if (!categoryOrders[catKey]) categoryOrders[catKey] = [];
          const catItems = items.filter(item => {
            const cat = (item.menu_item_id && categoryMap[item.menu_item_id]) || 'other';
            return (cat.charAt(0).toUpperCase() + cat.slice(1)) === catKey;
          });
          categoryOrders[catKey].push({
            id: order.id,
            orderNumber: order.order_number,
            // 🦅 THE FIX 5: Specific order lists now show compensated net revenue
            total: getTrueCanteenRevenue(order),
            status: order.status,
            createdAt: order.created_at,
            customerName: order.customer_name || 'Guest',
            items: catItems.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
          });
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

      const topItems = Object.entries(itemCounts)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      const hourlyData: HourlyData[] = [];
      for (let h = 7; h <= 21; h++) {
        hourlyData.push({ hour: formatHour(h), orders: hourCounts[h]?.orders || 0, revenue: hourCounts[h]?.revenue || 0 });
      }

      let peakHourVal = 0, peakHourCount = 0;
      Object.entries(hourCounts).forEach(([hour, stats]) => {
        if (stats.orders > peakHourCount) { peakHourCount = stats.orders; peakHourVal = parseInt(hour); }
      });

      return {
        totalOrders, totalRevenue, avgOrderValue, categoryBreakdown,
        topItems, hourlyData, peakHour: peakHourCount > 0 ? formatHour(peakHourVal) : '-',
        completionRate, pendingOrders, confirmedOrders, activeOrders: confirmedOrders,
        collectedOrders: collectedOrdersList.length, dateString,
        categoryOrders,
      };
    },
    enabled: !!campus?.id,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  return { ...query, selectedDate, setSelectedDate };
}