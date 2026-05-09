import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCampus } from '@/context/CampusContext';
import { z } from 'zod';

// Validation schemas
const menuItemCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long').trim(),
  price: z.number().positive('Price must be positive').max(999999, 'Price too high'),
  quantity: z.number().int().nonnegative().max(9999).optional(),
  category: z.string().max(100).optional(),
  image: z.string().url().max(2048).optional().or(z.literal('')),
  is_veg: z.boolean().optional(),
  is_popular: z.boolean().optional(),
  is_available: z.boolean().optional(),
  description: z.string().max(1000).optional(),
});

const menuItemUpdateSchema = z.object({
  id: z.string().uuid('Invalid item ID'),
  name: z.string().min(1).max(200).trim().optional(),
  price: z.number().positive().max(999999).optional(),
  quantity: z.number().int().nonnegative().max(9999).optional(),
  category: z.string().max(100).optional(),
  image: z.string().url().max(2048).optional().or(z.literal('')),
  is_veg: z.boolean().optional(),
  is_popular: z.boolean().optional(),
  is_available: z.boolean().optional(),
  description: z.string().max(1000).optional(),
});

// 🌟 UPDATED: Added new database statuses
const orderStatusSchema = z.enum(['pending', 'confirmed', 'collected', 'expired', 'failed', 'cancelled', 'rejected', 'refunded']);

// Types matching Supabase schema
interface MenuItem {
  id: string;
  campus_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_veg: boolean;
  is_popular: boolean;
  is_available: boolean;
  stock_quantity: number | null;
  created_at: string;
  updated_at: string;
}

interface Order {
  id: string;
  campus_id: string;
  user_id: string | null;
  order_number: string;
  status: 'pending' | 'confirmed' | 'collected' | 'expired' | 'failed' | 'cancelled' | 'rejected' | 'refunded';
  total: number;
  // 🦅 THE FIX 1: Removed phantom column, added real financial columns
  platform_fee: number | null;
  discount_amount: number | null;
  discount_sponsor: string | null;
  qr_code: string | null;
  is_used: boolean;
  customer_name: string | null;
  customer_email: string | null;
  payment_method: string | null;
  payment_status: string | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface OrderWithItems extends Order {
  order_items: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];
}

interface OrderStats {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  todayOrders: number;
  chartData: { day: string; revenue: number; orders: number }[];
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

// Fetch menu items for the current campus
export function useAdminMenuItems() {
  const { campus } = useCampus();

  return useQuery({
    queryKey: ['admin-menu-items', campus?.id],
    queryFn: async () => {
      if (!campus?.id) return [];

      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('campus_id', campus.id)
        .order('name');

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        quantity: item.stock_quantity ?? 0,
        category: item.category || 'snacks',
        image: item.image_url,
        is_veg: item.is_veg,
        is_popular: item.is_popular,
        is_available: item.is_available,
        description: item.description,
      }));
    },
    enabled: !!campus?.id,
  });
}

// Create a new menu item
export function useCreateMenuItem() {
  const queryClient = useQueryClient();
  const { campus } = useCampus();

  return useMutation({
    mutationFn: async (item: {
      name: string;
      price: number;
      quantity?: number;
      category?: string;
      image?: string;
      is_veg?: boolean;
      is_popular?: boolean;
      is_available?: boolean;
      description?: string;
    }) => {
      if (!campus?.id) throw new Error('No campus selected');

      const validationResult = menuItemCreateSchema.safeParse(item);
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0]?.message || 'Invalid menu item data');
      }

      const validatedItem = validationResult.data;

      const { data, error } = await supabase
        .from('menu_items')
        .insert([{
          campus_id: campus.id,
          name: validatedItem.name,
          price: validatedItem.price,
          stock_quantity: validatedItem.quantity || 0,
          category: validatedItem.category || 'snacks',
          image_url: validatedItem.image || null,
          is_veg: validatedItem.is_veg ?? true,
          is_popular: validatedItem.is_popular ?? false,
          is_available: validatedItem.is_available ?? true,
          description: validatedItem.description || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
  });
}

// Update an existing menu item
export function useUpdateMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (update: {
      id: string;
      name?: string;
      price?: number;
      quantity?: number;
      category?: string;
      image?: string;
      is_veg?: boolean;
      is_popular?: boolean;
      is_available?: boolean;
      description?: string;
    }) => {
      const validationResult = menuItemUpdateSchema.safeParse(update);
      if (!validationResult.success) {
        throw new Error(validationResult.error.errors[0]?.message || 'Invalid update data');
      }

      const { id, quantity, image, category, ...rest } = validationResult.data;

      const updateData: Record<string, unknown> = { ...rest };
      
      if (quantity !== undefined) {
        updateData.stock_quantity = quantity;
      }
      if (image !== undefined) {
        updateData.image_url = image;
      }
      if (category !== undefined) {
        updateData.category = category;
      }

      const { data, error } = await supabase
        .from('menu_items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
  });
}

