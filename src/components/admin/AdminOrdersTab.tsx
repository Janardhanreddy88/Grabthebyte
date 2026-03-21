import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ChevronDown, Loader2, CheckCircle2, UtensilsCrossed,
} from 'lucide-react';
import { toast } from 'sonner';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  menu_item_id?: string | null;
}

interface Order {
  id: string;
  order_number: string;
  total: number;
  status: string;
  payment_status?: string | null;
  created_at: string;
  user_name?: string | null;
  items?: OrderItem[];
  is_used: boolean;
  // category resolved from the first item
  _category?: string;
}

interface AdminOrdersTabProps {
  orders: Order[];
  ordersLoading: boolean;
  markTokenUsed: {
    mutate: (id: string, options: { onSuccess: () => void; onError: () => void }) => void;
    isPending: boolean;
  };
  menuItems?: Array<{ id: string; category?: string | null }>;
}

export function AdminOrdersTab({ orders, ordersLoading, markTokenUsed, menuItems = [] }: AdminOrdersTabProps) {
  const [orderSearch, setOrderSearch] = useState('');

  // Build category lookup from menu items
  const categoryMap: Record<string, string> = {};
  menuItems.forEach(item => {
    categoryMap[item.id] = item.category || 'other';
  });

  // Determine primary category for each order (from its first item's menu_item_id)
  const getOrderCategory = (order: Order): string => {
    if (!order.items || order.items.length === 0) return 'other';
    const cats: Record<string, number> = {};
    order.items.forEach(item => {
      const cat = (item.menu_item_id && categoryMap[item.menu_item_id]) || 'other';
      cats[cat] = (cats[cat] || 0) + item.quantity;
    });
    // Return the category with the most items
    return Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
  };

  // Today's orders summary
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayOrders = orders.filter(o => new Date(o.created_at) >= todayStart && (o.status === 'confirmed' || o.status === 'collected'));

  const itemCounts: Record<string, number> = {};
  todayOrders.forEach(order => {
    order.items?.forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
    });
  });
  const topItemCounts = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Filter orders
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const filteredOrders = orders.filter((order) => {
    const orderDate = new Date(order.created_at);
    const orderNum = order.order_number || order.id;
    const lastFour = orderNum.slice(-4).toLowerCase();
    const searchTerm = orderSearch.toLowerCase().trim();
    const matchesSearch = searchTerm && lastFour.includes(searchTerm);
    if (orderDate < fortyEightHoursAgo) return matchesSearch;
    if (orderDate < todayStart) return matchesSearch;
    if (searchTerm) return matchesSearch;
    return true;
  });

  // Group by category
  const groupedOrders = filteredOrders.reduce((acc, order) => {
    const cat = getOrderCategory(order);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(order);
    return acc;
  }, {} as Record<string, Order[]>);

  // Sort categories by order count descending
  const sortedCategories = Object.entries(groupedOrders)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([cat]) => cat);

  const renderOrderCard = (order: Order) => (
    <div key={order.id} className="p-4 rounded-2xl bg-muted/50">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-primary text-sm sm:text-base">
              #{order.order_number || order.id.slice(-8).toUpperCase()}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              order.status === 'collected' ? 'bg-green-500/10 text-green-600'
                : order.status === 'failed' || order.status === 'expired' ? 'bg-destructive/10 text-destructive'
                : order.status === 'confirmed' ? 'bg-blue-500/10 text-blue-600'
                : 'bg-amber-500/10 text-amber-600'
            }`}>
              {order.status === 'confirmed' ? 'Approved' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm font-medium">{order.user_name || 'Guest'}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-sm font-bold text-primary">₹{order.total}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {new Date(order.created_at).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
      </div>

      {order.items && order.items.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Items</p>
          <div className="flex flex-wrap gap-2">
            {order.items.map((item, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background text-xs font-medium border border-border/50">
                <span className="text-foreground">{item.name}</span>
                <span className="text-muted-foreground">×{item.quantity}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {order.status === 'confirmed' && !order.is_used && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <Button
            size="sm" variant="outline"
            className="w-full gap-2 text-green-600 border-green-600/30 hover:bg-green-500/10"
            onClick={() => {
              markTokenUsed.mutate(order.id, {
                onSuccess: () => toast.success(`Token #${order.order_number?.slice(-4) || order.id.slice(-4)} marked as used`),
                onError: () => toast.error('Failed to mark token as used'),
              });
            }}
            disabled={markTokenUsed.isPending}
          >
            {markTokenUsed.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Mark Token Used
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Today's Summary */}
      <Card className="rounded-2xl card-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Today's Orders</CardTitle>
                <p className="text-sm text-muted-foreground">{todayOrders.length} paid orders</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">{todayOrders.length}</p>
              <p className="text-sm text-muted-foreground">orders</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {topItemCounts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Items Today</p>
              {topItemCounts.map(([name, count]) => (
                <div key={name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                  <span className="font-medium">{name}</span>
                  <span className="font-bold text-primary">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No orders yet today</p>
          )}
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card className="rounded-2xl card-shadow">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-lg">All Orders</CardTitle>
          <Input
            placeholder="Search by last 4 digits..."
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            className="w-full sm:w-48 h-9 rounded-full"
          />
        </CardHeader>
        <CardContent>
          {ordersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No orders yet</p>
          ) : (
            <div className="space-y-6">
              {sortedCategories.map((cat) => {
                const catOrders = groupedOrders[cat];
                if (!catOrders || catOrders.length === 0) return null;
                const displayName = cat.charAt(0).toUpperCase() + cat.slice(1);

                return (
                  <Collapsible key={cat} defaultOpen={sortedCategories[0] === cat} className="space-y-3">
                    <CollapsibleTrigger className="w-full group">
                      <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                        <div className="p-1.5 rounded-full bg-primary/10 text-primary">
                          <UtensilsCrossed className="h-4 w-4" />
                        </div>
                        <span className="font-semibold">{displayName}</span>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">{catOrders.length} orders</span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3">
                      {catOrders.slice(0, 10).map(renderOrderCard)}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
