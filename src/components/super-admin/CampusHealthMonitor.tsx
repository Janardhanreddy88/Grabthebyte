import { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Building2,
  ShoppingBag,
  AlertTriangle,
  Clock,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface CampusHealth {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  orders_today: number;
  revenue_today: number;
  last_order_at: string | null;
  low_stock_items: number;
}

export function CampusHealthMonitor() {
  const [campuses, setCampuses] = useState<CampusHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase.rpc('get_campus_health');
    if (!error && data) {
      setCampuses(data as unknown as CampusHealth[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  };

  const getHealthStatus = (campus: CampusHealth) => {
    if (!campus.is_active) return { label: 'Offline', color: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground' };
    if (campus.low_stock_items > 3) return { label: 'Low Stock', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', dot: 'bg-amber-500' };
    if (campus.orders_today > 0) return { label: 'Active', color: 'bg-green-500/10 text-green-600 border-green-500/20', dot: 'bg-green-500' };
    return { label: 'Idle', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', dot: 'bg-blue-500' };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Campus Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm sm:text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Campus Health Monitor
          </CardTitle>
          <CardDescription className="text-xs">Live status of all campuses</CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchHealth}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </CardHeader>
      <CardContent>
        {campuses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No campuses found</p>
        ) : (
          <div className="space-y-3">
            {campuses.map(campus => {
              const health = getHealthStatus(campus);
              return (
                <div 
                  key={campus.id} 
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-colors",
                    !campus.is_active && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", health.dot, campus.is_active && campus.orders_today > 0 && "animate-pulse")} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{campus.name}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5">{campus.code}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <ShoppingBag className="h-3 w-3" />
                          {campus.orders_today} orders
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(campus.revenue_today)}
                        </span>
                        {campus.low_stock_items > 0 && (
                          <span className="text-xs text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {campus.low_stock_items} low stock
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5", health.color)}>
                      {health.label}
                    </Badge>
                    {campus.last_order_at && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDistanceToNow(new Date(campus.last_order_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
