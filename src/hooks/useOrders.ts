import { useState, useEffect, useCallback } from 'react';
import { Order, CartItem } from '@/types/canteen';
import { supabase } from '@/integrations/supabase/client';
import { useCampus } from '@/context/CampusContext';

interface UseOrdersReturn {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Simple hook for fetching orders from Supabase (read-only)
 */
export function useOrders(): UseOrdersReturn {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          id,
          order_number,
          total,
          status,
          payment_status,
          created_at,
          is_used,
          customer_name,
          customer_email,
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
      setError('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return {
    orders,
    isLoading,
    error,
    refetch: fetchOrders,
  };
}
