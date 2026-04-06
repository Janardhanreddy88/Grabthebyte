import { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, RefreshCw, Search, Eye, Clock, CheckCircle,
  XCircle, Package, Calendar, Download, MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  customer_phone: string | null;
  total: number;
  status: string;
  payment_status: string | null;
  payment_method: string | null;
  razorpay_payment_id: string | null;
  commission_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  campus?: { name: string; code: string };
  order_items?: Array<{ id: string; name: string; quantity: number; price: number }>;
}

export function SuperAdminOrders() {
  const { filters } = useSuperAdmin();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    
    let query = supabase
      .from('orders')
      .select(`
        id, order_number, customer_name, customer_email, customer_phone,
        total, status, payment_status, payment_method, razorpay_payment_id,
        commission_amount, notes, created_at, updated_at,
        campus:campuses(name, code),
        order_items(id, name, quantity, price)
      `)
      .order('created_at', { ascending: false });

    if (dateFilter === 'today') query = query.gte('created_at', startOfToday().toISOString());
    else if (dateFilter === 'yesterday') {
      query = query.gte('created_at', startOfYesterday().toISOString()).lte('created_at', endOfYesterday().toISOString());
    }
    if (filters.campusId) query = query.eq('campus_id', filters.campusId);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter as any);
    query = query.limit(dateFilter === 'all' ? 200 : 500);

    const { data, error } = await query;
    if (error) { toast.error('Failed to load orders'); } 
    else { setOrders((data || []) as Order[]); }
    setIsLoading(false);
  }, [filters.campusId, statusFilter, dateFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const channel = supabase.channel('all-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchOrders]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock; label: string }> = {
      pending: { variant: 'secondary', icon: Clock, label: 'Pending' },
      confirmed: { variant: 'default', icon: CheckCircle, label: 'Confirmed' },
      collected: { variant: 'outline', icon: Package, label: 'Collected' },
      failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
      expired: { variant: 'destructive', icon: XCircle, label: 'Expired' },
    };
    const config = configs[status] || configs.pending;
    const Icon = config.icon;
    return <Badge variant={config.variant} className="gap-1"><Icon className="h-3 w-3" />{config.label}</Badge>;
  };

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const s = searchQuery.toLowerCase();
    return order.order_number?.toLowerCase().includes(s) || order.customer_name?.toLowerCase().includes(s) || order.customer_email?.toLowerCase().includes(s);
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredOrders.map(o => o.id)));
  };

  const exportCSV = () => {
    const exportOrders = selectedIds.size > 0 ? filteredOrders.filter(o => selectedIds.has(o.id)) : filteredOrders;
    const headers = ['Order Number', 'Customer', 'Email', 'Campus', 'Amount', 'Status', 'Payment', 'Date'];
    const rows = exportOrders.map(o => [
      o.order_number, o.customer_name || '', o.customer_email || '',
      o.campus?.code || '', o.total, o.status, o.payment_status || '',
      format(new Date(o.created_at), 'yyyy-MM-dd HH:mm')
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `orders-${dateFilter}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${exportOrders.length} orders`);
  };

  const totalOrders = orders.length;
  const confirmedOrders = orders.filter(o => o.status === 'confirmed').length;
  const failedOrders = orders.filter(o => ['failed', 'expired'].includes(o.status)).length;
  const collectedOrders = orders.filter(o => o.status === 'collected').length;
  const totalRevenue = orders.filter(o => !['failed', 'expired'].includes(o.status)).reduce((s, o) => s + o.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders Manager</h1>
          <p className="text-muted-foreground">
            {dateFilter === 'today' ? "Today's live orders" : dateFilter === 'yesterday' ? "Yesterday's orders" : "Complete history"}
            {totalRevenue > 0 && ` · Revenue: ${formatCurrency(totalRevenue)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
          <Button variant="outline" onClick={fetchOrders} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Total</div><div className="text-2xl font-bold">{totalOrders}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Confirmed</div><div className="text-2xl font-bold text-blue-600">{confirmedOrders}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Failed/Expired</div><div className="text-2xl font-bold text-destructive">{failedOrders}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Collected</div><div className="text-2xl font-bold text-green-600">{collectedOrders}</div></CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>Order List</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[130px]"><Calendar className="w-4 h-4 mr-2 opacity-50" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="collected">Collected</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search orders..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">No Orders Found</h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0}
                        onCheckedChange={toggleSelectAll} />
                    </TableHead>
                    <TableHead>Order</TableHead>
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
                    <TableRow key={order.id} className={cn(selectedIds.has(order.id) && "bg-primary/5")}>
                      <TableCell>
                        <Checkbox checked={selectedIds.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} />
                      </TableCell>
                      <TableCell className="font-mono font-medium text-sm">{order.order_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{order.customer_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{order.campus?.code || 'N/A'}</Badge></TableCell>
                      <TableCell className="font-semibold">{formatCurrency(order.total)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(order.created_at), 'MMM d, h:mm a')}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)}>
                          <Eye className="h-4 w-4 mr-1" /> View
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
            <DialogTitle>Order #{selectedOrder?.order_number}</DialogTitle>
            <DialogDescription>Full order details</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedOrder.customer_name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{selectedOrder.customer_email}</p>
                  {selectedOrder.customer_phone && <p className="text-sm text-muted-foreground">{selectedOrder.customer_phone}</p>}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Campus</p>
                  <p className="font-medium">{selectedOrder.campus?.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedOrder.campus?.code}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Order Status</p>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment</p>
                  <Badge variant="outline">{selectedOrder.payment_status || 'N/A'}</Badge>
                </div>
              </div>

              {selectedOrder.razorpay_payment_id && (
                <div>
                  <p className="text-sm text-muted-foreground">Razorpay Payment ID</p>
                  <p className="font-mono text-xs">{selectedOrder.razorpay_payment_id}</p>
                </div>
              )}

              {selectedOrder.commission_amount && selectedOrder.commission_amount > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Commission</p>
                  <p className="font-medium">{formatCurrency(selectedOrder.commission_amount)}</p>
                </div>
              )}

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

              {selectedOrder.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{format(new Date(selectedOrder.created_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Updated</p>
                  <p>{format(new Date(selectedOrder.updated_at), 'MMM d, yyyy h:mm a')}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
