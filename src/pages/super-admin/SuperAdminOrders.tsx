import { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingBag, RefreshCw, Search, Eye, Clock, CheckCircle,
  XCircle, Package, Calendar, Download, Landmark, Ban, CheckSquare, ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { useProcessRefund } from '@/hooks/useSuperAdminData'; 
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
  platform_fee: number | null; 
  discount_amount: number | null; // 🦅 ADDED
  promo_code: string | null; // 🦅 ADDED
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
  const processRefund = useProcessRefund();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 50;

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [globalStats, setGlobalStats] = useState({ total: 0, confirmed: 0, failed: 0, collected: 0, revenue: 0, profit: 0 });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, dateFilter, filters.campusId]);

  const fetchGlobalStats = useCallback(async () => {
    let query = supabase.from('orders').select('total, platform_fee, status');
    if (dateFilter === 'today') query = query.gte('created_at', startOfToday().toISOString());
    else if (dateFilter === 'yesterday') {
      query = query.gte('created_at', startOfYesterday().toISOString()).lte('created_at', endOfYesterday().toISOString());
    }
    if (filters.campusId) query = query.eq('campus_id', filters.campusId);

    const { data } = await query;
    if (data) {
      let totalRevenue = 0;
      let totalProfit = 0;
      
      const validOrders = data.filter(o => !['failed', 'expired', 'cancelled', 'rejected', 'refunded'].includes(o.status.toLowerCase()));
      
      validOrders.forEach(o => {
        const grandTotal = Number(o.total) || 0;
        const fee = Number(o.platform_fee) || 0;

        totalRevenue += grandTotal;
        totalProfit += fee;
      });

      setGlobalStats({
        total: data.length,
        confirmed: data.filter(o => o.status === 'confirmed').length,
        failed: data.filter(o => ['failed', 'expired', 'cancelled', 'rejected'].includes(o.status.toLowerCase())).length,
        collected: data.filter(o => o.status === 'collected').length,
        revenue: totalRevenue,
        profit: totalProfit,
      });
    }
  }, [dateFilter, filters.campusId]);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    fetchGlobalStats(); 
    
    // 🦅 THE FIX 1: Fetching discount data straight from the DB
    let query = supabase
      .from('orders')
      .select(`
        id, order_number, customer_name, customer_email, customer_phone,
        total, platform_fee, discount_amount, promo_code, status, payment_status, payment_method, razorpay_payment_id,
        commission_amount, notes, created_at, updated_at,
        campus:campuses(name, code),
        order_items(id, name, quantity, price)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (dateFilter === 'today') query = query.gte('created_at', startOfToday().toISOString());
    else if (dateFilter === 'yesterday') {
      query = query.gte('created_at', startOfYesterday().toISOString()).lte('created_at', endOfYesterday().toISOString());
    }
    if (filters.campusId) query = query.eq('campus_id', filters.campusId);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter as any);
    
    if (debouncedSearch) {
      query = query.or(`order_number.ilike.%${debouncedSearch}%,customer_name.ilike.%${debouncedSearch}%,customer_email.ilike.%${debouncedSearch}%`);
    }

    query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, count, error } = await query;
    if (error) { toast.error('Failed to load orders'); } 
    else { 
      setOrders((data || []) as Order[]); 
      if (count !== null) setTotalCount(count);
    }
    setIsLoading(false);
  }, [filters.campusId, statusFilter, dateFilter, debouncedSearch, page, fetchGlobalStats]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

  const getPaymentBadge = (paymentStatus: string | null) => {
    const status = (paymentStatus || 'pending').toLowerCase();
    if (status === 'completed' || status === 'paid' || status === 'confirmed') {
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none px-2 py-0.5 text-[10px] uppercase">Paid</Badge>;
    }
    if (status === 'failed') {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-none px-2 py-0.5 text-[10px] uppercase">Failed</Badge>;
    }
    return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-none px-2 py-0.5 text-[10px] uppercase">Pending</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof Clock; label: string }> = {
      pending: { variant: 'secondary', icon: Clock, label: 'Pending' },
      confirmed: { variant: 'default', icon: CheckCircle, label: 'Confirmed' },
      collected: { variant: 'outline', icon: Package, label: 'Collected' },
      failed: { variant: 'destructive', icon: XCircle, label: 'Failed' },
      expired: { variant: 'destructive', icon: Clock, label: 'Expired' },
      cancelled: { variant: 'destructive', icon: Ban, label: 'Cancelled' },
      rejected: { variant: 'destructive', icon: Ban, label: 'Rejected' },
      refunded: { variant: 'destructive', icon: RefreshCw, label: 'Refunded' },
    };
    const config = configs[status?.toLowerCase()] || configs.pending;
    const Icon = config.icon;
    return <Badge variant={config.variant} className="gap-1"><Icon className="h-3 w-3" />{config.label}</Badge>;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(orders.map(o => o.id)));
  };

  const handleBulkMarkCollected = async () => {
    if (selectedIds.size === 0) return;
    setIsUpdating(true);
    const { error } = await supabase
      .from('orders')
      .update({ status: 'collected' })
      .in('id', Array.from(selectedIds));
      
    setIsUpdating(false);
    if (error) {
      toast.error('Failed to update orders');
    } else {
      toast.success(`${selectedIds.size} orders marked as collected`);
      setSelectedIds(new Set());
      fetchOrders();
    }
  };

  const handleCancelOrder = async (id: string) => {
    setIsUpdating(true);
    const { error } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled', 
        rejection_reason: 'Cancelled by Admin. Refund will be processed.', 
        notes: 'Cancelled by Super Admin' 
      })
      .eq('id', id);
      
    setIsUpdating(false);
    if (error) {
      toast.error('Failed to cancel order');
    } else {
      toast.success('Order forcefully cancelled');
      setSelectedOrder(null);
      fetchOrders();
    }
  };

  const exportCSV = () => {
    const exportOrders = selectedIds.size > 0 ? orders.filter(o => selectedIds.has(o.id)) : orders;
    const headers = ['Order Number', 'Customer', 'Email', 'Campus', 'Item Subtotal', 'Discount', 'Platform Fee', 'Grand Total (Paid)', 'Payment Status', 'Order Status', 'Date'];
    const rows = exportOrders.map(o => {
      const grandTotal = Number(o.total) || 0;
      const fee = Number(o.platform_fee) || 0;
      const discount = Number(o.discount_amount) || 0;
      
      // Calculate true food cost before discounts for clean accounting
      const originalFoodCost = (grandTotal - fee) + discount;

      return [
        o.order_number, o.customer_name || '', o.customer_email || '',
        o.campus?.code || '', originalFoodCost, discount, fee, grandTotal, o.payment_status || 'pending', o.status,
        format(new Date(o.created_at), 'yyyy-MM-dd HH:mm')
      ];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `grabthebyte-orders-${dateFilter}-page${page}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${exportOrders.length} orders for accounting`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders Manager</h1>
          <p className="text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
            {dateFilter === 'today' ? "Today's live orders" : dateFilter === 'yesterday' ? "Yesterday's orders" : "Complete history"}
            {globalStats.revenue > 0 && <span className="text-gray-300">|</span>}
            {globalStats.revenue > 0 && <span className="font-semibold text-gray-900">GMV: {formatCurrency(globalStats.revenue)}</span>}
            {globalStats.profit > 0 && <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md text-xs">Profit: {formatCurrency(globalStats.profit)}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="default" size="sm" onClick={handleBulkMarkCollected} disabled={isUpdating} className="bg-green-600 hover:bg-green-700 text-white shadow-sm border border-green-700">
              {isUpdating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckSquare className="h-4 w-4 mr-1" />} 
              Mark {selectedIds.size} Collected
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Export Page {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
          <Button variant="outline" onClick={fetchOrders} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Total (All Pages)</div><div className="text-2xl font-bold">{globalStats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Confirmed</div><div className="text-2xl font-bold text-blue-600">{globalStats.confirmed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Failed/Cancelled</div><div className="text-2xl font-bold text-destructive">{globalStats.failed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Collected</div><div className="text-2xl font-bold text-green-600">{globalStats.collected}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle>Order Ledger</CardTitle>
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
                  <SelectItem value="cancelled">Cancelled</SelectItem>
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
          ) : orders.length === 0 ? (
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
                      <Checkbox checked={selectedIds.size === orders.length && orders.length > 0}
                        onCheckedChange={toggleSelectAll} />
                    </TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Campus</TableHead>
                    <TableHead>Amount (Paid)</TableHead>
                    <TableHead>Platform Fee</TableHead>
                    <TableHead>Payment</TableHead> 
                    <TableHead>Order Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const grandTotal = Number(order.total) || 0;
                    const fee = Number(order.platform_fee) || 0;
                    
                    return (
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
                        
                        <TableCell className="font-semibold">{formatCurrency(grandTotal)}</TableCell>
                        
                        <TableCell>
                          {fee > 0 ? (
                            <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs border border-green-100">
                              +{formatCurrency(fee)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">₹0</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {getPaymentBadge(order.payment_status)}
                        </TableCell>

                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        
                        <TableCell className="text-sm text-muted-foreground">{format(new Date(order.created_at), 'MMM d, h:mm a')}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(order)}>
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50">
                <div className="text-sm text-muted-foreground font-medium">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} orders
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * pageSize >= totalCount || isLoading}>
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>

            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Order #{selectedOrder?.order_number}</DialogTitle>
            <DialogDescription>Full financial and order details</DialogDescription>
          </DialogHeader>
          {selectedOrder && (() => {
            // 🦅 THE FIX 2: Mathematical Transparency in the Modal
            const grandTotal = Number(selectedOrder.total) || 0;
            const fee = Number(selectedOrder.platform_fee) || 0;
            const discountAmount = Number(selectedOrder.discount_amount) || 0;
            const promoCode = selectedOrder.promo_code || 'PROMO';
            
            // Reconstruct the original, un-discounted food subtotal
            const originalFoodCost = (grandTotal - fee) + discountAmount;
            
            const isPaid = selectedOrder.payment_status?.toLowerCase() === 'completed' || 
                           selectedOrder.payment_status?.toLowerCase() === 'confirmed' || 
                           selectedOrder.payment_status?.toLowerCase() === 'paid';

            return (
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
                    <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment</p>
                    <div className="mt-1">{getPaymentBadge(selectedOrder.payment_status)}</div>
                  </div>
                </div>

                {selectedOrder.razorpay_payment_id && (
                  <div>
                    <p className="text-sm text-muted-foreground">Razorpay Payment ID</p>
                    <p className="font-mono text-xs bg-gray-50 p-1.5 rounded border inline-block mt-1">{selectedOrder.razorpay_payment_id}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <Landmark size={14} /> Financial Breakdown
                  </p>
                  <div className="space-y-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
                    {selectedOrder.order_items?.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm text-gray-600">
                        <span>{item.name} × {item.quantity}</span>
                        <span>{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    ))}
                    
                    <div className="border-t border-dashed border-gray-200 my-2 pt-2"></div>
                    
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Food Subtotal</span>
                      <span>{formatCurrency(originalFoodCost)}</span>
                    </div>

                    {/* 🦅 NEW: Beautiful explicit discount line */}
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-sm text-emerald-600 font-bold">
                        <span>Discount applied ({promoCode})</span>
                        <span>-{formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-green-700">Platform Fee (Profit)</span>
                      <span className="font-bold text-green-700">+{formatCurrency(fee)}</span>
                    </div>

                    <div className="border-t border-gray-200 my-2 pt-2"></div>

                    <div className="flex justify-between font-black text-base">
                      <span>Grand Total (Paid)</span>
                      <span>{formatCurrency(grandTotal)}</span>
                    </div>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Notes</p>
                    <p className="text-sm bg-yellow-50 p-2 rounded border border-yellow-100 text-yellow-800 mt-1">{selectedOrder.notes}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-muted-foreground font-semibold">Created</p>
                    <p>{format(new Date(selectedOrder.created_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-semibold">Last Updated</p>
                    <p>{format(new Date(selectedOrder.updated_at), 'MMM d, yyyy h:mm a')}</p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-3">
                  
                  {isPaid && selectedOrder.status !== 'refunded' && (
                    <Button 
                      variant="outline" 
                      className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 font-bold shadow-sm"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to issue a full refund for this order via Razorpay?')) {
                          toast.promise(processRefund.mutateAsync(selectedOrder.id), {
                            loading: 'Processing secure refund...',
                            success: 'Refund issued successfully!',
                            error: (err) => `Refund failed: ${err.message}`
                          });
                        }
                      }}
                      disabled={processRefund.isPending || isUpdating}
                    >
                      {processRefund.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                      Issue Full Refund
                    </Button>
                  )}

                  {selectedOrder.status !== 'failed' && selectedOrder.status !== 'expired' && selectedOrder.status !== 'collected' && selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'refunded' && (
                    <div>
                      <Button 
                        variant="destructive" 
                        className="w-full bg-red-600 hover:bg-red-700 font-bold shadow-sm" 
                        onClick={() => handleCancelOrder(selectedOrder.id)}
                        disabled={isUpdating || processRefund.isPending}
                      >
                        {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
                        Force Cancel & Expire Order
                      </Button>
                      <p className="text-[10px] text-center text-muted-foreground mt-2">
                        Warning: This instantly marks the order as cancelled. Use only for customer disputes or out-of-stock items.
                      </p>
                    </div>
                  )}

                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}