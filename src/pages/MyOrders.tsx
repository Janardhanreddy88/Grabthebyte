import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle2, XCircle, ChevronRight, ShoppingBag, RefreshCw, AlertCircle, Timer, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OrderItem { name: string; quantity: number; price: number; }
interface Order { id: string; order_number: string; total: number; status: string; payment_status: string; created_at: string; items: OrderItem[]; campus: { name: string }; rejection_reason?: string; collection_token: string; }

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
      const { data, error } = await supabase.from('orders').select(`*, campus:campus_public_info(name), order_items(name, quantity, price)`).eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      setOrders((data || []).map((o: any) => ({ id: o.id, order_number: o.order_number, total: o.total || o.amount, status: o.status, payment_status: o.payment_status || 'pending', created_at: o.created_at, campus: o.campus, items: o.order_items || [], rejection_reason: o.rejection_reason, collection_token: o.collection_token })));
    } catch { toast.error('Failed to load orders'); } finally { setIsLoading(false); setIsRefetching(false); }
  };

  useEffect(() => { fetchOrders(); const ch = supabase.channel('my-orders-updates').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders()).subscribe(); return () => { supabase.removeChannel(ch); }; }, [user]);
  useEffect(() => { const i = setInterval(() => setCurrentTime(Date.now()), 1000); return () => clearInterval(i); }, []);

  const getRemainingSeconds = (c: string) => Math.max(0, Math.floor((PAYMENT_TIMEOUT_MS - (currentTime - new Date(c).getTime())) / 1000));
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const checkIsExpired = (o: Order) => o.status === 'expired' || (o.rejection_reason?.includes('Not collected') ?? false);

  const expirePendingOrder = useCallback(async (id: string) => {
    if (processingExpiryIds.current.has(id)) return;
    processingExpiryIds.current.add(id);
    try { await supabase.from('orders').update({ status: 'failed' as const, payment_status: 'not_confirmed', rejection_reason: 'Payment timeout - 10 minutes expired' }).eq('id', id); toast.info('Order expired'); } catch { processingExpiryIds.current.delete(id); }
  }, []);

  useEffect(() => {
    if (isLoading || !orders.length) return;
    orders.forEach(o => { if (o.status === 'pending' && o.payment_status === 'pending' && (currentTime - new Date(o.created_at).getTime()) > PAYMENT_TIMEOUT_MS) expirePendingOrder(o.id); });
  }, [orders, currentTime, expirePendingOrder]);

  const getStatusConfig = (o: Order) => {
    const isExpired = checkIsExpired(o);
    if (o.status === 'confirmed' && (o.payment_status === 'confirmed' || o.payment_status === 'completed')) return { label: 'Successful', className: 'bg-green-500/10 text-green-600 border-green-500/20' };
    if (o.status === 'pending' && o.payment_status === 'pending') return { label: 'Payment Pending', className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' };
    if (!isExpired && (o.status === 'failed' || o.payment_status === 'not_confirmed' || o.payment_status === 'failed')) return { label: 'Payment Failed', className: 'bg-destructive/10 text-destructive border-destructive/20' };
    if (o.status === 'collected') return { label: 'Collected', className: 'bg-muted text-muted-foreground border-border' };
    if (isExpired) return { label: 'Order Expired', className: 'bg-muted text-muted-foreground border-border' };
    return { label: 'Processing', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' };
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-3 py-2.5">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/menu')}><ArrowLeft size={18} /></Button>
            <div><h1 className="text-sm font-bold">My Orders</h1><p className="text-[11px] text-muted-foreground">Track your food</p></div>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setIsRefetching(true); fetchOrders(); }} disabled={isRefetching}>
            <RefreshCw size={18} className={cn(isRefetching && "animate-spin")} />
          </Button>
        </div>
      </header>

      <main className="p-3 space-y-3 max-w-lg mx-auto">
        {isLoading ? [1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />) : orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4"><ShoppingBag className="h-7 w-7 text-muted-foreground" /></div>
            <h3 className="font-semibold text-base">No orders yet</h3>
            <p className="text-muted-foreground text-sm mt-1">Place an order now!</p>
            <Button className="mt-4" onClick={() => navigate('/menu')}>Browse Menu</Button>
          </div>
        ) : orders.map((order) => {
          const sc = getStatusConfig(order);
          const rem = getRemainingSeconds(order.created_at);
          const timedOut = (currentTime - new Date(order.created_at).getTime()) > PAYMENT_TIMEOUT_MS;
          const isOk = order.status === 'confirmed' && (order.payment_status === 'confirmed' || order.payment_status === 'completed');
          const isPending = order.status === 'pending' && order.payment_status === 'pending' && !timedOut;
          const isCollected = order.status === 'collected';
          const isExp = checkIsExpired(order);
          const isFailed = !isExp && (order.status === 'failed' || order.payment_status === 'not_confirmed');

          return (
            <div key={order.id} className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base">#{order.order_number}</span>
                      <Badge variant="outline" className={cn("capitalize border text-xs px-2 py-0.5", sc.className)}>{sc.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock size={12} />{format(new Date(order.created_at), 'h:mm a')} • {order.campus?.name || 'Campus'}</p>
                  </div>
                  <span className="font-bold text-base text-primary">₹{order.total}</span>
                </div>
                <Separator className="my-3" />
                <div className="space-y-1 mb-3">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm"><span className="text-muted-foreground">{item.quantity}x {item.name}</span><span className="font-medium">₹{item.price * item.quantity}</span></div>
                  ))}
                </div>

                {isOk && !isCollected && !isExp && (
                  <div className="bg-green-500/10 p-3 rounded-xl border border-green-500/20 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform" onClick={() => navigate(`/order-success?orderId=${order.id}`)}>
                    <div className="flex items-center gap-3">
                      <div className="bg-card p-1.5 rounded-lg border border-green-500/20"><QRCodeSVG value={order.collection_token || order.id} size={36} /></div>
                      <div><p className="font-semibold text-sm text-green-600">Successful</p><p className="text-xs text-green-600/80">Tap to view QR</p></div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-green-500/60" />
                  </div>
                )}

                {isPending && (
                  <div className="bg-orange-500/10 p-3 rounded-xl border border-orange-500/20">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                      <div className="w-full">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm text-orange-600">Payment Pending</p>
                          <div className="flex items-center gap-1 text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded-full"><Timer size={12} /><span className="text-xs font-bold font-mono">{formatTime(rem)}</span></div>
                        </div>
                        <p className="text-xs text-orange-600/80 mt-1">Complete within 10 mins</p>
                        <Button className="w-full mt-2 bg-orange-600 hover:bg-orange-700 text-white h-11 text-sm font-semibold" onClick={() => navigate(`/payment?order_id=${order.id}&amount=${order.total}&mode=retry`)}><RefreshCw size={14} className="mr-1.5" /> Pay Now</Button>
                      </div>
                    </div>
                  </div>
                )}

                {isFailed && (
                  <div className="bg-destructive/10 p-3 rounded-xl border border-destructive/20 flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                    <div><p className="font-semibold text-sm text-destructive">Payment Failed</p><p className="text-xs text-destructive/80 mt-1">{order.rejection_reason || "Transaction incomplete."}</p></div>
                  </div>
                )}

                {isCollected && (
                  <div className="bg-muted p-3 rounded-xl border border-border flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                    <div><p className="font-semibold text-sm">Order Collected</p><p className="text-xs text-muted-foreground">Enjoy your meal!</p></div>
                  </div>
                )}

                {isExp && (
                  <div className="bg-muted p-3 rounded-xl border border-border text-center">
                    <p className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-1.5"><Ban size={14} /> Order Expired</p>
                    <p className="text-xs text-muted-foreground mt-1">Not collected in time</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
