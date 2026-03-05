import { useState, useEffect, useCallback } from 'react';
import { Order, CartItem } from '@/types/canteen';
import { useOrdersContext } from '@/context/OrdersContext';
import { supabase } from '@/integrations/supabase/client';
import { useCampus } from '@/context/CampusContext';
import { z } from 'zod';

// Input validation schema
const createOrderParamsSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    name: z.string().min(1).max(200),
    price: z.number().nonnegative(),
    quantity: z.number().int().positive().max(100),
  })).min(1),
  total: z.number().positive().max(999999),
  paymentMethod: z.string().min(1).max(50),
  customerName: z.string().max(100).optional(),
  customerEmail: z.string().email().max(255).optional().or(z.literal('')).or(z.undefined()),
});

interface CreateOrderParams {
  items: CartItem[];
  total: number;
  paymentMethod: string;
  customerName?: string;
  customerEmail?: string;
}

interface UseOrdersReturn {
  orders: Order[];
  activeOrders: Order[];
  isLoading: boolean;
  error: string | null;
  createOrder: (params: CreateOrderParams) => Promise<Order | null>;
  isCreating: boolean;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing orders with Supabase
 */
export function useOrders(): UseOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addOrder } = useOrdersContext();
  const { campus } = useCampus();

  const fetchOrders = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      
      // Fetch all user orders - don't filter by campus to ensure we get all orders
      const { data, error: fetchError } = await supabase
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
        .eq('user_id', session.session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (fetchError) {
        throw fetchError;
      }

      // Transform to match Order type
      const transformedOrders: Order[] = (data || []).map(order => ({
        id: order.id,
        items: (order.order_items || []).map((item: { id: string; name: string; price: number; quantity: number }) => ({
          id: item.id,
          name: item.name,
          description: '',
          price: Number(item.price),
          image: '',
          category: '',
          isVeg: true,
          isAvailable: true,
          availableTimePeriods: [],
          quantity: item.quantity,
        })),
        total: Number(order.total),
        status: order.status as Order['status'],
        qrCode: order.order_number,
        createdAt: new Date(order.created_at),
        isUsed: order.is_used,
        customerName: order.customer_name || undefined,
        customerEmail: order.customer_email || undefined,
      }));

      setOrders(transformedOrders);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const createOrder = useCallback(async (params: CreateOrderParams): Promise<Order | null> => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user || !campus?.id) {
      setError('Please login to place an order');
      return null;
    }

    setIsCreating(true);
    setError(null);
    
    try {
      // Validate input
      const validationResult = createOrderParamsSchema.safeParse({
        items: params.items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        total: params.total,
        paymentMethod: params.paymentMethod,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
      });

      if (!validationResult.success) {
        const errorMsg = validationResult.error.errors[0]?.message || 'Invalid order data';
        setError(errorMsg);
        return null;
      }

      // Get user profile for customer info
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', session.session.user.id)
        .maybeSingle();

      // Create the order with PENDING status
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
          campus_id: campus.id,
          user_id: session.session.user.id,
          total: params.total,
          order_number: '', // Will be generated by trigger
          status: 'pending',
          customer_name: params.customerName || profile?.full_name || 'Guest',
          customer_email: params.customerEmail || profile?.email || session.session.user.email,
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert order items
      const orderItems = params.items.map(item => ({
        order_id: orderData.id,
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Create local order object
      const newOrder: Order = {
        id: orderData.id,
        items: params.items,
        total: params.total,
        status: orderData.status as Order['status'],
        qrCode: orderData.order_number,
        createdAt: new Date(orderData.created_at),
        isUsed: orderData.is_used,
        customerName: orderData.customer_name || undefined,
        customerEmail: orderData.customer_email || undefined,
      };

      // Add to global context
      addOrder(newOrder);
      
      setOrders(prev => [newOrder, ...prev]);
      return newOrder;
    } catch (err) {
      console.error('Error creating order:', err);
      setError('Failed to create order. Please try again.');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [campus?.id, addOrder]);

  // Check if order is older than 48 hours
  const isOrderOlderThan48Hours = (createdAt: Date) => {
    const now = new Date();
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;
    return now.getTime() - createdAt.getTime() > fortyEightHoursMs;
  };

  // Filter only active orders (not collected, not used, and not older than 48 hours)
  const activeOrders = orders.filter(order => 
    order.status !== 'collected' && 
    !order.isUsed && 
    !isOrderOlderThan48Hours(order.createdAt)
  );

  return {
    orders,
    activeOrders,
    isLoading,
    error,
    createOrder,
    isCreating,
    refetch: fetchOrders,
  };
}
