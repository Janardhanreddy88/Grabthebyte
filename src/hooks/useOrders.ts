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

      if (fetchError) throw fetchError;

      const transformedOrders: Order[] = (data || []).map(order => ({
        id: order.id,
        items: (order.order_items || []).map((item: any) => ({
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
      // 1. Validate Input
      const validationResult = createOrderParamsSchema.safeParse(params);
      if (!validationResult.success) {
        setError(validationResult.error.errors[0]?.message || 'Invalid order data');
        return null;
      }

      // 2. Fetch User Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('user_id', session.session.user.id)
        .maybeSingle();

      // 3. Format payload for Database Vault
      const rpcItems = params.items.map(item => ({
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      // 4. Hit the Titanium Vault (Atomic Checkout)
      const { data: rpcData, error: rpcError } = await supabase.rpc('place_order_atomic' as any, {
        p_user_id: session.session.user.id,
        p_campus_id: campus.id,
        p_total: params.total,
        p_customer_name: params.customerName || profile?.full_name || 'Guest',
        p_customer_email: params.customerEmail || profile?.email || session.session.user.email,
        p_items: rpcItems
      });

      // 5. Catch Database Race Condition Blocks
      if (rpcError) {
        // This grabs the exact error message we wrote in SQL (e.g., "Sold out! Someone just grabbed the last...")
        throw new Error(rpcError.message || "Someone just grabbed the last one! Stock is empty.");
      }

      // 6. Build Local State Object
      const rpcResult = rpcData as any;
      const newOrder: Order = {
        id: rpcResult.order_id,
        items: params.items,
        total: params.total,
        status: 'pending',
        qrCode: rpcResult.order_number || '',
        createdAt: new Date(),
        isUsed: false,
        customerName: params.customerName || profile?.full_name || 'Guest',
        customerEmail: params.customerEmail || profile?.email || session.session.user.email,
      };

      // 7. Update UI State
      addOrder(newOrder);
      setOrders(prev => [newOrder, ...prev]);
      return newOrder;
      
    } catch (err: any) {
      console.error('Checkout Vault Error:', err);
      // Pushes the exact error directly to Checkout.tsx so it shows up in the Red Toast!
      setError(err.message || 'Failed to secure your order. Please try again.');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [campus?.id, addOrder]);

  // Helper to filter out old or completed orders
  const isOrderOlderThan48Hours = (createdAt: Date) => {
    const now = new Date();
    const fortyEightHoursMs = 48 * 60 * 60 * 1000;
    return now.getTime() - createdAt.getTime() > fortyEightHoursMs;
  };

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