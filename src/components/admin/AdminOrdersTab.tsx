import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge'; // 🌟 FIX: Added the missing Badge import!
import {
  ChevronDown, Loader2, CheckCircle2, UtensilsCrossed, Ban, Clock, RefreshCw, XCircle, CalendarIcon, Package // 🌟 FIX: Added the missing Package icon import!
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
  notes?: string | null;             
  rejection_reason?: string | null;  
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
  
  // Date Filter State (Defaults to Today)
  const [selectedDateStr, setSelectedDateStr] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Build category lookup from menu items
  const categoryMap: Record<string, string> = {};
  menuItems.forEach(item => {
    categoryMap[item.id] = item.category || 'other';
  });

  // Determine primary category for each order
  const getOrderCategory = (order: Order): string => {
    if (!order.items || order.items.length === 0) return 'other';
    const cats: Record<string, number> = {};
    order.items.forEach(item => {
      const cat = (item.menu_item_id && categoryMap[item.menu_item_id]) || 'other';
      cats[cat] = (cats[cat] || 0) + item.quantity;
    });
    return Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';
  };

  // THE SMART DETECTIVE ENGINE 
  const getSmartStatus = (order: Order) => {
    let displayStatus = order.status?.toLowerCase() || 'pending';
    if (displayStatus === 'failed') {
      const notes = (order.notes || '').toLowerCase();
      const reason = (order.rejection_reason || '').toLowerCase();
      if (notes.includes('super admin') || reason.includes('cancelled')) {
        displayStatus = 'cancelled';
      } else if (reason.includes('5 hours') || reason.includes('not collected')) {
        displayStatus = 'expired';
      }
    }
    return displayStatus;
  };

  // Core Filtering Logic based on the Selected Calendar Date
  const filteredByDateOrders = useMemo(() => {
    if (!selectedDateStr) return orders; 
    
    const [year, month, day] = selectedDateStr.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);

    return orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= startOfDay && orderDate <= endOfDay;
    });
  }, [orders, selectedDateStr]);

  // Date-Filtered Orders Summary (Top Card)
  const targetDayPaidOrders = filteredByDateOrders.filter(o => o.status === 'confirmed' || o.status === 'collected');

  const itemCounts: Record<string, number> = {};
  targetDayPaidOrders.forEach(order => {
    order.items?.forEach(item => {
      itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
    });
  });
  const topItemCounts = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Search Filter applied ON TOP of the Date Filter
  const fullyFilteredOrders = filteredByDateOrders.filter((order) => {
    const searchTerm = orderSearch.toLowerCase().trim();
    if (!searchTerm) return true;
    
    const orderNum = order.order_number || order.id;
    const lastFour = orderNum.slice(-4).toLowerCase();
    return lastFour.includes(searchTerm);
  });

  // Group by category
  const groupedOrders = fullyFilteredOrders.reduce((acc, order) => {
    const cat = getOrderCategory(order);
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(order);
    return acc;
  }, {} as Record<string, Order[]>);

  // Sort categories by order count descending
  const sortedCategories = Object.entries(groupedOrders)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([cat]) => cat);

  const renderOrderCard = (order: Order) => {
    const smartStatus = getSmartStatus(order);
    
    // Determine colors based on the smart status
    let statusColorClass = 'bg-amber-500/10 text-amber-600'; // Default Pending
    if (smartStatus === 'collected') statusColorClass = 'bg-green-500/10 text-green-600';
    else if (smartStatus === 'confirmed') statusColorClass = 'bg-blue-500/10 text-blue-600';
    else if (['failed', 'expired', 'cancelled', 'rejected', 'refunded'].includes(smartStatus)) {
      statusColorClass = 'bg-destructive/10 text-destructive';
    }

    const statusLabel = smartStatus === 'confirmed' ? 'Approved' : smartStatus.charAt(0).toUpperCase() + smartStatus.slice(1);

    return (
      <div key={order.id} className="p-4 rounded-2xl bg-muted/50 border border-border/40 shadow-sm transition-all hover:bg-muted/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-primary text-sm sm:text-base">
                #{order.order_number || order.id.slice(-8).toUpperCase()}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColorClass}`}>
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-sm font-medium truncate max-w-[150px] sm:max-w-none">{order.user_name || 'Guest'}</span>
              <span className="text-muted-foreground">•</span>
              <span className={`text-sm font-black ${['cancelled', 'failed', 'expired', 'refunded'].includes(smartStatus) ? 'text-muted-foreground line-through opacity-60' : 'text-foreground'}`}>
                ₹{order.total}
              </span>
            </div>
            
            {['cancelled', 'expired', 'failed'].includes(smartStatus) && order.rejection_reason && (
               <p className="text-[10px] text-destructive mt-1.5 font-semibold bg-destructive/5 border border-destructive/10 px-2 py-0.5 rounded w-fit">
                 {order.rejection_reason}
               </p>
            )}

            <p className="text-[10px] font-medium text-muted-foreground mt-1.5 flex items-center gap-1">
              <Clock size={10} />
              {new Date(order.created_at).toLocaleTimeString('en-IN', {
                hour: '2-digit', minute: '2-digit', hour12: true
              })}
            </p>
          </div>
        </div>

        {order.items && order.items.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex flex-wrap gap-1.5">
              {order.items.map((item, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background text-[11px] font-semibold border shadow-sm">
                  <span className="text-foreground truncate max-w-[120px]">{item.name}</span>
                  <span className="text-primary font-black">×{item.quantity}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {order.status === 'confirmed' && !order.is_used && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <Button
              size="sm" variant="outline"
              className="w-full gap-2 text-emerald-600 border-emerald-600/30 hover:bg-emerald-500/10 font-bold"
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
  };

  return (
    <div className="space-y-4">
      {/* Header Control Row with Date Picker */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-card p-3 rounded-2xl border shadow-sm">
         <div className="flex items-center gap-2 w-full sm:w-auto">
           <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
             <CalendarIcon className="h-4 w-4" />
           </div>
           <Input 
             type="date" 
             value={selectedDateStr}
             onChange={(e) => setSelectedDateStr(e.target.value)}
             className="h-9 text-sm font-semibold border-border/50 focus-visible:ring-primary w-full sm:w-[150px]"
           />
         </div>
         
         <div className="w-full sm:w-auto relative">
           <Input
             placeholder="Search by last 4 digits..."
             value={orderSearch}
             onChange={(e) => setOrderSearch(e.target.value)}
             className="w-full sm:w-[220px] h-9 rounded-xl border-border/50 focus-visible:ring-primary"
           />
         </div>
      </div>

      {/* Target Day Summary */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg">
                  {selectedDateStr === format(new Date(), 'yyyy-MM-dd') ? "Today's Orders" : "Selected Day's Orders"}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{targetDayPaidOrders.length} successful paid orders</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl sm:text-3xl font-black text-foreground">{targetDayPaidOrders.length}</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pb-4">
          {topItemCounts.length > 0 ? (
            <div className="space-y-2.5 mt-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Top Selling Items</p>
              {topItemCounts.map(([name, count]) => (
                <div key={name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 border border-border/40">
                  <span className="text-sm font-medium text-foreground truncate pr-4">{name}</span>
                  <span className="text-sm font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md shrink-0">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-muted-foreground border border-dashed rounded-xl mt-2 bg-muted/20">
              <Ban className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">No successful orders found</p>
              <p className="text-xs mt-1">Select a different date from the calendar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orders List */}
      <Card className="rounded-2xl border shadow-sm">
        <CardHeader className="pb-3 pt-4">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            Order History 
            <Badge variant="secondary" className="text-[10px] font-bold px-1.5 py-0">
              {fullyFilteredOrders.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {ordersLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : fullyFilteredOrders.length === 0 ? (
            <div className="py-10 flex flex-col items-center justify-center text-muted-foreground">
              <Package className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium text-foreground">No orders found.</p>
              <p className="text-xs mt-1">Adjust your search or select a different date.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedCategories.map((cat) => {
                const catOrders = groupedOrders[cat];
                if (!catOrders || catOrders.length === 0) return null;
                const displayName = cat.charAt(0).toUpperCase() + cat.slice(1);

                return (
                  <Collapsible key={cat} defaultOpen={true} className="space-y-3">
                    <CollapsibleTrigger className="w-full group focus:outline-none">
                      <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-secondary/40 hover:bg-secondary/60 transition-colors border border-border/50">
                        <div className="p-1.5 rounded-lg bg-background shadow-sm text-foreground">
                          <UtensilsCrossed className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-sm">{displayName}</span>
                        <span className="text-[10px] font-bold text-muted-foreground bg-background border px-2 py-0.5 rounded-full ml-auto shadow-sm">
                          {catOrders.length} {catOrders.length === 1 ? 'order' : 'orders'}
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-3 px-1">
                      {catOrders.map(renderOrderCard)}
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