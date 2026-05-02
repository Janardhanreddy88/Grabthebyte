import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Receipt, Loader2, MapPin, XCircle, Clock, ShoppingBag, ArrowLeft, Ban, RefreshCw, Landmark, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface OrderItem { name: string; quantity: number; price: number; }
interface OrderData { 
  id: string; 
  order_number: string; 
  status: string; 
  payment_status: string;
  rejection_reason: string | null;
  total: number; 
  platform_fee: number;
  promo_code: string | null; // 🦅 ADDED PROMO CODE
  created_at: string; 
  collection_token: string; 
  campus: { name: string } | null; 
  items: OrderItem[]; 
}

export default function OrderDetails() {
  const navigate = useNavigate();
  const { orderId } = useParams(); 
  
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!orderId) { navigate('/my-orders'); return; }
    
    const fetchOrderDetails = async () => {
      // 🦅 ADDED promo_code TO THE SECURE FETCH QUERY
      const { data, error } = await supabase
        .from('orders')
        .select(`id, order_number, status, payment_status, rejection_reason, total, platform_fee, promo_code, created_at, collection_token, campus:campuses(name), order_items(name, quantity, price)`)
        .eq('id', orderId)
        .maybeSingle();

      if (data) {
        setOrder({
          id: data.id, 
          order_number: data.order_number, 
          status: data.status?.toLowerCase() || 'pending', 
          payment_status: data.payment_status?.toLowerCase() || 'pending',
          rejection_reason: data.rejection_reason,
          total: Number(data.total), 
          platform_fee: Number(data.platform_fee) || 0,
          promo_code: data.promo_code, // 🦅 SAVED TO STATE
          created_at: data.created_at, 
          collection_token: data.collection_token || data.id,
          campus: data.campus as { name: string } | null,
          items: ((data.order_items || []) as any[]).map((item: any) => ({ name: item.name, quantity: item.quantity, price: Number(item.price) })),
        });
      }
      setLoading(false);
    };
    
    fetchOrderDetails();
  }, [orderId, navigate]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex justify-center items-center safe-top"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  if (!order) return <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center text-muted-foreground gap-4">Order not found. <Button onClick={() => navigate('/my-orders')}>Back to Orders</Button></div>;

  // 🦅 THE BULLETPROOF MATH (Now Handles Discounts)
  const originalSubtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = order.promo_code ? Math.max(0, originalSubtotal - order.total) : 0;
  
  let displayFee = order.platform_fee;
  // Legacy fallback for old orders before platform_fee was securely saved
  if (!displayFee && displayFee !== 0) {
    if (order.total <= 40) displayFee = 2;
    else if (order.total <= 100) displayFee = 5;
    else displayFee = 6;
  }
  
  const grandTotal = order.total + displayFee;

  const PAYMENT_TIMEOUT_MS = 10 * 60 * 1000;
  const isTimedOut = (Date.now() - new Date(order.created_at).getTime()) > PAYMENT_TIMEOUT_MS;

  const isPaid = order.payment_status === 'completed' || order.payment_status === 'confirmed' || order.payment_status === 'paid' || order.payment_status === 'success';
  const isPaymentFailed = order.status === 'failed' || order.payment_status === 'not_confirmed' || order.payment_status === 'failed' || (order.status === 'pending' && isTimedOut);
  const isRefunded = !isPaymentFailed && order.status === 'refunded';
  const isExpired = !isPaymentFailed && order.status === 'expired';
  const isCancelled = !isPaymentFailed && (order.status === 'cancelled' || order.status === 'rejected');
  
  const isDead = isRefunded || isCancelled || isExpired || isPaymentFailed;

  const getStatusConfig = () => {
    if (isRefunded) return { bg: 'from-[#9333EA] to-[#7E22CE]', icon: <RefreshCw className="w-8 h-8 text-white" strokeWidth={2.5} />, title: 'Order Refunded', subtitle: order.rejection_reason || 'Refund processed to your bank.' };
    if (isPaymentFailed) return { bg: 'from-[#EF4444] to-[#B91C1C]', icon: <XCircle className="w-8 h-8 text-white" strokeWidth={2.5} />, title: 'Payment Failed', subtitle: order.rejection_reason || (isTimedOut ? 'Timeout reached.' : 'Transaction could not be completed') };
    if (isCancelled) return { bg: 'from-[#DC2626] to-[#991B1B]', icon: <Landmark className="w-8 h-8 text-white" strokeWidth={2.5} />, title: 'Order Cancelled', subtitle: order.rejection_reason || 'Cancelled by Canteen Admin.' };
    if (isExpired) return { bg: 'from-[#4B5563] to-[#6B7280]', icon: <Ban className="w-8 h-8 text-white" strokeWidth={2.5} />, title: 'Order Expired', subtitle: 'Not collected. Initiating refund...' };
    
    switch (order.status) {
      case 'confirmed': return { bg: 'from-[#059669] to-[#10B981]', icon: <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={2.5} />, title: 'Ready for Pickup', subtitle: 'Show this QR at the counter' };
      case 'collected': return { bg: 'from-[#2563EB] to-[#3B82F6]', icon: <ShoppingBag className="w-8 h-8 text-white" strokeWidth={2.5} />, title: 'Order Collected', subtitle: 'Hope you enjoyed your meal!' };
      case 'pending': return { bg: 'from-[#D97706] to-[#F59E0B]', icon: <Clock className="w-8 h-8 text-white" strokeWidth={2.5} />, title: 'Payment Pending', subtitle: 'Awaiting payment confirmation' };
      default: return { bg: 'from-gray-700 to-gray-500', icon: <Receipt className="w-8 h-8 text-white" strokeWidth={2.5} />, title: 'Order Details', subtitle: `Status: ${order.status}` };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center sm:py-8 font-sans">
      <div className="w-full max-w-[420px] bg-[#F9FAFB] sm:rounded-[2.5rem] sm:border border-black/5 sm:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] relative overflow-hidden flex flex-col">
        
        <div className={`bg-gradient-to-br ${config.bg} pt-6 pb-24 px-6 text-center text-white relative z-0 rounded-b-[2.5rem] shadow-sm safe-top`}>
          <div className="flex justify-start mb-2">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-colors">
              <ArrowLeft size={20} className="text-white" />
            </button>
          </div>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15, delay: 0.1 }}
            className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md shadow-inner border border-white/10">
            {config.icon}
          </motion.div>
          <h1 className="text-[22px] font-black tracking-tight mb-1">{config.title}</h1>
          <p className="text-white/90 text-sm font-medium tracking-wide opacity-90">{config.subtitle}</p>
        </div>

        <main className="px-5 -mt-14 relative z-10 flex flex-col gap-5 pb-10 flex-1">
          
          {order.status === 'confirmed' && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-black/[0.03] p-6 text-center flex flex-col items-center">
                <div className="bg-white p-3.5 rounded-2xl border-2 border-dashed border-gray-200 mb-5 shadow-sm">
                  <QRCodeSVG value={order.collection_token} size={150} level="H" />
                </div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Order Number</p>
                <p className="text-4xl font-black text-gray-900 tracking-tighter">#{order.order_number}</p>
              </div>
            </motion.div>
          )}

          {order.status !== 'confirmed' && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-black/[0.03] p-6 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Order Number</p>
                <p className={cn("text-4xl font-black tracking-tighter mb-2", isDead ? "text-gray-400 line-through decoration-2" : "text-gray-900")}>
                  #{order.order_number}
                </p>
                <div className="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full text-xs font-semibold text-gray-500">
                  <Clock size={12} />
                  {new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            </motion.div>
          )}

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/[0.03] overflow-hidden">
              <div className="bg-gray-50/80 px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-gray-700" />
                  <h3 className="font-bold text-sm text-gray-800">Bill Details</h3>
                </div>
                {(order.status === 'confirmed' || order.status === 'collected') && (
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    {new Date(order.created_at).toLocaleDateString('en-IN')}
                  </p>
                )}
              </div>
              
              <div className="p-5 space-y-4">
                <div className="space-y-4">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-start gap-4">
                      <div className="flex gap-3 items-start">
                        <div className={cn("text-[11px] font-bold rounded-md w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 border shadow-sm", isDead ? "bg-gray-50 text-gray-400 border-gray-100" : "bg-gray-100 text-gray-600 border-gray-200")}>
                          {item.quantity}
                        </div>
                        <div>
                          <p className={cn("text-sm font-bold leading-tight", isDead ? "text-gray-400 line-through" : "text-gray-800")}>{item.name}</p>
                          <p className="text-xs text-gray-400 font-medium mt-0.5">₹{item.price.toFixed(2)} × {item.quantity}</p>
                        </div>
                      </div>
                      <span className={cn("text-sm font-bold tracking-tight", isDead ? "text-gray-400 line-through" : "text-gray-900")}>₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <Separator className="border-dashed border-gray-200 my-2" />

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center text-gray-500 font-medium">
                    <span>Item Total</span>
                    <span className={cn(isDead ? "text-gray-400 line-through" : "text-gray-900")}>₹{originalSubtotal.toFixed(2)}</span>
                  </div>
                  
                  {/* 🦅 THE PROMO CODE ROW */}
                  {order.promo_code && discountAmount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Tag size={14} />
                        <span>Discount ({order.promo_code})</span>
                      </div>
                      <span className={cn("font-bold", isDead ? "text-emerald-600/50 line-through" : "text-emerald-600")}>
                        - ₹{discountAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center text-gray-500 font-medium">
                    <span>Platform Fee</span>
                    {displayFee > 0 ? (
                      <span className={cn("font-bold", isDead ? "text-gray-400 line-through" : "text-gray-900")}>₹{displayFee.toFixed(2)}</span>
                    ) : (
                      <span className={cn("text-[10px] font-black tracking-wider px-2 py-0.5 rounded-md border", isDead ? "text-gray-400 bg-gray-50 border-gray-100" : "text-emerald-600 bg-emerald-50 border-emerald-100/50")}>FREE</span>
                    )}
                  </div>
                </div>

                <Separator className="border-gray-100 my-2" />
                
                <div className="flex justify-between items-center pt-2">
                  <div>
                    <span className={cn("font-black text-base block", isDead ? "text-gray-500" : "text-gray-900")}>Grand Total</span>
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 block">
                      {isRefunded ? 'Refunded' : isCancelled ? 'Cancelled' : isPaid ? 'Paid Securely' : 'Amount Due'}
                    </span>
                  </div>
                  <span className={cn("text-2xl font-black tracking-tighter", isDead ? "text-gray-400 line-through" : "text-gray-900")}>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {order.campus && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
              <div className="flex items-center gap-3 p-4 bg-white rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-black/[0.02]">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                  <MapPin className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pickup Location</p>
                  <p className="text-sm font-bold text-gray-800">{order.campus.name} Canteen</p>
                </div>
              </div>
            </motion.div>
          )}

          {isPaymentFailed && !isTimedOut && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
              <Button 
                onClick={() => { if (actionLoading) return; setActionLoading(true); navigate(`/payment?order_id=${order.id}&amount=${grandTotal.toFixed(2)}`); }}
                disabled={actionLoading}
                className="w-full h-12 rounded-2xl text-base font-bold shadow-lg shadow-red-500/20 bg-red-600 hover:bg-red-700 text-white"
              >
                {actionLoading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <RefreshCw size={18} className="mr-2" />} Retry Payment
              </Button>
            </motion.div>
          )}

          {order.status === 'pending' && !isTimedOut && !isPaid && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
              <Button 
                onClick={() => { if (actionLoading) return; setActionLoading(true); navigate(`/payment?order_id=${order.id}&amount=${grandTotal.toFixed(2)}`); }}
                disabled={actionLoading}
                className="w-full h-12 rounded-2xl text-base font-bold shadow-lg shadow-orange-500/20 bg-orange-600 hover:bg-orange-700 text-white"
              >
                {actionLoading ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Receipt size={18} className="mr-2" />} Complete Payment Now
              </Button>
            </motion.div>
          )}

        </main>
      </div>
    </div>
  );
}