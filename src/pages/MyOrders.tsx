import { useEffect, useState, useCallback, useRef } from 'react';
import { PullToRefresh } from '@/components/PullToRefresh';
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
    try { 
      await supabase.from('orders').update({ status: 'failed' as const, payment_status: 'not_confirmed', rejection_reason: 'Payment timeout - 10 minutes expired' }).eq('id', id); 
      // 🔥 FIX: Removed the annoying toast.info('Order expired'); It now happens silently!
    } catch { 
      processingExpiryIds.current.delete(id); 
    }
  }, []);

  useEffect(() => {
    if (isLoading || !orders.length) return;
    orders.forEach(o => { 
      // 🔥 FIX: Optimized so it doesn't constantly try to update already-failed orders
      const needsUpdate = (o.status === 'pending' || o.payment_status === 'pending') && o.payment_status !== 'not_confirmed';
      const isTimedOut = (currentTime - new Date(o.created_at).getTime()) > PAYMENT_TIMEOUT_MS;

      if (needsUpdate && isTimedOut) {
        expirePendingOrder(o.id); 
      }
    });
  }, [orders, currentTime, expirePendingOrder]);

  const getStatusConfig = (o: Order) => {
    const isExpired = checkIsExpired(o);
    if (o.status === 'confirmed' && (o.payment_status === 'confirmed' || o.payment_status === 'completed')) return { label: 'Ready for Pickup', className: 'bg-emerald-50 text-emerald-600 border-emerald-200' };
    if (o.status === 'pending' && o.payment_status === 'pending') return { label: 'Payment Pending', className: 'bg-orange-50 text-orange-600 border-orange-200' };
    if (!isExpired && (o.status === 'failed' || o.payment_status === 'not_confirmed' || o.payment_status === 'failed')) return { label: 'Payment Failed', className: 'bg-red-50 text-red-600 border-red-200' };
    if (o.status === 'collected') return { label: 'Collected', className: 'bg-blue-50 text-blue-600 border-blue-200' };
    if (isExpired) return { label: 'Expired', className: 'bg-gray-100 text-gray-600 border-gray-200' };
    return { label: 'Processing', className: 'bg-yellow-50 text-yellow-600 border-yellow-200' };
  };

  return (
    <div className="min-h-screen bg-gray-50/80 pb-20">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-gray-200 px-3 py-2.5 safe-top shadow-sm">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate('/menu')}><ArrowLeft size={18} /></Button>
            <div>
              <h1 className="text-sm font-black text-gray-900">My Orders</h1>
              <p className="text-[11px] font-medium text-gray-500">Track your food</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-gray-600" onClick={() => { setIsRefetching(true); fetchOrders(); }} disabled={isRefetching}>
            <RefreshCw size={18} className={cn(isRefetching && "animate-spin")} />
          </Button>
        </div>
      </header>

      <PullToRefresh onRefresh={fetchOrders}>
      <main className="p-4 space-y-4 max-w-lg mx-auto">
        {isLoading ? [1, 2].map(i => <Skeleton key={i} className="h-48 w-full rounded-3xl" />) : orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-white shadow-sm border border-gray-100 rounded-full flex items-center justify-center mx-auto mb-5"><ShoppingBag className="h-8 w-8 text-gray-400" /></div>
            <h3 className="font-bold text-lg text-gray-900">No orders yet</h3>
            <p className="text-gray-500 text-sm mt-1 mb-6">Hungry? Place an order now!</p>
            <Button className="font-bold rounded-xl h-11 px-6 shadow-md" onClick={() => navigate('/menu')}>Browse Menu</Button>
          </div>
        ) : orders.map((order) => {
          const sc = getStatusConfig(order);
          const rem = getRemainingSeconds(order.created_at);
          const timedOut = (currentTime - new Date(order.created_at).getTime()) > PAYMENT_TIMEOUT_MS;
          const isOk = order.status === 'confirmed' && (order.payment_status === 'confirmed' || order.payment_status === 'completed');
          const isPending = order.status === 'pending' && order.payment_status === 'pending' && !timedOut;
          const isCollected = order.status === 'collected';
          const isExp = checkIsExpired(order);
          const isFailed = !isExp && (order.status === 'failed' || order.payment_status === 'not_confirmed' || order.payment_status === 'failed');

          const goToReceipt = () => navigate(`/order/${order.id}`);
          const [retryLoading, setRetryLoading] = useState(false);
          const handleRetry = (e: React.MouseEvent) => { 
            e.stopPropagation(); 
            if (retryLoading) return;
            setRetryLoading(true);
            navigate(`/payment?order_id=${order.id}&amount=${order.total}&mode=retry`); 
          };

          return (
            <div key={order.id} className="bg-white rounded-[1.5rem] border border-black/[0.04] shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden">
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="font-black text-base text-gray-900">#{order.order_number}</span>
                      <Badge variant="outline" className={cn("font-bold text-[10px] uppercase tracking-wider px-2 py-0.5 shadow-sm", sc.className)}>{sc.label}</Badge>
                    </div>
                    <p className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><Clock size={12} />{format(new Date(order.created_at), 'h:mm a')} • {order.campus?.name || 'Campus'}</p>
                  </div>
                  <span className="font-black text-lg text-gray-900">₹{order.total}</span>
                </div>
                
                <Separator className="my-3 border-gray-100" />
                
                <div className="space-y-1.5 mb-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600 font-medium">{item.quantity} × {item.name}</span>
                      <span className="font-bold text-gray-900">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* ACTION BOXES */}
                {isOk && !isCollected && !isExp && (
                  <div onClick={goToReceipt} className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-100 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform shadow-sm hover:shadow">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-1.5 rounded-xl border border-emerald-100 shadow-sm"><QRCodeSVG value={order.collection_token || order.id} size={38} /></div>
                      <div><p className="font-bold text-sm text-emerald-700">Ready for Pickup</p><p className="text-xs font-medium text-emerald-600/80">Tap to view full QR & Receipt</p></div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-emerald-400" />
                  </div>
                )}

                {isCollected && (
                  <div onClick={goToReceipt} className="bg-blue-50/50 p-3.5 rounded-2xl border border-blue-100 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-xl border border-blue-100 shadow-sm"><ShoppingBag className="h-6 w-6 text-blue-500" /></div>
                      <div><p className="font-bold text-sm text-blue-700">Order Collected</p><p className="text-xs font-medium text-blue-600/80">Tap to view Digital Receipt</p></div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-blue-400" />
                  </div>
                )}

                {isFailed && (
                  <div 
                    className={cn("bg-red-50/50 rounded-2xl border border-red-100 shadow-sm transition-transform", timedOut ? "p-3.5 flex items-center justify-between cursor-pointer active:scale-[0.98]" : "p-4")} 
                    onClick={timedOut ? goToReceipt : undefined}
                  >
                    {timedOut ? (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-2 rounded-xl border border-red-100 shadow-sm"><XCircle className="h-6 w-6 text-red-500" /></div>
                          <div><p className="font-bold text-sm text-red-700">Payment Failed</p><p className="text-xs font-medium text-red-600/80 line-clamp-1">{order.rejection_reason || "Timeout reached."}</p></div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-red-400" />
                      </>
                    ) : (
                      <div className="flex items-start gap-3 w-full">
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                        <div className="w-full">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-sm text-red-700">Payment Failed</p>
                            <div className="flex items-center gap-1 text-red-700 bg-red-100/80 px-2.5 py-0.5 rounded-md border border-red-200">
                              <Timer size={12} />
                              <span className="text-xs font-black font-mono tracking-wider">{formatTime(rem)}</span>
                            </div>
                          </div>
                          <p className="text-xs font-medium text-red-600/80 mt-1 line-clamp-1">{order.rejection_reason || "Bank error. You can still retry!"}</p>
                          <Button className="w-full mt-3 bg-red-600 hover:bg-red-700 text-white h-11 text-sm font-bold rounded-xl shadow-md shadow-red-600/20" onClick={handleRetry}>
                            <RefreshCw size={14} className="mr-2" /> Retry Payment
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isExp && (
                  <div onClick={goToReceipt} className="bg-gray-50 p-3.5 rounded-2xl border border-gray-200 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm"><Ban className="h-6 w-6 text-gray-500" /></div>
                      <div><p className="font-bold text-sm text-gray-700">Order Expired</p><p className="text-xs font-medium text-gray-500">Tap to view details</p></div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                )}

                {isPending && (
                  <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-200 shadow-sm">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                      <div className="w-full">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-sm text-orange-700">Payment Pending</p>
                          <div className="flex items-center gap-1 text-orange-700 bg-orange-100/80 px-2.5 py-0.5 rounded-md border border-orange-200"><Timer size={12} /><span className="text-xs font-black font-mono tracking-wider">{formatTime(rem)}</span></div>
                        </div>
                        <p className="text-xs font-medium text-orange-600/80 mt-1">Complete your payment to confirm order</p>
                        <Button className="w-full mt-3 bg-orange-600 hover:bg-orange-700 text-white h-11 text-sm font-bold rounded-xl shadow-md shadow-orange-600/20" onClick={handleRetry}>
                          <RefreshCw size={14} className="mr-2" /> Pay Now
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          );
        })}
      </main>
      </PullToRefresh>
    </div>
  );
}