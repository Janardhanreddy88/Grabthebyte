import { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, 
  RefreshCw,
  Search,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, startOfToday, startOfYesterday, endOfYesterday } from 'date-fns';

interface Order {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  total: number;
  status: string;
  created_at: string;
  campus?: { name: string; code: string };
  order_items?: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
}

export function SuperAdminOrders() {
  const { filters } = useSuperAdmin();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    
    let query = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_name,
        customer_email,
        total,
        status,
        created_at,
        campus:campuses(name, code),
        order_items(id, name, quantity, price)
      `)
      .order('created_at', { ascending: false });

    // --- APPLY DATE FILTERS ---
    if (dateFilter === 'today') {
      const today = startOfToday();
      query = query.gte('created_at', today.toISOString());
    } else if (dateFilter === 'yesterday') {
      const start = startOfYesterday();
      const end = endOfYesterday();
      query = query.gte('created_at', start.toISOString())
                   .lte('created_at', end.toISOString());
    }

    // --- CAMPUS FILTER ---
    if (filters.campusId) {
      query = query.eq('campus_id', filters.campusId);
    }
    
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as any);
    }

    query = query.limit(dateFilter === 'all' ? 100 : 500);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } else {
      setOrders((data || []) as Order[]);
    }
    
    setIsLoading(false);
  }, [filters.campusId, statusFilter, dateFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('all-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock; label: string }> = {
      pending: { variant: 'secondary', icon: Clock, label: 'Pending' },
      confirmed: { variant: 'default', icon: CheckCircle, label: 'Approved' },
      collected: { variant: 'outline', icon: Package, label: 'Collected' },
      cancelled: { variant: 'destructive', icon: XCircle, label: 'Failed' },
    };
    const config = configs[status] || configs.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(search) ||
      order.customer_name?.toLowerCase().includes(search) ||
      order.customer_email?.toLowerCase().includes(search)
    );
  });

  // --- UPDATED STATS CALCULATIONS ---
  const totalOrders = orders.length;
  // const pendingOrders = orders.filter(o => o.status === 'pending').length; // Removed
  const confirmedOrders = orders.filter(o => o.status === 'confirmed').length;
  const rejectedOrders = orders.filter(o => o.status === 'cancelled').length; // Added Rejected count
  const completedOrders = orders.filter(o => o.status === 'collected').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders Manager</h1>
          <p className="text-muted-foreground">
             {dateFilter === 'today' ? "Showing today's live orders" : 
              dateFilter === 'yesterday' ? "Showing orders from yesterday" : 
              "Showing complete order history"}
          </p>
        </div>
        <Button variant="outline" onClick={fetchOrders} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats - REARRANGED: Total -> Approved -> Rejected -> Collected */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total */}
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">
              {dateFilter === 'all' ? 'Total Orders' : dateFilter === 'yesterday' ? 'Orders Yesterday' : 'Orders Today'}
            </div>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>

        {/* 2. Approved (Moved Left) */}
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Approved</div>
            <div className="text-2xl font-bold text-blue-600">{confirmedOrders}</div>
          </CardContent>
        </Card>

        {/* 3. Rejected (Replaced Pending & Moved Right) */}
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Rejected</div>
            <div className="text-2xl font-bold text-destructive">{rejectedOrders}</div>
          </CardContent>
        </Card>

        {/* 4. Collected */}
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Collected</div>
            <div className="text-2xl font-bold text-green-600">{completedOrders}</div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Order List</CardTitle>
              <CardDescription>
                Manage and track student orders
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[140px]">
                  <Calendar className="w-4 h-4 mr-2 opacity-50" />
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Approved</SelectItem>
                  <SelectItem value="collected">Collected</SelectItem>
                  <SelectItem value="cancelled">Failed</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">No Orders Found</h3>
              <p className="text-muted-foreground">
                {dateFilter === 'today' 
                  ? "No orders have been placed today yet." 
                  : "No orders found for this filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Campus</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono font-medium">
                        {order.order_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{order.customer_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{order.campus?.code || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(order.total)}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Order #{selectedOrder?.order_number}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedOrder.customer_name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.customer_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Campus</p>
                  <p className="font-medium">{selectedOrder.campus?.name}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Order Status</p>
                {getStatusBadge(selectedOrder.status)}
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Items</p>
                <div className="space-y-2 p-3 rounded-lg bg-muted/50">
                  {selectedOrder.order_items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.name} × {item.quantity}</span>
                      <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold border-t pt-2 mt-2">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Order Date</p>
                <p className="font-medium">
                  {format(new Date(selectedOrder.created_at), 'MMMM d, yyyy at h:mm a')}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}