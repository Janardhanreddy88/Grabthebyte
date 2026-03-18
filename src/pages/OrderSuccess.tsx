import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Home, Receipt, Loader2, MapPin, XCircle, Clock, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Separator } from '@/components/ui/separator';

interface OrderItem { name: string; quantity: number; price: number; }
interface OrderData { 
  id: string; 
  order_number: string; 
  status: string; 
  total: number; 
  created_at: string; 
  collection_token: string; 
  campus: { name: string } | null; 
  items: OrderItem[]; 
}

export default function OrderSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const orderId = searchParams.get('order_id') || searchParams.get('orderId'); 
  
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { navigate('/menu'); return; }
    
    const fetchOrderDetails = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`id, order_number, status, total, created_at, collection_token, campus:campuses(name), order_items(name, quantity, price)`)
        .eq('id', orderId)
        .maybeSingle();

      if (data) {
        setOrder({
          id: data.id, 
          order_number: data.order_number, 
          status: data.status, 
          total: Number(data.total), 
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

  if (loading) return <div className="min-h-screen bg-gray-50 flex justify-center items-center"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
  if (!order) return <div className="min-h-screen bg-gray-50 flex justify-center items-center text-muted-foreground">Order not found.</div>;

  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // 🔥 ULTRA-PREMIUM GRADIENTS
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { 
          bg: 'from-[#059669] to-[#10B981]', // Rich Emerald Green
          icon: <CheckCircle2 className="w-8 h-8 text-white" strokeWidth={2.5} />, 
          title: 'Order Confirmed!', 
          subtitle: 'Show this QR at the counter'
        };
      case 'collected':
        return { 
          bg: 'from-[#2563EB] to-[#3B82F6]', // Deep Royal Blue
          icon: <PackageCheck className="w-8 h-8 text-white" strokeWidth={2.5} />, 
          title: 'Order Collected', 
          subtitle: 'Hope you enjoyed your meal!'
        };
      case 'pending':
        return { 
          bg: 'from-[#D97706] to-[#F59E0B]', // Warm Amber
          icon: <Clock className="w-8 h-8 text-white" strokeWidth={2.5} />, 
          title: 'Payment Pending', 
          subtitle: 'Awaiting payment confirmation'
        };
      case 'failed':
      case 'expired':
        return { 
          bg: 'from-[#DC2626] to-[#EF4444]', // Sharp Crimson Red
          icon: <XCircle className="w-8 h-8 text-white" strokeWidth={2.5} />, 
          title: 'Order Failed', 
          subtitle: 'Payment was not completed'
        };
      default:
        return { 
          bg: 'from-gray-700 to-gray-500', 
          icon: <Receipt className="w-8 h-8 text-white" strokeWidth={2.5} />, 
          title: 'Order Details', 
          subtitle: `Status: ${status}`
        };
    }
  };

  const config = getStatusConfig(order.status);

  return (
    // Desktop Container Background
    <div className="min-h-screen bg-gray-100 flex justify-center sm:py-8 font-sans">
      
      {/* The Central Mobile-Sized App Container (Sleek Apple-style styling) */}
      <div className="w-full max-w-[420px] bg-[#F9FAFB] sm:rounded-[2.5rem] sm:border border-black/5 sm:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] relative overflow-hidden flex flex-col">
        
        {/* 🚀 DYNAMIC CURVED HEADER */}
        <div className={`bg-gradient-to-br ${config.bg} pt-12 pb-24 px-6 text-center text-white relative z-0 rounded-b-[2.5rem] shadow-sm`}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15, delay: 0.1 }}
            className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md shadow-inner border border-white/10">
            {config.icon}
          </motion.div>
          <h1 className="text-[22px] font-black tracking-tight mb-1">{config.title}</h1>
          <p className="text-white/90 text-sm font-medium tracking-wide opacity-90">{config.subtitle}</p>
        </div>

        {/* 🚀 MAIN CONTENT (Floating over the header) */}
        <main className="px-5 -mt-14 relative z-10 flex flex-col gap-5 pb-10 flex-1">
          
          {/* THE QR CODE TICKET */}
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

          {/* If not confirmed, just show the order number ticket */}
          {order.status !== 'confirmed' && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
              <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-black/[0.03] p-6 text-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Order Number</p>
                <p className="text-4xl font-black text-gray-900 tracking-tighter mb-2">#{order.order_number}</p>
                <div className="inline-flex items-center gap-1.5 bg-gray-100 px-3 py-1 rounded-full text-xs font-semibold text-gray-500">
                  <Clock size={12} />
                  {new Date(order.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            </motion.div>
          )}

          {/* 🚀 DIGITAL RECEIPT */}
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
            <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-black/[0.03] overflow-hidden">
              <div className="bg-gray-50/80 px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-gray-700" />
                  <h3 className="font-bold text-sm text-gray-800">Bill Details</h3>
                </div>
                {order.status === 'confirmed' && (
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    {new Date(order.created_at).toLocaleDateString('en-IN')}
                  </p>
                )}
              </div>
              
              <div className="p-5 space-y-4">
                {/* Items */}
                <div className="space-y-4">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-start gap-4">
                      <div className="flex gap-3 items-start">
                        <div className="bg-gray-100 text-gray-600 text-[11px] font-bold rounded-md w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 border border-gray-200 shadow-sm">
                          {item.quantity}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800 leading-tight">{item.name}</p>
                          <p className="text-xs text-gray-400 font-medium mt-0.5">₹{item.price} × {item.quantity}</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-gray-900 tracking-tight">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                <Separator className="border-dashed border-gray-200 my-2" />

                {/* Taxes */}
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center text-gray-500 font-medium">
                    <span>Item Total</span>
                    <span className="text-gray-900">₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-500 font-medium">
                    <span>Platform Fee</span>
                    <span className="text-emerald-600 text-[10px] font-black tracking-wider px-2 py-0.5 bg-emerald-50 rounded-md border border-emerald-100/50">FREE</span>
                  </div>
                </div>

                <Separator className="border-gray-100 my-2" />
                
                {/* Grand Total */}
                <div className="flex justify-between items-center pt-2">
                  <div>
                    <span className="font-black text-base text-gray-900 block">Grand Total</span>
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 block">
                      {order.status === 'confirmed' || order.status === 'collected' ? 'Paid Securely' : 'Amount Due'}
                    </span>
                  </div>
                  <span className="text-2xl font-black text-gray-900 tracking-tighter">₹{order.total}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 🚀 CAMPUS INFO */}
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

          {/* 🚀 NAVIGATION BUTTONS */}
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="pt-2 mt-auto">
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="w-full h-12 gap-2 rounded-xl border-gray-200 bg-white shadow-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all" onClick={() => navigate('/my-orders')}>
                <Receipt size={16} /> My Orders
              </Button>
              <Button className="w-full h-12 gap-2 rounded-xl shadow-md font-bold transition-all" onClick={() => navigate('/menu')}>
                <Home size={16} /> Home Menu
              </Button>
            </div>
          </motion.div>

        </main>
      </div>
    </div>
  );
}