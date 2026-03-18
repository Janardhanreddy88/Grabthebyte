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
  available_time_periods: z.array(z.enum(['breakfast', 'lunch', 'snacks', 'dinner'])).optional(),
  available_days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'])).optional(),
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
  available_time_periods: z.array(z.enum(['breakfast', 'lunch', 'snacks', 'dinner'])).optional(),
  available_days: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'])).optional(),
  description: z.string().max(1000).optional(),
});

// Simplified token system - no preparing/ready states
const orderStatusSchema = z.enum(['pending', 'confirmed', 'collected', 'expired', 'failed']);

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
  available_time_periods: string[];
  stock_quantity: number | null;
  created_at: string;
  updated_at: string;
}

interface Order {
  id: string;
  campus_id: string;
  user_id: string | null;
  order_number: string;
  // Token system uses simplified statuses: pending -> confirmed -> collected (or cancelled)
  status: 'pending' | 'confirmed' | 'collected' | 'cancelled';
  total: number;
  qr_code: string | null;
  is_used: boolean;
  customer_name: string | null;
  customer_email: string | null;
  payment_method: string | null;
  payment_status: string | null;
  notes: string | null;
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

      // Transform to match the expected format
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
        available_time_periods: item.available_time_periods || [],
        available_days: item.available_days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
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
      available_time_periods?: string[];
      available_days?: string[];
      description?: string;
    }) => {
      if (!campus?.id) throw new Error('No campus selected');

      // Validate input
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
          available_time_periods: (validatedItem.available_time_periods || []) as ('breakfast' | 'lunch' | 'snacks')[],
          available_days: (validatedItem.available_days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat']) as ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat')[],
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
      available_time_periods?: string[];
      available_days?: string[];
      description?: string;
    }) => {
      // Validate input
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
        total: Number(order.total),
        status: order.status,
        created_at: order.created_at,
        user_name: order.customer_name || 'Guest',
        is_used: order.is_used,
        qr_code: order.qr_code,
      }));
    },
    enabled: !!campus?.id,
    refetchInterval: 5000, // Auto-refresh every 5 seconds for real-time updates
  });
}

// Update order status (simplified token system)
export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'pending' | 'confirmed' | 'collected' | 'expired' | 'failed' }) => {
      // Validate status
      const statusResult = orderStatusSchema.safeParse(status);
      if (!statusResult.success) {
        throw new Error('Invalid order status');
      }

      // Validate UUID format
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

// Mark order token as used (for old tokens brought by customers)
export function useMarkTokenUsed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Validate UUID format
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

      // Get orders from last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: orders, error } = await supabase
        .from('orders')
        .select('total, created_at, status')
        .eq('campus_id', campus.id)
        .gte('created_at', sevenDaysAgo.toISOString())
        .neq('status', 'failed');

      if (error) throw error;

      const ordersList = orders || [];
      
      // Calculate stats
      const totalRevenue = ordersList.reduce((sum, o) => sum + Number(o.total), 0);
      const totalOrders = ordersList.length;
      const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

      // Today's orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = ordersList.filter(o => new Date(o.created_at) >= today).length;

      // Chart data by day
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
          revenue: dayOrders.reduce((sum, o) => sum + Number(o.total), 0),
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

// Utility to reset admin data (for testing)
export function useResetAdminData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // This doesn't actually delete data, just invalidates caches
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order-stats'] });
    },
  });
}
