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
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-2.5">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/menu')}><ArrowLeft size={16} /></Button>
            <div><h1 className="text-sm font-bold">My Orders</h1><p className="text-[10px] text-muted-foreground">Track your food</p></div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setIsRefetching(true); fetchOrders(); }} disabled={isRefetching}>
            <RefreshCw size={14} className={cn(isRefetching && "animate-spin")} />
          </Button>
        </div>
      </header>

      <main className="p-3 space-y-3 max-w-lg mx-auto">
        {isLoading ? [1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />) : orders.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3"><ShoppingBag className="h-5 w-5 text-muted-foreground" /></div>
            <h3 className="font-medium text-sm">No orders yet</h3>
            <p className="text-muted-foreground text-xs mt-0.5">Place an order now!</p>
            <Button size="sm" className="mt-3 text-xs" onClick={() => navigate('/menu')}>Browse Menu</Button>
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
            <div key={order.id} className="bg-card rounded-xl border border-border/50 shadow-sm overflow-hidden">
              <div className="p-3">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm">#{order.order_number}</span>
                      <Badge variant="outline" className={cn("capitalize border text-[10px] px-1.5 py-0", sc.className)}>{sc.label}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1"><Clock size={10} />{format(new Date(order.created_at), 'h:mm a')} • {order.campus?.name || 'Campus'}</p>
                  </div>
                  <span className="font-bold text-sm text-primary">₹{order.total}</span>
                </div>
                <Separator className="my-2" />
                <div className="space-y-0.5 mb-2">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs"><span className="text-muted-foreground">{item.quantity}x {item.name}</span><span className="font-medium">₹{item.price * item.quantity}</span></div>
                  ))}
                </div>

                {isOk && !isCollected && !isExp && (
                  <div className="bg-green-500/10 p-2.5 rounded-lg border border-green-500/20 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform" onClick={() => navigate(`/order-success?orderId=${order.id}`)}>
                    <div className="flex items-center gap-2">
                      <div className="bg-card p-1 rounded border border-green-500/20"><QRCodeSVG value={order.collection_token || order.id} size={28} /></div>
                      <div><p className="font-semibold text-xs text-green-600">Successful</p><p className="text-[10px] text-green-600/80">Tap to view QR</p></div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-green-500/60" />
                  </div>
                )}

                {isPending && (
                  <div className="bg-orange-500/10 p-2.5 rounded-lg border border-orange-500/20">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                      <div className="w-full">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-xs text-orange-600">Payment Pending</p>
                          <div className="flex items-center gap-0.5 text-orange-600 bg-orange-500/10 px-1.5 py-0.5 rounded-full"><Timer size={10} /><span className="text-[10px] font-bold font-mono">{formatTime(rem)}</span></div>
                        </div>
                        <p className="text-[10px] text-orange-600/80 mt-0.5">Complete within 10 mins</p>
                        <Button size="sm" className="w-full mt-2 bg-orange-600 hover:bg-orange-700 text-white h-7 text-[11px] font-semibold" onClick={() => navigate(`/payment?order_id=${order.id}&amount=${order.total}&mode=retry`)}><RefreshCw size={11} className="mr-1" /> Pay Now</Button>
                      </div>
                    </div>
                  </div>
                )}

                {isFailed && (
                  <div className="bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div><p className="font-semibold text-xs text-destructive">Payment Failed</p><p className="text-[10px] text-destructive/80 mt-0.5">{order.rejection_reason || "Transaction incomplete."}</p></div>
                  </div>
                )}

                {isCollected && (
                  <div className="bg-muted p-2.5 rounded-lg border border-border flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    <div><p className="font-semibold text-xs">Order Collected</p><p className="text-[10px] text-muted-foreground">Enjoy your meal!</p></div>
                  </div>
                )}

                {isExp && (
                  <div className="bg-muted p-2.5 rounded-lg border border-border text-center">
                    <p className="text-xs font-medium text-muted-foreground flex items-center justify-center gap-1"><Ban size={12} /> Order Expired</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Not collected in time</p>
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