// Delete a menu item
export function useDeleteMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
  });
}

// Fetch orders for the current campus with auto-refresh
export function useAdminOrders() {
  const { campus } = useCampus();

  return useQuery({
    queryKey: ['admin-orders', campus?.id],
    queryFn: async () => {
      if (!campus?.id) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            name,
            price,
            quantity
          )
        `)
        .eq('campus_id', campus.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map(order => ({
        id: order.id,
        order_number: order.order_number,
        user_id: order.user_id,
        items: order.order_items || [],
        // 🦅 THE FIX 2: Kitchen staff and Recent Orders list now sees the true compensated payout!
        total: getTrueCanteenRevenue(order),
        status: order.status,
        created_at: order.created_at,
        user_name: order.customer_name || 'Guest',
        is_used: order.is_used,
        qr_code: order.qr_code,
        notes: order.notes,
        rejection_reason: order.rejection_reason,
        payment_status: order.payment_status,
      }));
    },
    enabled: !!campus?.id,
    refetchInterval: 5000, 
  });
}

// Update order status
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'pending' | 'confirmed' | 'collected' | 'expired' | 'failed' | 'cancelled' | 'rejected' | 'refunded' }) => {
      const statusResult = orderStatusSchema.safeParse(status);
      if (!statusResult.success) {
        throw new Error('Invalid order status');
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new Error('Invalid order ID');
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ status: statusResult.data })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });
}

// Mark order token as used
export function useMarkTokenUsed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new Error('Invalid order ID');
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ is_used: true, status: 'collected' as const })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
  });
}

// Get order statistics
export function useOrderStats() {
  const { campus } = useCampus();

  return useQuery({
    queryKey: ['order-stats', campus?.id],
    queryFn: async (): Promise<OrderStats> => {
      if (!campus?.id) {
        return {
          totalRevenue: 0,
          totalOrders: 0,
          avgOrderValue: 0,
          todayOrders: 0,
          chartData: [],
        };
      }

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: orders, error } = await supabase
        .from('orders')
        // 🦅 THE FIX 3: Fetching the real columns to run the formula
        .select('total, platform_fee, discount_amount, discount_sponsor, created_at, status')
        .eq('campus_id', campus.id)
        .gte('created_at', sevenDaysAgo.toISOString())
        .not('status', 'in', '("failed","expired","cancelled","rejected","refunded")');

      if (error) throw error;

      const ordersList = orders || [];
      
      // 🦅 THE FIX 4: Quick Overview Top Cards now use compensated logic
      const totalRevenue = ordersList.reduce((sum, o) => sum + getTrueCanteenRevenue(o), 0);
      const totalOrders = ordersList.length;
      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = ordersList.filter(o => new Date(o.created_at) >= today).length;

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const chartData: { day: string; revenue: number; orders: number }[] = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const dayOrders = ordersList.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate >= date && orderDate < nextDate;
        });

        chartData.push({
          day: dayNames[date.getDay()],
          // 🦅 THE FIX 5: Quick Overview Chart uses compensated logic
          revenue: dayOrders.reduce((sum, o) => sum + getTrueCanteenRevenue(o), 0),
          orders: dayOrders.length,
        });
      }

      return {
        totalRevenue,
        totalOrders,
        avgOrderValue,
        todayOrders,
        chartData,
      };
    },
    enabled: !!campus?.id,
  });
}

export function useResetAdminData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
    },
  });
}