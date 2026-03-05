import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Order } from '@/types/canteen';
import { supabase } from '@/integrations/supabase/client';

interface OrdersContextType {
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  markOrderCollected: (orderId: string) => Promise<{ success: boolean; message: string }>;
  verifyQrCode: (qrCode: string) => Promise<Order | undefined>;
  verifyByCollectionToken: (token: string) => Promise<{ success: boolean; message: string }>;
  getOrderById: (orderId: string) => Order | undefined;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

const STORAGE_KEY = 'canteen_orders';

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);

  // Load orders from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const ordersWithDates = parsed.map((order: any) => ({
          ...order,
          createdAt: new Date(order.createdAt),
        }));
        setOrders(ordersWithDates);
      } catch {
        setOrders([]);
      }
    }
  }, []);

  // Save to localStorage whenever orders change
  useEffect(() => {
    if (orders.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    }
  }, [orders]);

  const addOrder = useCallback((order: Order) => {
    setOrders(prev => {
      const updated = [order, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: Order['status']) => {
    setOrders(prev => {
      const updated = prev.map(order =>
        order.id === orderId ? { ...order, status } : order
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  /**
   * Mark order as collected using the SECURE RPC function.
   * This uses the collection_token (secret UUID) for verification.
   */
  const markOrderCollected = useCallback(async (orderId: string): Promise<{ success: boolean; message: string }> => {
    try {
      // First get the collection_token for this order
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('collection_token')
        .eq('id', orderId)
        .maybeSingle();

      if (fetchError || !orderData?.collection_token) {
        return { success: false, message: 'Order not found or missing collection token.' };
      }

      // Use the secure RPC function
      const { data, error } = await supabase.rpc('mark_order_collected_secure', {
        p_secret_token: orderData.collection_token,
      });

      if (error) {
        return { success: false, message: error.message };
      }

      const result = data as { success: boolean; message: string };

      // Update local state on success
      if (result.success) {
        setOrders(prev => {
          const updated = prev.map(order =>
            order.id === orderId ? { ...order, status: 'collected' as Order['status'], isUsed: true } : order
          );
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      }

      return result;
    } catch {
      return { success: false, message: 'Unexpected error marking order collected.' };
    }
  }, []);

  /**
   * Verify using the collection_token directly (from QR code).
   * Uses mark_order_collected_secure RPC.
   */
  const verifyByCollectionToken = useCallback(async (token: string): Promise<{ success: boolean; message: string }> => {
    try {
      const { data, error } = await supabase.rpc('mark_order_collected_secure', {
        p_secret_token: token,
      });

      if (error) {
        return { success: false, message: error.message };
      }

      return data as { success: boolean; message: string };
    } catch {
      return { success: false, message: 'Unexpected error verifying order.' };
    }
  }, []);

  /**
   * Look up an order by order_number or ID.
   * Fetches from DB with order_items.
   */
  const verifyQrCode = useCallback(async (qrCode: string): Promise<Order | undefined> => {
    // 1. Try Local Search First
    const localOrder = orders.find(order => order.qrCode === qrCode || order.id === qrCode);
    if (localOrder) return localOrder;

    

    // 2. Fetch from Supabase with order_items
    try {
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
        .or(`id.eq.${qrCode},order_number.eq.${qrCode}`)
        .maybeSingle();

      if (error) {
        return undefined;
      }

      if (data) {
        const fetchedOrder: Order = {
          id: data.id,
          qrCode: data.order_number,
          total: Number(data.total),
          status: (['pending', 'confirmed', 'collected', 'expired', 'failed'].includes(data.status)
            ? data.status
            : 'pending') as Order['status'],
          isUsed: data.is_used || data.status === 'collected',
          createdAt: new Date(data.created_at),
          customerName: data.customer_name || undefined,
          customerEmail: data.customer_email || undefined,
          items: (data.order_items || []).map((item: any) => ({
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
        };
        return fetchedOrder;
      }
    } catch {
      // Scan error - return undefined
    }

    return undefined;
  }, [orders]);

  const getOrderById = useCallback((orderId: string) => {
    return orders.find(order => order.id === orderId);
  }, [orders]);

  return (
    <OrdersContext.Provider value={{
      orders,
      addOrder,
      updateOrderStatus,
      markOrderCollected,
      verifyQrCode,
      verifyByCollectionToken,
      getOrderById,
    }}>
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrdersContext() {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error('useOrdersContext must be used within an OrdersProvider');
  }
  return context;
}
