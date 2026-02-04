import { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, 
  Check, 
  Clock, 
  RefreshCw,
  Search,
  Plus,
  IndianRupee
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { Settlement } from '@/types/superAdmin';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function Settlements() {
  const { filters, campuses, refreshData } = useSuperAdmin();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Mark as Paid Dialog
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Create Settlement Dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSettlement, setNewSettlement] = useState({
    campusId: '',
    periodStart: '',
    periodEnd: '',
  });

  const fetchSettlements = useCallback(async () => {
    setIsLoading(true);
    
    let query = supabase
      .from('settlements')
      .select(`
        *,
        campus:campuses(name, code, owner_name, upi_id)
      `)
      .order('created_at', { ascending: false });

    if (filters.campusId) {
      query = query.eq('campus_id', filters.campusId);
    }
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching settlements:', error);
      toast.error('Failed to load settlements');
    } else {
      setSettlements((data || []) as Settlement[]);
    }
    
    setIsLoading(false);
  }, [filters.campusId, statusFilter]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const handleMarkAsPaid = async () => {
    if (!selectedSettlement || !paymentRef.trim()) {
      toast.error('Please enter a payment reference');
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from('settlements')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_reference: paymentRef.trim(),
          notes: paymentNotes.trim() || null,
        })
        .eq('id', selectedSettlement.id);

      if (error) throw error;

      toast.success('Settlement marked as paid');
      fetchSettlements();
      refreshData();
      setSelectedSettlement(null);
      setPaymentRef('');
      setPaymentNotes('');
    } catch (err) {
      console.error('Error marking settlement as paid:', err);
      toast.error('Failed to update settlement');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateSettlement = async () => {
    if (!newSettlement.campusId || !newSettlement.periodStart || !newSettlement.periodEnd) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsProcessing(true);

    try {
      const selectedCampus = campuses.find(c => c.id === newSettlement.campusId);
      if (!selectedCampus) throw new Error('Campus not found');

      // Calculate totals from orders
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('total, commission_amount')
        .eq('campus_id', newSettlement.campusId)
        .eq('status', 'confirmed')
        .gte('created_at', newSettlement.periodStart)
        .lte('created_at', newSettlement.periodEnd);

      if (orderError) throw orderError;

      const totalSales = (orderData || []).reduce((sum, o) => sum + (o.total || 0), 0);
      const commissionAmount = (orderData || []).reduce((sum, o) => sum + (o.commission_amount || 0), 0);
      const netPayable = totalSales - commissionAmount;

      const { error } = await supabase
        .from('settlements')
        .insert({
          campus_id: newSettlement.campusId,
          period_start: newSettlement.periodStart,
          period_end: newSettlement.periodEnd,
          total_sales: totalSales,
          total_orders: (orderData || []).length,
          commission_amount: commissionAmount,
          net_payable: netPayable,
          status: 'pending',
        });

      if (error) throw error;

      toast.success('Settlement created successfully');
      fetchSettlements();
      setShowCreateDialog(false);
      setNewSettlement({ campusId: '', periodStart: '', periodEnd: '' });
    } catch (err) {
      console.error('Error creating settlement:', err);
      toast.error('Failed to create settlement');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      pending: { variant: 'secondary', label: 'Pending' },
      processing: { variant: 'outline', label: 'Processing' },
      paid: { variant: 'default', label: 'Paid' },
      disputed: { variant: 'destructive', label: 'Disputed' },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredSettlements = settlements.filter(settlement => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      settlement.campus?.name?.toLowerCase().includes(search) ||
      settlement.campus?.code?.toLowerCase().includes(search) ||
      settlement.payment_reference?.toLowerCase().includes(search)
    );
  });

  // Calculate summary stats
  const totalPending = settlements
    .filter(s => s.status === 'pending')
    .reduce((sum, s) => sum + s.net_payable, 0);
  const totalPaid = settlements
    .filter(s => s.status === 'paid')
    .reduce((sum, s) => sum + s.net_payable, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settlements</h1>
          <p className="text-muted-foreground">
            Manage campus payouts and track financial settlements
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchSettlements} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Settlement
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Payouts</p>
                <p className="text-xl font-bold">{formatCurrency(totalPending)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-xl font-bold">{formatCurrency(totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Settlements</p>
                <p className="text-xl font-bold">{settlements.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Settlement History</CardTitle>
              <CardDescription>
                View and manage all campus settlements
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="disputed">Disputed</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search settlements..."
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
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-9 w-24" />
                </div>
              ))}
            </div>
          ) : filteredSettlements.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                <Wallet className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">No Settlements Found</h3>
              <p className="text-muted-foreground mt-1">
                Create your first settlement to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campus</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Total Sales</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Net Payable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSettlements.map((settlement) => (
                    <TableRow key={settlement.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{settlement.campus?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">
                            {settlement.campus?.code}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{format(new Date(settlement.period_start), 'MMM d, yyyy')}</p>
                          <p className="text-muted-foreground">
                            to {format(new Date(settlement.period_end), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(settlement.total_sales)}</TableCell>
                      <TableCell className="text-destructive">
                        -{formatCurrency(settlement.commission_amount)}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(settlement.net_payable)}
                      </TableCell>
                      <TableCell>{getStatusBadge(settlement.status)}</TableCell>
                      <TableCell className="text-right">
                        {settlement.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => setSelectedSettlement(settlement)}
                          >
                            <IndianRupee className="h-4 w-4 mr-1" />
                            Mark as Paid
                          </Button>
                        )}
                        {settlement.status === 'paid' && settlement.payment_reference && (
                          <span className="text-xs text-muted-foreground">
                            Ref: {settlement.payment_reference}
                          </span>
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

      {/* Mark as Paid Dialog */}
      <Dialog open={!!selectedSettlement} onOpenChange={() => setSelectedSettlement(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Settlement as Paid</DialogTitle>
            <DialogDescription>
              Enter the bank transaction reference to confirm payment of{' '}
              <strong>{formatCurrency(selectedSettlement?.net_payable || 0)}</strong> to{' '}
              <strong>{selectedSettlement?.campus?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-ref">Bank Transaction Reference *</Label>
              <Input
                id="payment-ref"
                placeholder="e.g., UTR123456789"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes (Optional)</Label>
              <Textarea
                id="payment-notes"
                placeholder="Any additional notes..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSettlement(null)}>
              Cancel
            </Button>
            <Button onClick={handleMarkAsPaid} disabled={isProcessing || !paymentRef.trim()}>
              {isProcessing ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Settlement Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Settlement</DialogTitle>
            <DialogDescription>
              Generate a settlement for a specific campus and time period.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campus">Select Campus *</Label>
              <Select
                value={newSettlement.campusId}
                onValueChange={(value) => setNewSettlement(prev => ({ ...prev, campusId: value }))}
              >
                <SelectTrigger id="campus">
                  <SelectValue placeholder="Choose a campus" />
                </SelectTrigger>
                <SelectContent>
                  {campuses.map((campus) => (
                    <SelectItem key={campus.id} value={campus.id}>
                      {campus.name} ({campus.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period-start">Period Start *</Label>
                <Input
                  id="period-start"
                  type="date"
                  value={newSettlement.periodStart}
                  onChange={(e) => setNewSettlement(prev => ({ ...prev, periodStart: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period-end">Period End *</Label>
                <Input
                  id="period-end"
                  type="date"
                  value={newSettlement.periodEnd}
                  onChange={(e) => setNewSettlement(prev => ({ ...prev, periodEnd: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSettlement} disabled={isProcessing}>
              {isProcessing ? 'Creating...' : 'Generate Settlement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
