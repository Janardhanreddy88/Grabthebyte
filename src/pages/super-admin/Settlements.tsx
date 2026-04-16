import { useState, useEffect, useCallback } from 'react';
import { 
  Landmark, Wallet, CheckCircle2, ArrowRightLeft, 
  RefreshCw, Building2, AlertCircle, Loader2, Calendar, 
  X, History, ExternalLink, Clock 
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export function Settlements() {
  const { filters } = useSuperAdmin();
  const [settlements, setSettlements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const fetchSettlements = useCallback(async () => {
    setIsLoading(true);
    
    // 🔍 Fetching logic with X-Ray error catching
    let query = supabase
      .from('settlements')
      .select('*, campuses(name)') // Removed campus_code just in case it doesn't exist in your DB to prevent crashes!
      .order('created_at', { ascending: false });

    if (filters.campusId) query = query.eq('campus_id', filters.campusId);
    
    if (selectedDate) {
        // 🕰️ TIMEZONE FIX: Calculate exact local start and end of day
        const [year, month, day] = selectedDate.split('-').map(Number);
        
        const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);

        // .toISOString() automatically converts your local IST boundaries to perfect UTC
        query = query.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      console.error("🚨 SUPABASE ERROR:", error);
      toast.error(`Database Error: ${error.message}`);
    } else {
      setSettlements(data || []);
    }
    
    setIsLoading(false);
  }, [filters.campusId, selectedDate]);

  useEffect(() => {
    fetchSettlements();

    // 🔥 REAL-TIME: If Razorpay settles while you are looking at the screen, it updates!
    const channel = supabase
      .channel('auto-settlements')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settlements' }, () => {
        fetchSettlements();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchSettlements]);

  const totalSettled = settlements
    .filter(s => s.status === 'SETTLED')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  const totalPending = settlements
    .filter(s => s.status === 'PENDING')
    .reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Ledger</h1>
          <p className="text-muted-foreground text-sm font-medium px-2 py-1 bg-primary/10 rounded w-fit mt-1">
            ⚡ 100% Automated Razorpay Route
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border rounded-md px-3 h-10 shadow-sm relative">
            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-none bg-transparent text-sm focus:outline-none"
            />
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate('')} 
                className="ml-2 text-gray-400 hover:text-gray-600 focus:outline-none"
                title="Clear date filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={fetchSettlements}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-emerald-800 mb-1">Total Settled (To Bank)</p>
            <h2 className="text-3xl font-black text-emerald-700">
              ₹{totalSettled.toLocaleString('en-IN')}
            </h2>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-amber-800 mb-1">In-Transit (T+2 Days)</p>
            <h2 className="text-3xl font-black text-amber-700">
              ₹{totalPending.toLocaleString('en-IN')}
            </h2>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>Records are automatically updated via Razorpay Webhooks.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campus</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Platform Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bank UTR / Ref</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-10">Syncing with Razorpay...</TableCell></TableRow>
              ) : settlements.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground">No transaction records found.</TableCell></TableRow>
              ) : (
                settlements.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-bold">{s.campuses?.name || 'Unknown Campus'}</div>
                    </TableCell>
                    <TableCell className="font-bold text-gray-900">₹{s.amount}</TableCell>
                    <TableCell className="text-emerald-600 font-medium">+₹{s.platform_fee}</TableCell>
                    <TableCell>
                      {s.status === 'SETTLED' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Settled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                          <Clock className="h-3 w-3 mr-1" /> Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {s.utr_number || 'Processing...'}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {format(new Date(s.created_at), 'MMM d, h:mm a')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}