import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Power, RefreshCw, CheckCircle, XCircle, Package,
  Clock, Shield, Loader2, FileText, Download, Search, AlertOctagon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── TYPES ───
interface ActiveOrder {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string | null;
  total: number;
  status: string;
  payment_status: string | null;
  razorpay_payment_id: string | null;
  created_at: string;
  campus_id: string;
  campus?: { name: string; code: string };
  order_items?: Array<{ id: string; name: string; quantity: number; price: number }>;
}

interface RefundEntry {
  id: string;
  order_number: string;
  customer_name: string | null;
  amount: number;
  reason: string;
  razorpay_payment_id: string | null;
  refund_status: string;
  created_at: string;
}

const REJECT_REASONS = [
  'Item out of stock',
  'Kitchen busy / overwhelmed',
  'Canteen closing soon',
  'Equipment malfunction',
  'Order unclear / invalid',
  'Other',
];

// ─── KILL SWITCH SECTION ───
function KillSwitchPanel() {
  const [isPaused, setIsPaused] = useState(false);
  const [pausedAt, setPausedAt] = useState<string | null>(null);
  const [reason, setReason] = useState('Kitchen overwhelmed');
  const [isToggling, setIsToggling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    const { data } = await supabase
      .from('platform_settings')
      .select('orders_paused, orders_paused_at, orders_paused_reason')
      .single();
    if (data) {
      setIsPaused(data.orders_paused ?? false);
      setPausedAt(data.orders_paused_at ?? null);
      setReason(data.orders_paused_reason ?? 'Kitchen overwhelmed');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Real-time sync
  useEffect(() => {
    const ch = supabase
      .channel('kill-switch-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'platform_settings' }, (payload) => {
        const d = payload.new as any;
        setIsPaused(d.orders_paused ?? false);
        setPausedAt(d.orders_paused_at ?? null);
        setReason(d.orders_paused_reason ?? 'Kitchen overwhelmed');
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggleKillSwitch = async () => {
    setIsToggling(true);
    const newState = !isPaused;

    // Optimistic update
    setIsPaused(newState);
    if (newState) setPausedAt(new Date().toISOString());

    const { error } = await supabase
      .from('platform_settings')
      .update({
        orders_paused: newState,
        orders_paused_at: newState ? new Date().toISOString() : null,
        orders_paused_reason: newState ? reason : null,
      } as any)
      .neq('id', '00000000-0000-0000-0000-000000000000'); // update all rows

    if (error) {
      setIsPaused(!newState); // rollback
      toast.error('Failed to toggle kill switch');
    } else {
      toast.success(newState ? '🚨 Orders PAUSED across all campuses' : '✅ Orders RESUMED — accepting orders again');
    }
    setIsToggling(false);
  };

  if (isLoading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>;
  }

  return (
    <Card className={cn(
      "border-2 transition-all",
      isPaused ? "border-destructive bg-destructive/5" : "border-green-500/30 bg-green-500/5"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", isPaused ? "bg-destructive/10" : "bg-green-500/10")}>
            {isPaused ? <AlertOctagon className="h-6 w-6 text-destructive" /> : <Shield className="h-6 w-6 text-green-600" />}
          </div>
          <div>
            <CardTitle className="text-lg">Global Kill Switch</CardTitle>
            <CardDescription>
              {isPaused
                ? `Orders paused ${pausedAt ? format(new Date(pausedAt), 'h:mm a') + ' onwards' : ''}`
                : 'System is accepting orders normally'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {isPaused ? '🔴 ORDERS PAUSED' : '🟢 ORDERS ACTIVE'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPaused ? 'Students cannot checkout. Toggle off to resume.' : 'All campuses are accepting orders.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isToggling && <Loader2 className="h-4 w-4 animate-spin" />}
            <Switch
              checked={isPaused}
              onCheckedChange={toggleKillSwitch}
              disabled={isToggling}
              className={cn(isPaused && "data-[state=checked]:bg-destructive")}
            />
          </div>
        </div>

        {!isPaused && (
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-xs font-medium text-muted-foreground">Pause reason (shown to students)</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Kitchen overwhelmed"
              className="text-sm"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── ACTIVE ORDERS TABLE ───
function ActiveOrdersPanel() {
  const { filters } = useSuperAdmin();
  const { user } = useAuth();
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});

  // Reject modal state
  const [rejectOrder, setRejectOrder] = useState<ActiveOrder | null>(null);
  const [rejectReason, setRejectReason] = useState(REJECT_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .from('orders')
      .select(`
        id, order_number, customer_name, customer_email, total, status,
        payment_status, razorpay_payment_id, created_at, campus_id,
        campus:campuses(name, code),
        order_items(id, name, quantity, price)
      `)
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (filters.campusId) query = query.eq('campus_id', filters.campusId);

    const { data, error } = await query;
    if (error) toast.error('Failed to load active orders');
    else setOrders((data || []) as ActiveOrder[]);
    setIsLoading(false);
  }, [filters.campusId]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Real-time
  useEffect(() => {
    const ch = supabase
      .channel('ops-active-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrders]);

  const forceAction = async (order: ActiveOrder, newStatus: string, label: string) => {
    setActionLoading(prev => ({ ...prev, [order.id]: label }));

    // Optimistic
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o));

    // Build update payload — Force Accept must also set payment_status + commission
    const updatePayload: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    if (newStatus === 'confirmed' && order.status === 'pending') {
      // Force Accept: mark payment as completed so kiosk scanner works
      updatePayload.payment_status = 'completed';
      // Calculate commission so settlement math is correct
      const commissionRate = 0.10; // fallback, campus rate applied server-side
      updatePayload.commission_amount = Math.round(order.total * commissionRate * 100) / 100;
    }

    const { error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id);

    if (error) {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: order.status } : o)); // rollback
      toast.error(`Failed to ${label.toLowerCase()} order`);
    } else {
      toast.success(`Order #${order.order_number} → ${newStatus.toUpperCase()}`);
      // Remove from list if terminal state
      if (['collected', 'failed'].includes(newStatus)) {
        setTimeout(() => setOrders(prev => prev.filter(o => o.id !== order.id)), 600);
      }
    }
    setActionLoading(prev => { const n = { ...prev }; delete n[order.id]; return n; });
  };

  const handleForceReject = async () => {
    if (!rejectOrder || !user) return;
    setIsRejecting(true);

    const finalReason = rejectReason === 'Other' ? customReason : rejectReason;

    // 1. Update order to failed
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'failed' as any,
        rejection_reason: finalReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rejectOrder.id);

    if (orderError) {
      toast.error('Failed to reject order');
      setIsRejecting(false);
      return;
    }

    // 2. Log to refund ledger
    await supabase.from('refund_ledger' as any).insert({
      order_id: rejectOrder.id,
      order_number: rejectOrder.order_number,
      campus_id: rejectOrder.campus_id,
      customer_name: rejectOrder.customer_name,
      customer_email: rejectOrder.customer_email,
      amount: rejectOrder.total,
      reason: finalReason,
      razorpay_payment_id: rejectOrder.razorpay_payment_id,
      created_by: user.id,
    });

    // 3. Optimistic removal
    setOrders(prev => prev.filter(o => o.id !== rejectOrder.id));
    toast.success(`Order #${rejectOrder.order_number} rejected & logged for refund (₹${rejectOrder.total})`);

    setRejectOrder(null);
    setRejectReason(REJECT_REASONS[0]);
    setCustomReason('');
    setIsRejecting(false);
  };

  const filtered = orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return o.order_number?.toLowerCase().includes(s) || o.customer_name?.toLowerCase().includes(s);
  });

  const formatCurrency = (v: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-amber-500" />
                Live Active Orders
              </CardTitle>
              <CardDescription>Force-manage orders when tablets are down</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <Button variant="outline" size="sm" onClick={fetchOrders} disabled={isLoading}>
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
              <h3 className="font-semibold">No Active Orders</h3>
              <p className="text-sm text-muted-foreground">All orders are resolved</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Campus</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="text-right">Emergency Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((order) => {
                    const loading = actionLoading[order.id];
                    return (
                      <TableRow key={order.id} className={cn(loading && "opacity-60")}>
                        <TableCell className="font-mono font-medium text-sm">{order.order_number}</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{order.customer_name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                        </TableCell>
                        <TableCell><Badge variant="outline">{order.campus?.code || 'N/A'}</Badge></TableCell>
                        <TableCell className="font-semibold">{formatCurrency(order.total)}</TableCell>
                        <TableCell>
                          <Badge variant={order.status === 'confirmed' ? 'default' : 'secondary'} className="gap-1">
                            {order.status === 'confirmed' ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(order.created_at), 'h:mm a')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {order.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-green-500/30 text-green-600 hover:bg-green-500/10"
                                onClick={() => forceAction(order, 'confirmed', 'Accept')}
                                disabled={!!loading}
                              >
                                {loading === 'Accept' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                Accept
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => setRejectOrder(order)}
                              disabled={!!loading}
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Reject
                            </Button>
                            {order.status === 'confirmed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
                                onClick={() => forceAction(order, 'collected', 'Complete')}
                                disabled={!!loading}
                              >
                                {loading === 'Complete' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3 mr-1" />}
                                Complete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Modal */}
      <Dialog open={!!rejectOrder} onOpenChange={(open) => { if (!open) setRejectOrder(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Force Reject Order
            </DialogTitle>
            <DialogDescription>
              Order #{rejectOrder?.order_number} · {formatCurrency(rejectOrder?.total || 0)} will be rejected and logged for manual refund.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Rejection Reason</label>
              <Select value={rejectReason} onValueChange={setRejectReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REJECT_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {rejectReason === 'Other' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Reason</label>
                <Textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Describe the reason..."
                  rows={2}
                />
              </div>
            )}

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">⚠️ This will:</p>
              <ul className="list-disc list-inside text-xs text-muted-foreground mt-1 space-y-0.5">
                <li>Set order status to <strong>FAILED</strong></li>
                <li>Log <strong>{formatCurrency(rejectOrder?.total || 0)}</strong> in the Refund Ledger</li>
                <li>Student will see "Order Rejected" on their phone</li>
                {rejectOrder?.razorpay_payment_id && (
                  <li>Razorpay ID: <code className="text-xs">{rejectOrder.razorpay_payment_id}</code></li>
                )}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOrder(null)} disabled={isRejecting}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleForceReject}
              disabled={isRejecting || (rejectReason === 'Other' && !customReason.trim())}
            >
              {isRejecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Reject & Log Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── REFUND LEDGER ───
function RefundLedgerPanel() {
  const [entries, setEntries] = useState<RefundEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('refund_ledger' as any)
      .select('id, order_number, customer_name, amount, reason, razorpay_payment_id, refund_status, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    setEntries((data || []) as unknown as RefundEntry[]);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const markRefunded = async (id: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, refund_status: 'refunded' } : e));
    const { error } = await supabase
      .from('refund_ledger' as any)
      .update({ refund_status: 'refunded', refunded_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, refund_status: 'pending' } : e));
      toast.error('Failed to update');
    } else {
      toast.success('Marked as refunded');
    }
  };

  const formatCurrency = (v: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v);

  const totalPending = entries.filter(e => e.refund_status === 'pending').reduce((s, e) => s + e.amount, 0);

  const exportCSV = () => {
    const headers = ['Order', 'Customer', 'Amount', 'Reason', 'Razorpay ID', 'Status', 'Date'];
    const rows = entries.map(e => [
      e.order_number, e.customer_name || '', e.amount, e.reason,
      e.razorpay_payment_id || '', e.refund_status,
      format(new Date(e.created_at), 'yyyy-MM-dd HH:mm')
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `refund-ledger-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Exported refund ledger');
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-500" />
              Refund Ledger
            </CardTitle>
            <CardDescription>
              {totalPending > 0 ? `Pending refunds: ${formatCurrency(totalPending)}` : 'No pending refunds'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={entries.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-3" />
            <h3 className="font-semibold">No Refunds Logged</h3>
            <p className="text-sm text-muted-foreground">Rejected orders will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Razorpay ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-sm">{entry.order_number}</TableCell>
                    <TableCell className="text-sm">{entry.customer_name || 'Unknown'}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(entry.amount)}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{entry.reason}</TableCell>
                    <TableCell className="font-mono text-xs">{entry.razorpay_payment_id || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={entry.refund_status === 'refunded' ? 'default' : 'secondary'}>
                        {entry.refund_status === 'refunded' ? '✅ Refunded' : '⏳ Pending'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.refund_status === 'pending' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markRefunded(entry.id)}>
                          Mark Refunded
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── MISSING IMPORT SHIM ───
function Activity(props: any) {
  return <Clock {...props} />;
}

// ─── MAIN EXPORT ───
export function Operations() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Power className="h-6 w-6 text-destructive" /> God Mode Operations
        </h1>
        <p className="text-muted-foreground text-sm">Emergency failsafes and manual overrides</p>
      </div>

      <KillSwitchPanel />
      <ActiveOrdersPanel />
      <RefundLedgerPanel />
    </div>
  );
}
