import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Home, Receipt, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

export default function OrderSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');

  const [orderNumber, setOrderNumber] = useState<string>('');
  const [collectionToken, setCollectionToken] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      navigate('/menu'); 
      return;
    }

    const fetchOrderDetails = async () => {
      const { data } = await supabase
        .from('orders')
        .select('order_number, collection_token')
        .eq('id', orderId)
        .single();
      
      if (data) {
        setOrderNumber(data.order_number);
        setCollectionToken(data.collection_token || orderId);
      }
      setLoading(false);
    };

    fetchOrderDetails();
  }, [orderId, navigate]);

  if (loading) return <div className="min-h-screen bg-background flex justify-center items-center p-10"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="min-h-screen bg-green-500/5 flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm"
      >
        <Card className="border-border shadow-xl overflow-hidden">
          <div className="bg-green-600 p-8 text-center text-white">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-1">Order Ready!</h1>
            <p className="text-green-100 opacity-90">Please show this at the counter</p>
          </div>

          <CardContent className="p-8 text-center space-y-6 bg-card">
            <div className="bg-white p-4 rounded-2xl border-2 border-dashed border-border inline-block">
              <QRCodeSVG value={collectionToken || orderId || ''} size={180} level="H" />
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium">Order Number</p>
              <p className="text-4xl font-black text-foreground tracking-tight">#{orderNumber}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <Button variant="outline" className="w-full gap-2" onClick={() => navigate('/my-orders')}>
                <Receipt size={16} /> My Orders
              </Button>
              <Button className="w-full gap-2 bg-green-600 hover:bg-green-700" onClick={() => navigate('/menu')}>
                <Home size={16} /> Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}