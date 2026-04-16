import { useState, useEffect, useCallback } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  IndianRupee, 
  Wallet, 
  ShoppingBag, 
  Clock,
  AlertCircle,
  ArrowRight,
  Activity,
  Users,
  Building2,
  RefreshCw,
  Loader2,
  Package,
  CheckCircle2,
  XCircle,
  BarChart3,
  Landmark,
  CalendarRange
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CampusHealthMonitor } from '@/components/super-admin/CampusHealthMonitor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { toast } from 'sonner';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  isLoading?: boolean;
}

function StatCard({ title, value, subtitle, icon: Icon, trend, trendValue, variant = 'default', isLoading }: StatCardProps) {
  const variantStyles = {
    default: 'bg-card',
    primary: 'bg-primary/5 border-primary/20',
    success: 'bg-green-500/5 border-green-500/20',
    warning: 'bg-amber-500/5 border-amber-500/20',
    destructive: 'bg-destructive/5 border-destructive/20',
  };
  const iconStyles = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    success: 'bg-green-500/10 text-green-600 dark:text-green-400',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    destructive: 'bg-destructive/10 text-destructive',
  };

  if (isLoading) {
    return (
      <Card className={cn("relative overflow-hidden", variantStyles[variant])}>
        <CardContent className="p-3 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2"><Skeleton className="h-3 w-16 sm:h-4 sm:w-24" /><Skeleton className="h-6 w-20 sm:h-8 sm:w-32" /></div>
            <Skeleton className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("relative overflow-hidden transition-all hover:shadow-md", variantStyles[variant])}>
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-lg sm:text-2xl font-bold tracking-tight">{value}</p>
            {(subtitle || trendValue) && (
              <div className="flex items-center gap-1.5">
                {trendValue && (
                  <span className={cn("flex items-center text-[10px] sm:text-xs font-medium",
                    trend === 'up' && "text-green-600 dark:text-green-400",
                    trend === 'down' && "text-destructive"
                  )}>
                    {trend === 'up' && <TrendingUp className="h-3 w-3 mr-0.5" />}
                    {trend === 'down' && <TrendingDown className="h-3 w-3 mr-0.5" />}
                    {trendValue}
                  </span>
                )}
                {subtitle && <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">{subtitle}</span>}
              </div>
            )}
          </div>
          <div className={cn("p-2 sm:p-3 rounded-lg sm:rounded-xl shrink-0", iconStyles[variant])}>
            <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface RecentOrder {
  id: string;
  order_number: string;
  total: number;
  status: string;
  payment_status: string | null;
  customer_name: string | null;
  created_at: string;
}

interface TopItem { name: string; count: number; }
interface UserStats { total_users: number; admins: number; students: number; kiosk_users: number; }
interface WeeklyData { day: string; gmv: number; profit: number; orders: number; }
interface LedgerStats { total_gmv: number; platform_revenue: number; canteen_payout: number; pending_payout: number; }

export function SuperAdminDashboard() {
  const { dashboardStats, platformSettings, pendingCount, isLoading, filters, campuses, refreshData } = useSuperAdmin();
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [ledgerStats, setLedgerStats] = useState<LedgerStats>({ total_gmv: 0, platform_revenue: 0, canteen_payout: 0, pending_payout: 0 });
  const [extraLoading, setExtraLoading] = useState(true);
  
  // 🟢 UPGRADE 2: Date Range State
  const [dateRange, setDateRange] = useState<string>('7d');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  };

  const fetchExtra = useCallback(async () => {
    setExtraLoading(true);
    try {
      // Calculate start date based on selected range
      let startDate = null;
      const now = new Date();
      if (dateRange === 'today') {
        startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      } else if (dateRange === '7d') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        startDate = d.toISOString();
      } else if (dateRange === '30d') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        startDate = d.toISOString();
      }

      // Fetch Ledger Stats with Date Filtering
      const { data: ledgerData } = await supabase.rpc('get_ledger_stats', { 
        p_campus_id: filters.campusId || null,
        p_start_date: startDate,
        p_end_date: null
      });
      if (ledgerData) setLedgerStats(ledgerData as unknown as LedgerStats);

      // Fetch Recent Orders (Limit 8)
      let ordersQuery = supabase.from('orders').select('id, order_number, total, status, payment_status, customer_name, created_at').order('created_at', { ascending: false }).limit(8);
      if (filters.campusId) ordersQuery = ordersQuery.eq('campus_id', filters.campusId);
      const { data: ordersData } = await ordersQuery;
      setRecentOrders((ordersData as RecentOrder[]) || []);

      // Fetch Top Items (Always last 7 days for relevance, or adapt to dateRange if preferred)
      const itemFilterDate = startDate || new Date(new Date().setDate(now.getDate() - 30)).toISOString();
      const { data: campusOrders } = await supabase.from('orders').select('id').gte('created_at', itemFilterDate);
      const orderIds = (campusOrders || []).map(o => o.id);
      
      if (orderIds.length > 0) {
        const { data: itemsData } = await supabase.from('order_items').select('name, quantity').in('order_id', orderIds.slice(0, 300));
        if (itemsData) {
          const itemCounts = new Map<string, number>();
          itemsData.forEach(item => itemCounts.set(item.name, (itemCounts.get(item.name) || 0) + item.quantity));
          setTopItems(Array.from(itemCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5));
        }
      } else {
        setTopItems([]);
      }

      // User stats
      const { data: userStatsData } = await supabase.rpc('get_campus_user_stats', { p_campus_id: filters.campusId });
      if (userStatsData) setUserStats(userStatsData as unknown as UserStats);

      // 🟢 UPGRADE 3: Fetch Chart Data directly from the financial ledger to plot Profit vs GMV
      const chartDays = dateRange === '30d' ? 30 : 7;
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (chartDays - 1));
      weekStart.setHours(0, 0, 0, 0);

      let ledgerQuery = supabase.from('financial_ledger').select('total_order_value, platform_fee, created_at').gte('created_at', weekStart.toISOString());
      if (filters.campusId) ledgerQuery = ledgerQuery.eq('campus_id', filters.campusId);
      const { data: ledgerRows } = await ledgerQuery;

      const dayMap = new Map<string, { gmv: number; profit: number; orders: number }>();
      for (let i = chartDays - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        dayMap.set(format(d, 'yyyy-MM-dd'), { gmv: 0, profit: 0, orders: 0 });
      }
      
      (ledgerRows || []).forEach(row => {
        const key = format(new Date(row.created_at), 'yyyy-MM-dd');
        const entry = dayMap.get(key);
        if (entry) { 
          entry.gmv += row.total_order_value || 0; 
          entry.profit += row.platform_fee || 0;
          entry.orders += 1; 
        }
      });

      const weekData: WeeklyData[] = [];
      for (let i = chartDays - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = format(d, 'yyyy-MM-dd');
        const entry = dayMap.get(key) || { gmv: 0, profit: 0, orders: 0 };
        weekData.push({ 
          day: chartDays > 7 ? format(d, 'dd MMM') : format(d, 'EEE'), 
          gmv: entry.gmv, 
          profit: entry.profit, 
          orders: entry.orders 
        });
      }
      setWeeklyData(weekData);

    } catch (err) {
      console.error('Error fetching dashboard extras:', err);
    } finally {
      setExtraLoading(false);
    }
  }, [filters.campusId, dateRange]);

  useEffect(() => { fetchExtra(); }, [fetchExtra]);

  // 🟢 UPGRADE 1: Live Ticker Realtime Connection
  useEffect(() => {
    const channel = supabase.channel('dashboard-live-ticker')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'financial_ledger' }, (payload) => {
        toast.success("New payment processed! Updating dashboard...", { icon: '💰' });
        fetchExtra(); // Silently refresh the charts and numbers
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [fetchExtra]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'collected': return <Package className="h-4 w-4 text-muted-foreground" />;
      case 'failed': case 'expired': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400';
      case 'collected': return 'border-muted bg-muted text-muted-foreground';
      case 'failed': case 'expired': return 'border-destructive/30 bg-destructive/10 text-destructive';
      default: return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">GrabTheByte Command Center</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <Badge variant="outline" className={cn("gap-1.5 py-1.5 px-3 text-xs border-none shadow-none",
            platformSettings?.manual_verification_enabled 
              ? "text-amber-600 bg-amber-500/10"
              : "text-green-600 bg-green-500/10"
          )}>
            <Activity className="h-3.5 w-3.5" />
            {platformSettings?.manual_verification_enabled ? "Manual" : "Auto Gateway"}
          </Badge>
          
          <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>
          
          {/* 🟢 UPGRADE 2: Date Range Picker UI */}
          <div className="relative flex items-center">
            <CalendarRange className="w-4 h-4 text-gray-500 absolute left-2 pointer-events-none" />
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="pl-8 pr-8 py-1.5 text-xs font-bold bg-gray-50 border-none rounded-lg text-gray-700 appearance-none focus:ring-0 cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-gray-100" onClick={() => fetchExtra()}>
            <RefreshCw className={cn("h-4 w-4 text-gray-600", extraLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* 4-Column CFO Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard 
          title="Total GMV" 
          value={formatCurrency(ledgerStats.total_gmv)}
          subtitle="Gross transaction volume" 
          icon={IndianRupee} 
          variant="primary" 
          isLoading={extraLoading} 
        />
        <StatCard 
          title="Platform Revenue" 
          value={formatCurrency(ledgerStats.platform_revenue)}
          subtitle="Your pure profit" 
          icon={Landmark} 
          variant="success" 
          isLoading={extraLoading} 
        />
        <StatCard 
          title="Pending Payouts" 
          value={formatCurrency(ledgerStats.pending_payout)}
          subtitle="Owed to Canteens" 
          icon={Wallet} 
          variant={ledgerStats.pending_payout > 0 ? "warning" : "default"} 
          isLoading={extraLoading} 
        />
        <StatCard 
          title={dateRange === 'today' ? "Orders Today" : "Total Orders"} 
          value={extraLoading ? "..." : weeklyData.reduce((acc, curr) => acc + curr.orders, 0)}
          subtitle="Successful orders" 
          icon={ShoppingBag} 
          variant="default" 
          isLoading={isLoading} 
        />
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10"><Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" /></div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Users</p>
              <p className="text-base sm:text-lg font-bold">{extraLoading ? <Skeleton className="h-5 w-8" /> : userStats?.total_users || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-purple-500/10"><Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" /></div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Campuses</p>
              <p className="text-base sm:text-lg font-bold">{isLoading ? <Skeleton className="h-5 w-8" /> : campuses.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/10"><ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-400" /></div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Live Mode</p>
              <p className="text-base sm:text-lg font-bold text-green-600">Active</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10"><BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" /></div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">App Status</p>
              <p className="text-base sm:text-lg font-bold">Stable</p>
            </div>
          </div>
        </Card>
      </div>

      {/* 🟢 UPGRADE 3: CFO Charts Row (Double Line Chart) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-sm sm:text-lg">GMV vs Profit ({dateRange})</CardTitle>
            <CardDescription className="text-xs">Compare gross volume to your platform cut</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6 pb-3 sm:pb-6">
            {extraLoading ? (
              <div className="h-40 sm:h-52 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="h-40 sm:h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-[10px] sm:text-xs" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} className="text-[10px] sm:text-xs" tick={{ fontSize: 10 }} width={35} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `₹${v}`} className="text-[10px] sm:text-xs text-green-600" tick={{ fontSize: 10 }} width={25} />
                    <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name === 'gmv' ? 'Total GMV' : 'Profit']} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Line yAxisId="left" name="gmv" type="monotone" dataKey="gmv" stroke="#94a3b8" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" name="profit" type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-sm sm:text-lg">Order Volume ({dateRange})</CardTitle>
            <CardDescription className="text-xs">Daily successful transactions</CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6 pb-3 sm:pb-6">
            {extraLoading ? (
              <div className="h-40 sm:h-52 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="h-40 sm:h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" className="text-[10px] sm:text-xs" tick={{ fontSize: 10 }} />
                    <YAxis className="text-[10px] sm:text-xs" tick={{ fontSize: 10 }} width={25} />
                    <Tooltip />
                    <Bar dataKey="orders" name="Orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CampusHealthMonitor />

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between px-3 sm:px-6 pt-3 sm:pt-6">
            <div>
              <CardTitle className="text-sm sm:text-lg">Recent Orders</CardTitle>
              <CardDescription className="text-xs">Latest across all campuses</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
              <Link to="/super-admin/orders">View All <ArrowRight className="h-3 w-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="px-2 sm:px-6 pb-3 sm:pb-6">
            {extraLoading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No orders yet</p>
            ) : (
              <div className="space-y-0.5">
                {recentOrders.map(order => (
                  <div key={order.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      {getStatusIcon(order.status)}
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium truncate">{order.order_number}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                          {order.customer_name || 'Guest'} · {format(new Date(order.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Badge variant="outline" className={cn("text-[10px] sm:text-xs capitalize px-1.5 py-0.5", getStatusColor(order.status))}>
                        {order.status}
                      </Badge>
                      <span className="text-xs sm:text-sm font-semibold min-w-[50px] text-right">{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Top Selling Items</CardTitle>
              <CardDescription>Most ordered items</CardDescription>
            </CardHeader>
            <CardContent>
              {extraLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : topItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No data</p>
              ) : (
                <div className="space-y-3">
                  {topItems.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                          <div className="bg-primary rounded-full h-1.5"
                            style={{ width: `${(item.count / (topItems[0]?.count || 1)) * 100}%` }} />
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">User Distribution</CardTitle>
              <CardDescription>By role</CardDescription>
            </CardHeader>
            <CardContent>
              {extraLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Students', count: userStats?.students || 0, color: 'bg-blue-500' },
                    { label: 'Admins', count: userStats?.admins || 0, color: 'bg-purple-500' },
                    { label: 'Kiosk Users', count: userStats?.kiosk_users || 0, color: 'bg-amber-500' },
                  ].map(role => (
                    <div key={role.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", role.color)} />
                        <span className="text-sm">{role.label}</span>
                      </div>
                      <span className="text-sm font-semibold">{role.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { to: '/super-admin/orders', label: 'Manage Orders', icon: ShoppingBag },
                { to: '/super-admin/users', label: 'Manage Users', icon: Users },
                { to: '/super-admin/settlements', label: 'Settlements', icon: Wallet },
                { to: '/super-admin/analytics', label: 'Full Analytics', icon: BarChart3 },
              ].map(link => (
                <Link key={link.to} to={link.to}
                  className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted transition-colors text-sm">
                  <link.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1">{link.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}