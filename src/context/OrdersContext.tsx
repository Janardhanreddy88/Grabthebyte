import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Order } from '@/types/canteen';

interface OrdersContextType {
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  getOrderById: (orderId: string) => Order | undefined;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);

  const addOrder = useCallback((order: Order) => {
    setOrders(prev => [order, ...prev]);
  }, []);

  const getOrderById = useCallback((orderId: string) => {
    return orders.find(order => order.id === orderId);
  }, [orders]);

  return (
    <OrdersContext.Provider value={{
      orders,
      setOrders,
      addOrder,
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
