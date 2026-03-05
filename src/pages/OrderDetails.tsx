import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { OrderStatus } from '@/types/canteen';
import { ArrowLeft, Receipt, Clock, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { OrderTimeline } from '@/components/OrderTimeline';
import { PageTransition } from '@/components/PageTransition';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface OrderData {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  collection_token: string;
  customer_name: string;
  campus: { name: string } | null;
  items: OrderItem[];
}

export default function OrderDetails() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      navigate('/my-orders');
      return;
    }

    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, total, created_at, collection_token, customer_name,
          campus:campuses(name),
          order_items(name, quantity, price)
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (error || !data) {
        navigate('/my-orders');
        return;
      }

      setOrder({
        id: data.id,
        order_number: data.order_number,
        status: data.status,
        total: Number(data.total),
        created_at: data.created_at,
        collection_token: data.collection_token,
        customer_name: data.customer_name || 'Customer',
        campus: data.campus as { name: string } | null,
        items: ((data.order_items || []) as any[]).map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          price: Number(item.price),
        })),
      });
      setLoading(false);
    };

    fetchOrder();
  }, [orderId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600';
      case 'confirmed':
        return 'bg-green-500/10 text-green-600';
      case 'collected':
        return 'bg-muted text-muted-foreground';
      case 'failed':
      case 'expired':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'Payment Pending',
      confirmed: 'Successful',
      collected: 'Collected',
      failed: 'Failed',
      expired: 'Expired',
    };
    return labels[status] || status;
  };

  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between px-4 h-14">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </Button>
            <h1 className="font-semibold">Order Details</h1>
            <div className="w-10" />
          </div>
        </header>

        <main className="p-4 max-w-lg mx-auto space-y-4">
          {/* Order Status Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-2xl overflow-hidden">
              <div className="bg-primary/5 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Order Number</p>
                  <p className="font-bold text-lg">#{order.order_number}</p>
                </div>
                <Badge className={getStatusColor(order.status)}>
                  {getStatusLabel(order.status)}
                </Badge>
              </div>
              <CardContent className="p-4">
                <OrderTimeline status={order.status as OrderStatus} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Pickup Info */}
          {order.campus && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="rounded-2xl">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Campus</p>
                    <p className="font-bold">{order.campus.name}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Order Items */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt size={18} />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.quantity}x</span>
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium">₹{item.price * item.quantity}</span>
                  </div>
                ))}

                <Separator className="my-3" />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2">
                    <span>Total</span>
                    <span className="text-primary">₹{order.total}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* QR Code - only show for confirmed orders */}
          {order.status === 'confirmed' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="rounded-2xl">
                <CardContent className="p-6 flex flex-col items-center">
                  <p className="text-sm text-muted-foreground mb-4">Show this QR code at counter</p>
                  <div className="p-4 bg-white rounded-xl">
                    <QRCodeSVG value={order.collection_token || order.id} size={150} level="H" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Time Info */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="rounded-2xl">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Clock className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ordered at</p>
                  <p className="font-bold">
                    {new Date(order.created_at).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Support */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Button variant="outline" className="w-full rounded-xl gap-2" onClick={() => navigate('/support')}>
              Need Help? Contact Support
            </Button>
          </motion.div>
        </main>
      </div>
    </PageTransition>
  );
}