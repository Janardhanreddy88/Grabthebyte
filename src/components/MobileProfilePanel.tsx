import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Package,
  Clock,
  Loader2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  status: string;
  items: string[];
}

interface MobileProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut?: () => void;
}

export function MobileProfilePanel({ isOpen, onClose }: MobileProfilePanelProps) {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();


  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && authUser?.id) {
      fetchOrders();
    }
  }, [isOpen, authUser?.id]);

  useEffect(() => {
    if (!authUser?.id) return;

    const channel = supabase
      .channel("order-status-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${authUser.id}`,
        },
        (payload) => {
          setOrders((prevOrders) =>
            prevOrders.map((order) => (order.id === payload.new.id ? { ...order, status: payload.new.status } : order)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser?.id]);

  const fetchOrders = async () => {
    if (!authUser?.id) return;

    setIsLoading(true);
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_number, created_at, total, status")
        .eq("user_id", authUser.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (ordersError) throw ordersError;

      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: itemsData } = await supabase.from("order_items").select("name").eq("order_id", order.id);
          return {
            ...order,
            items: itemsData?.map((item) => item.name) || [],
          };
        }),
      );

      setOrders(ordersWithItems);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusDisplay = (order: Order) => {
    switch (order.status) {
      case "confirmed":
        return { label: "Confirmed", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
      case "collected":
        return { label: "Collected", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400" };
      case "cancelled":
        return { label: "Cancelled", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
      case "pending":
      default:
        return { label: "Pending", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className="w-[85%] max-w-md p-0 flex flex-col overflow-hidden">
        <SheetHeader className="p-4 text-left shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl">My Orders</SheetTitle>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <Separator />

          {/* Order History Section */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package size={18} className="text-muted-foreground" />
                <h4 className="font-semibold text-sm text-muted-foreground">MY ORDERS</h4>
              </div>
              <button
                onClick={() => {
                  onClose();
                  navigate("/my-orders");
                }}
                className="text-xs text-primary font-medium hover:underline"
              >
                View All
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length > 0 ? (
              <div className="space-y-3">
                {orders.slice(0, 2).map((order) => {
                  const statusDisplay = getStatusDisplay(order);
                  return (
                    <div key={order.id} className="bg-muted/50 rounded-xl p-3 border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">{order.order_number}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full transition-all duration-300 ${statusDisplay.color}`}
                        >
                          {statusDisplay.label}
                        </span>
                      </div>
                      <p className="font-medium text-sm">{order.items.join(", ") || "No items"}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock size={12} />
                          <span>
                            {new Date(order.created_at).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </div>
                        <span className="font-bold text-primary">₹{order.total}</span>
                      </div>
                    </div>
                  );
                })}

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    onClose();
                    navigate("/my-orders");
                  }}
                >
                  <Package size={16} />
                  View All Orders
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                  <Package className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">No orders yet</p>
              </div>
            )}
          </div>

          {/* Copyright Footer */}
          <div className="p-4 pt-2">
            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()} GrabTheByte. All rights reserved.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
