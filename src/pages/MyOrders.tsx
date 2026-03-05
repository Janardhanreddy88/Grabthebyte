import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Clock, CheckCircle2, XCircle, ChevronRight,
  ShoppingBag, RefreshCw, AlertCircle, Timer, Ban
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
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
  payment_status: string; 
  created_at: string;
  items: OrderItem[];
  campus: { name: string };
  rejection_reason?: string;
  collection_token: string;
}

export default function MyOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(Date.now());
  const processingExpiryIds = useRef<Set<string>>(new Set());

  const PAYMENT_TIMEOUT_MS = 10 * 60 * 1000;

  const fetchOrders = async () => {
    try {
      if (!user) return;
      
      // ✅ FIX: Use user_id instead of customer_email
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          campus:campuses(name),
          order_items(name, quantity, price)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedOrders: Order[] = (data || []).map((order: any) => ({
        id: order.id,
        order_number: order.order_number,
        total: order.total || order.amount,
        status: order.status,
        payment_status: order.payment_status || 'pending',
        created_at: order.created_at,
        campus: order.campus,
        items: order.order_items || order.items || [],
        rejection_reason: order.rejection_reason,
        collection_token: order.collection_token,
      }));

      setOrders(formattedOrders);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  };

  const handleRefresh = () => {
    setIsRefetching(true);
    fetchOrders();
  };

  useEffect(() => {
    fetchOrders();
    const channel = supabase
      .channel('my-orders-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const getOrderTimestamp = (createdAt: string) => new Date(createdAt).getTime();

  const getRemainingSeconds = (createdAt: string) => {
    const created = getOrderTimestamp(createdAt);
    const elapsed = currentTime - created;
    const remaining = PAYMENT_TIMEOUT_MS - elapsed;
    return Math.max(0, Math.floor(remaining / 1000));
  };

  const expirePendingOrder = useCallback(async (orderId: string) => {
    if (processingExpiryIds.current.has(orderId)) return;
    processingExpiryIds.current.add(orderId);

    try {
      await supabase
        .from('orders')
        .update({ 
          status: 'failed' as const, 
          payment_status: 'not_confirmed', 
          rejection_reason: 'Payment timeout - 10 minutes expired'
        })
        .eq('id', orderId);
      toast.info('Order expired due to payment timeout');
    } catch {
      processingExpiryIds.current.delete(orderId);
    }
  }, []);

  useEffect(() => {
    if (isLoading || orders.length === 0) return;

    orders.forEach(order => {
      const createdTime = getOrderTimestamp(order.created_at);
      const timeSinceCreation = currentTime - createdTime;

      if (order.status === 'pending' && order.payment_status === 'pending') {
        if (timeSinceCreation > PAYMENT_TIMEOUT_MS) {
          expirePendingOrder(order.id);
        }
      }
    });
  }, [orders, currentTime, expirePendingOrder]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const checkIsExpired = (order: Order) => {
    if (order.status === 'expired') return true;
    if (order.rejection_reason && order.rejection_reason.includes('Not collected')) return true;
    return false;
  };

  const getStatusConfig = (order: Order) => {
    const isExpired = checkIsExpired(order);

    if (order.status === 'confirmed' && (order.payment_status === 'confirmed' || order.payment_status === 'completed')) {
      return { label: 'Successful', className: 'bg-green-500/10 text-green-600 border-green-500/20' };
    }
    
    if (order.status === 'pending' && order.payment_status === 'pending') {
      return { label: 'Payment Pending', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' };
    }

    if (!isExpired && (order.status === 'failed' || order.payment_status === 'not_confirmed' || order.payment_status === 'failed')) {
      return { label: 'Payment Failed', className: 'bg-destructive/10 text-destructive border-destructive/20' };
    }
    
    if (order.status === 'collected') {
      return { label: 'Collected', className: 'bg-muted text-muted-foreground border-border' };
    }
    
    if (isExpired) {
      return { label: 'Order Expired', className: 'bg-muted text-muted-foreground border-border' };
    }

    return { label: 'Processing', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' };
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/menu')} className="shrink-0">
              <ArrowLeft size={20} />
            </Button>
            <div>
              <h1 className="text-lg font-bold">My Orders</h1>
              <p className="text-xs text-muted-foreground">Track your food</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefetching}>
            <RefreshCw size={18} className={cn(isRefetching && "animate-spin")} />
          </Button>
        </div>
      </header>

      <main className="p-4 space-y-4 max-w-lg mx-auto">
        {isLoading ? (
          [1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-medium text-foreground">No active orders</h3>
            <p className="text-muted-foreground text-sm mt-1">Hungry? Place an order now!</p>
            <Button className="mt-4" onClick={() => navigate('/menu')}>Browse Menu</Button>
          </div>
        ) : (
          orders.map((order) => {
            const statusConfig = getStatusConfig(order);
            const createdTime = getOrderTimestamp(order.created_at);
            const remainingSeconds = getRemainingSeconds(order.created_at);
            const isPaymentTimedOut = (currentTime - createdTime) > PAYMENT_TIMEOUT_MS;

            const isSuccessful = order.status === 'confirmed' && (order.payment_status === 'confirmed' || order.payment_status === 'completed');
            const isPending = order.status === 'pending' && order.payment_status === 'pending' && !isPaymentTimedOut;
            const isCollected = order.status === 'collected';
            const isExpired = checkIsExpired(order);
            const isFailed = !isExpired && (
                order.status === 'failed' || 
                order.status === 'cancelled' || 
                order.payment_status === 'not_confirmed'
            );

            return (
              <Card key={order.id} className="border-border shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4 bg-card">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">#{order.order_number}</span>
                          <Badge variant="outline" className={cn("capitalize border", statusConfig.className)}>
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock size={12} />
                          {format(new Date(order.created_at), 'h:mm a')} • {order.campus?.name || 'Campus'}
                        </p>
                      </div>
                      <span className="font-bold text-lg text-primary">₹{order.total}</span>
                    </div>

                    <Separator className="my-3" />

                    <div className="space-y-1 mb-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{item.quantity}x {item.name}</span>
                          <span className="font-medium">₹{item.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {isSuccessful && !isCollected && !isExpired ? (
                      <div 
                        className="bg-green-500/10 p-3 rounded-xl border border-green-500/20 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
                        onClick={() => navigate(`/order-success?orderId=${order.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-card p-1.5 rounded-lg border border-green-500/20">
                            <QRCodeSVG 
                                value={order.collection_token || order.id} 
                                size={32} 
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-green-600">Successful</p>
                            <p className="text-xs text-green-600/80">Tap to view full QR Code</p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-green-500/60" />
                      </div>
                    ) : null}

                    {isPending ? (
                      <div className="bg-orange-500/10 p-3 rounded-xl border border-orange-500/20">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                          <div className="w-full">
                            <div className="flex items-center justify-between">
                              <p className="font-semibold text-sm text-orange-600">Payment Pending</p>
                              <div className="flex items-center gap-1 text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded-full">
                                <Timer size={12} />
                                <span className="text-xs font-bold font-mono">{formatTime(remainingSeconds)}</span>
                              </div>
                            </div>
                            <p className="text-xs text-orange-600/80 mt-0.5">
                              Complete payment within 10 mins
                            </p>
                            <Button 
                              size="sm" 
                              className="w-full mt-3 bg-orange-600 hover:bg-orange-700 text-white h-9 text-sm font-semibold"
                              onClick={() => navigate(`/payment?order_id=${order.id}&amount=${order.total}&mode=retry`)}
                            >
                              <RefreshCw size={14} className="mr-2" /> Pay Now
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {isFailed ? (
                      <div className="bg-destructive/10 p-3 rounded-xl border border-destructive/20">
                        <div className="flex items-start gap-2">
                          <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                          <div className="w-full">
                            <p className="font-semibold text-sm text-destructive">Payment Failed</p>
                            <p className="text-xs text-destructive/80 mt-1 mb-2">
                              {order.rejection_reason || "Transaction incomplete or timed out."}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {isCollected ? (
                      <div className="bg-muted p-3 rounded-xl border border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                             <p className="font-semibold text-sm text-foreground">Order Collected</p>
                             <p className="text-xs text-muted-foreground">Enjoy your meal!</p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    
                    {isExpired ? (
                       <div className="bg-muted p-3 rounded-xl border border-border text-center">
                         <p className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-1">
                           <Ban size={16} /> Order Expired
                         </p>
                         <p className="text-xs text-muted-foreground mt-1">Not collected in time</p>
                       </div>
                    ) : null}

                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </main>
    </div>
  );
}