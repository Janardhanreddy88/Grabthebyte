import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  ShoppingBag,
  RefreshCw,
  AlertCircle,
  Ban
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
  collection_token: string;
}

export default function MyOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);

  const fetchOrders = async () => {
    try {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          amount,
          status,
          payment_status,
          created_at,
          collection_token,
          campus:campuses(name),
          order_items(name, quantity, price)
        `)
        .eq('customer_email', user.email)
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
        items: order.order_items || [],
        collection_token: order.collection_token
      }));

      setOrders(formattedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
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
  }, [user]);

  const getStatusConfig = (order: Order) => {
    const { status, payment_status } = order;

    if (status === 'confirmed' && payment_status === 'confirmed') {
      return { label: 'Successful', className: 'bg-green-100 text-green-700 border-green-200' };
    }
    
    if (status === 'pending') {
      return { label: 'Payment Pending', className: 'bg-orange-100 text-orange-700 border-orange-200' };
    }

    if (status === 'failed' || status === 'cancelled') {
      return { label: 'Payment Failed', className: 'bg-red-100 text-red-700 border-red-200' };
    }
    
    if (status === 'collected') {
      return { label: 'Collected', className: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
    
    if (status === 'expired') {
      return { label: 'Order Expired', className: 'bg-gray-100 text-gray-500 border-gray-200' };
    }

    return { label: 'Processing', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
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
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="font-medium text-gray-900">No orders yet</h3>
            <p className="text-gray-500 text-sm mt-1">Hungry? Place an order now!</p>
            <Button className="mt-4" onClick={() => navigate('/menu')}>Browse Menu</Button>
          </div>
        ) : (
          orders.map((order) => {
            const statusConfig = getStatusConfig(order);
            const { status, payment_status } = order;

            const isSuccessful = status === 'confirmed' && payment_status === 'confirmed';
            const isPending = status === 'pending';
            const isCollected = status === 'collected';
            const isExpired = status === 'expired';
            const isFailed = status === 'failed' || status === 'cancelled';

            return (
              <Card key={order.id} className="border-none shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-4 bg-white">
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
                          <span className="text-gray-600">{item.quantity}x {item.name}</span>
                          <span className="font-medium">₹{item.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {/* Successful - Show QR Code */}
                    {isSuccessful && !isCollected && (
                      <div 
                        className="bg-green-50 p-3 rounded-xl border border-green-100 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
                        onClick={() => navigate(`/order-success?orderId=${order.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-1.5 rounded-lg border border-green-100">
                            <QRCodeSVG 
                              value={order.collection_token || order.id} 
                              size={32} 
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-green-700">Successful</p>
                            <p className="text-xs text-green-600">Tap to view full QR Code</p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-green-400" />
                      </div>
                    )}

                    {/* Pending - Show Pay Now */}
                    {isPending && (
                      <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                          <div className="w-full">
                            <p className="font-semibold text-sm text-orange-700">Payment Pending</p>
                            <p className="text-xs text-orange-600 mt-0.5">
                              Complete your payment to confirm the order
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
                    )}

                    {/* Failed */}
                    {isFailed && (
                      <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                        <div className="flex items-start gap-2">
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                          <div className="w-full">
                            <p className="font-semibold text-sm text-red-700">Payment Failed</p>
                            <p className="text-xs text-red-600 mt-1">
                              Transaction could not be completed
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Collected */}
                    {isCollected && (
                      <div className="bg-gray-100 p-3 rounded-xl border border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="font-semibold text-sm text-gray-700">Order Collected</p>
                            <p className="text-xs text-gray-500">Enjoy your meal!</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Expired */}
                    {isExpired && (
                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-center">
                        <p className="text-sm font-medium text-gray-600 flex items-center justify-center gap-1">
                          <Ban size={16} /> Order Expired
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Not collected in time</p>
                      </div>
                    )}

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
