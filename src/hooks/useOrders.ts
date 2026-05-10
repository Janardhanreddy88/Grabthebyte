import { useState, useEffect, useCallback } from 'react';
import { Order, CartItem } from '@/types/canteen';
import { useOrdersContext } from '@/context/OrdersContext';
import { supabase } from '@/integrations/supabase/client';
import { useCampus } from '@/context/CampusContext';
import { useAuth } from '@/context/AuthContext';
import { z } from 'zod';

const createOrderParamsSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    name: z.string().min(1).max(200),
    price: z.number().nonnegative(),
    // 🦅 THE FIX: Bumped max from 100 to 10000 so students can buy big tokens!
    quantity: z.number().int().positive().max(10000),
  })).min(1),
  total: z.number().positive().max(999999),
  paymentMethod: z.string().min(1).max(50),
  customerName: z.string().max(100).optional(),
  customerEmail: z.string().email().max(255).optional().or(z.literal('')).or(z.undefined()),
  customerPhone: z.string().optional(), 
  promoCode: z.string().optional().nullable(),
  platformFee: z.number().nonnegative().optional(),
});

// ... Keep the rest of your file exactly the same!

export interface CreateOrderParams {
  items: CartItem[];
  total: number;
  paymentMethod: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string; 
  promoCode?: string | null;
  platformFee?: number; // 🦅 Added to TypeScript interface!
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { addOrder } = useOrdersContext();
  const { campus } = useCampus();
  const { user } = useAuth(); 

  const fetchOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select(`*, order_items (id, name, price, quantity), platform_fee, discount_amount, promo_code`)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (fetchError) throw fetchError;

      const transformedOrders: Order[] = (data || []).map(order => ({
        id: order.id,
        items: (order.order_items || []).map((item: any) => ({
          id: item.menu_item_id,
          name: item.name,
          price: Number(item.price),
          quantity: item.quantity,
          description: '', 
          image: '',
          category: '',
          isVeg: true,
          isAvailable: true
        })),
        // 🦅 THE FIX: Just trust the database! No more double adding!
        total: Number(order.total), 
        status: order.status as Order['status'],
        qrCode: order.order_number || '',
        createdAt: new Date(order.created_at),
        isUsed: !!order.is_used,
        customerName: order.customer_name || undefined,
        customerEmail: order.customer_email || undefined,
      }));
      
      setOrders(transformedOrders);
    } catch (err) {
      setError('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-order-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setOrders(current => 
            current.map(o => o.id === payload.new.id ? { ...o, status: payload.new.status, isUsed: payload.new.is_used } : o)
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const createOrder = useCallback(async (params: CreateOrderParams): Promise<Order | null> => {
    if (!user || !campus?.id) {
      setError('Please login to place an order');
      return null;
    }

    setIsCreating(true);
    setError(null);
    
    try {
      createOrderParamsSchema.parse(params);

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const rpcItems = params.items.map(item => ({
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      }));

      // 🦅 Atomic Checkout completely stripped of frontend price trust!
      const { data: rpcData, error: rpcError } = await supabase.rpc('place_order_atomic', {
        p_user_id: user.id,
        p_campus_id: campus.id,
        p_customer_name: userProfile?.full_name || params.customerName || user.fullName || 'Guest',
        p_customer_email: params.customerEmail || user.email,
        p_customer_phone: userProfile?.phone || params.customerPhone || null, 
        p_promo_code: params.promoCode || null,
        p_platform_fee: params.platformFee || 0, 
        p_items: rpcItems
      });
      
      if (rpcError) throw new Error(rpcError.message);

      const rpcResult = rpcData as any;
      const newOrder: Order = {
        id: rpcResult.order_id,
        items: params.items,
        total: params.total, // Using the final frontend total, which already includes the fee
        status: 'pending',
        qrCode: rpcResult.order_number || '',
        createdAt: new Date(),
        isUsed: false,
        customerName: userProfile?.full_name || params.customerName || user.fullName || 'Guest',
        customerEmail: params.customerEmail || user.email,
      };

      addOrder(newOrder);
      setOrders(prev => [newOrder, ...prev]);
      return newOrder;
      
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
      throw err; 
    } finally {
      setIsCreating(false);
    }
  }, [campus?.id, user, addOrder]);

  const activeOrders = orders.filter(order => 
    order.status !== 'collected' && 
    !order.isUsed && 
    (new Date().getTime() - order.createdAt.getTime()) < (48 * 60 * 60 * 1000)
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