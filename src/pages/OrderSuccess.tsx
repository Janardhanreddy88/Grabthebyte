import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Home, Receipt, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export default function OrderSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [orderNumber, setOrderNumber] = useState('');
  const [collectionToken, setCollectionToken] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { navigate('/menu'); return; }
    const fetchOrderDetails = async () => {
      const { data } = await supabase.from('orders').select('order_number, collection_token').eq('id', orderId).single();
      if (data) { setOrderNumber(data.order_number); setCollectionToken(data.collection_token || orderId); }
      setLoading(false);
    };
    fetchOrderDetails();
  }, [orderId, navigate]);

  if (loading) return <div className="min-h-screen bg-background flex justify-center items-center"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="min-h-screen bg-green-500/5 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm">
        <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
          <div className="bg-gradient-to-br from-green-600 to-green-500 p-6 text-center text-white">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }}
              className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </motion.div>
            <h1 className="text-lg font-bold mb-1">Order Confirmed!</h1>
            <p className="text-green-100 text-sm opacity-90">Show this QR at the counter</p>
          </div>

          <div className="p-5 text-center space-y-4">
            <div className="bg-white p-3 rounded-xl border-2 border-dashed border-border inline-block">
              <QRCodeSVG value={collectionToken || orderId || ''} size={140} level="H" />
            </div>

            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Order Number</p>
              <p className="text-2xl font-black text-foreground tracking-tight">#{orderNumber}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="outline" className="w-full gap-2 rounded-xl" onClick={() => navigate('/my-orders')}>
                <Receipt size={16} /> My Orders
              </Button>
              <Button className="w-full gap-2 rounded-xl bg-green-600 hover:bg-green-700" onClick={() => navigate('/menu')}>
                <Home size={16} /> Home
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
