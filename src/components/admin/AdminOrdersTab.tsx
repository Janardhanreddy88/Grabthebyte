import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sun, Utensils, Cookie, Clock, ChevronDown, Loader2, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  order_number: string;
  total: number;
  status: string;
  payment_status: string | null;
  created_at: string;
  user_name: string | null;
  items?: OrderItem[];
  is_used: boolean;
}

interface AdminOrdersTabProps {
  orders: Order[];
  ordersLoading: boolean;
  markTokenUsed: {
    mutate: (id: string, options: { onSuccess: () => void; onError: () => void }) => void;
    isPending: boolean;
  };
}

const PERIOD_CONFIGS = [
  { id: 'breakfast', name: 'Breakfast', icon: Sun, color: 'bg-amber-500/10 text-amber-600', time: '7 AM - 11 AM' },
  { id: 'lunch', name: 'Lunch', icon: Utensils, color: 'bg-blue-500/10 text-blue-600', time: '11 AM - 3 PM' },
  { id: 'snacks', name: 'Snacks', icon: Cookie, color: 'bg-purple-500/10 text-purple-600', time: '3 PM - 6 PM' },
  { id: 'dinner', name: 'Dinner', icon: Utensils, color: 'bg-orange-500/10 text-orange-600', time: '6 PM - 10 PM' },
  { id: 'other', name: 'Other', icon: Clock, color: 'bg-gray-500/10 text-gray-600', time: '' },
];

function getTimePeriod(dateStr: string) {
  const hour = new Date(dateStr).getHours();
  if (hour >= 7 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snacks';
  if (hour >= 18 && hour < 22) return 'dinner';
  return 'other';
}

function getCurrentPeriodId() {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 15 && hour < 18) return 'snacks';
  if (hour >= 18 && hour < 22) return 'dinner';
  return 'other';
}

export function AdminOrdersTab({ orders, ordersLoading, markTokenUsed }: AdminOrdersTabProps) {
  const [orderSearch, setOrderSearch] = useState('');

  const currentPeriodId = getCurrentPeriodId();
  const currentPeriod = PERIOD_CONFIGS.find(p => p.id === currentPeriodId);

  // Current period summary
  const currentPeriodOrders = orders.filter(o => getTimePeriod(o.created_at) === currentPeriodId);
  const itemCounts: Record<string, number> = {};
  currentPeriodOrders.forEach(order => {
    order.items?.forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
    });
  });
  const topItemCounts = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Filter orders
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
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

  // Group by period
  const groupedOrders = filteredOrders.reduce((acc, order) => {
    const period = getTimePeriod(order.created_at);
    if (!acc[period]) acc[period] = [];
    acc[period].push(order);
    return acc;
  }, {} as Record<string, Order[]>);

  // Period ordering: current first, then past reversed, then future
  const allPeriods = ['breakfast', 'lunch', 'snacks', 'dinner', 'other'];
  const currentIndex = allPeriods.indexOf(currentPeriodId);
  const periodOrder = [
    currentPeriodId,
    ...allPeriods.slice(0, currentIndex).reverse(),
    ...allPeriods.slice(currentIndex + 1),
  ].filter((v, i, a) => a.indexOf(v) === i);

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
      {/* Current Period Summary */}
      {currentPeriod && currentPeriod.id !== 'other' ? (
        <Card className="rounded-2xl card-shadow">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-full ${currentPeriod.color}`}>
                  <currentPeriod.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{currentPeriod.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{currentPeriod.time}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary">{currentPeriodOrders.length}</p>
                <p className="text-sm text-muted-foreground">orders</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {topItemCounts.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Items</p>
                {topItemCounts.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                    <span className="font-medium">{name}</span>
                    <span className="font-bold text-primary">{count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No orders yet for this period</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl card-shadow">
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">Outside meal hours.</p>
            <p className="text-center text-muted-foreground text-sm mt-2">
              Orders summary shows during Breakfast (7-11 AM), Lunch (11 AM-3 PM), or Snacks (3-6 PM).
            </p>
          </CardContent>
        </Card>
      )}

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
              {periodOrder.map((period) => {
                const periodOrders = groupedOrders[period];
                if (!periodOrders || periodOrders.length === 0) return null;

                const config = PERIOD_CONFIGS.find(p => p.id === period)!;
                const PeriodIcon = config.icon;
                const isCurrent = period === currentPeriodId;
                const periodIndex = allPeriods.indexOf(period);
                const isCompleted = periodIndex < currentIndex && period !== 'other';
                const isFuture = periodIndex > currentIndex && period !== 'other';

                if (!isCurrent) {
                  return (
                    <Collapsible key={period} defaultOpen={false} className="space-y-3">
                      <CollapsibleTrigger className="w-full group">
                        <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                          <div className={`p-1.5 rounded-full ${config.color}`}>
                            <PeriodIcon className="h-4 w-4" />
                          </div>
                          <span className="font-semibold">{config.name}</span>
                          {isCompleted && (
                            <span className="text-xs font-medium bg-muted-foreground/20 text-muted-foreground px-2 py-0.5 rounded-full">Completed</span>
                          )}
                          {isFuture && (
                            <span className="text-xs font-medium bg-blue-500/20 text-blue-600 px-2 py-0.5 rounded-full">Upcoming</span>
                          )}
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">{periodOrders.length} orders</span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-3">
                        {periodOrders.slice(0, 10).map(renderOrderCard)}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                }

                return (
                  <div key={period} className="space-y-3">
                    <div className="flex items-center gap-2 sticky top-0 py-2 bg-primary/5 px-3 rounded-lg -mx-3">
                      <div className={`p-1.5 rounded-full ${config.color}`}>
                        <PeriodIcon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold">{config.name}</span>
                      <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full animate-pulse">NOW</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">{periodOrders.length} orders</span>
                    </div>
                    {periodOrders.slice(0, 10).map(renderOrderCard)}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
