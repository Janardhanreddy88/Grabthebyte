import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Order } from '@/types/canteen';
import { supabase } from '@/integrations/supabase/client';

interface OrdersContextType {
  orders: Order[];
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: Order['status']) => void;
  markOrderCollected: (orderId: string) => void;
  verifyQrCode: (qrCode: string) => Promise<Order | undefined>;
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

  const markOrderCollected = useCallback(async (orderId: string) => {
    // 1. Update Local State (Instant UI feedback)
    setOrders(prev => {
      const updated = prev.map(order =>
        // Force cast status to satisfy TypeScript
        order.id === orderId ? { ...order, status: 'collected' as Order['status'], isUsed: true } : order
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    // 2. Update Database (The Source of Truth)
    try {
      await supabase
        .from('orders')
        .update({ is_used: true, status: 'collected' })
        .eq('id', orderId);
    } catch (error) {
      console.error('Failed to update order in database:', error);
    }
  }, []);

  // --- FETCH FROM DATABASE IF NOT FOUND LOCALLY ---
  const verifyQrCode = useCallback(async (qrCode: string): Promise<Order | undefined> => {
    // 1. Try Local Search First
    const localOrder = orders.find(order => order.qrCode === qrCode || order.id === qrCode);
    if (localOrder) return localOrder;

    console.log("🔍 Order not found locally, checking Supabase for:", qrCode);

    // 2. If not found, Ask Supabase
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(`id.eq.${qrCode},order_number.eq.${qrCode}`)
        .maybeSingle();

      if (error) {
        console.error("Supabase Scan Error:", error);
        return undefined;
      }

      if (data) {
        // --- FIX: Cast data to 'any' to bypass strict Type checks ---
        const dbOrder = data as any;

        const fetchedOrder: Order = {
          id: dbOrder.id,
          qrCode: dbOrder.order_number, 
          total: dbOrder.total_amount || 0,
          status: (['pending', 'confirmed', 'collected', 'cancelled'].includes(dbOrder.status) 
            ? dbOrder.status 
            : 'pending') as Order['status'],
          isUsed: dbOrder.is_used || dbOrder.status === 'collected',
          createdAt: new Date(dbOrder.created_at),
          items: typeof dbOrder.items === 'string' 
            ? JSON.parse(dbOrder.items) 
            : (dbOrder.items || []),
        };
        return fetchedOrder;
      }
    } catch (err) {
      console.error("Unexpected scan error:", err);
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