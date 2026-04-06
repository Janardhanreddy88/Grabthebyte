import { useState, useEffect } from 'react';
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
  BarChart3
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
  Bar
} from 'recharts';

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

interface TopItem {
  name: string;
  count: number;
}

interface UserStats {
  total_users: number;
  admins: number;
  students: number;
  kiosk_users: number;
}

interface WeeklyData {
  day: string;
  revenue: number;
  orders: number;
}

export function SuperAdminDashboard() {
  const { dashboardStats, platformSettings, pendingCount, isLoading, filters, campuses, refreshData } = useSuperAdmin();
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [extraLoading, setExtraLoading] = useState(true);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
  };

  useEffect(() => {
    const fetchExtra = async () => {
      setExtraLoading(true);
      try {
        // Recent orders
        let ordersQuery = supabase
          .from('orders')
          .select('id, order_number, total, status, payment_status, customer_name, created_at')
          .order('created_at', { ascending: false })
          .limit(8);
        if (filters.campusId) ordersQuery = ordersQuery.eq('campus_id', filters.campusId);
        const { data: ordersData } = await ordersQuery;
        setRecentOrders((ordersData as RecentOrder[]) || []);

        // Top selling items (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        let itemsQuery = supabase
          .from('order_items')
          .select('name, quantity, order_id');
        const { data: itemsData } = await itemsQuery;
        
        if (itemsData) {
          const itemCounts = new Map<string, number>();
          itemsData.forEach(item => {
            itemCounts.set(item.name, (itemCounts.get(item.name) || 0) + item.quantity);
          });
          const sorted = Array.from(itemCounts.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
          setTopItems(sorted);
        }

        // User stats
        const { data: userStatsData } = await supabase.rpc('get_campus_user_stats', {
          p_campus_id: filters.campusId,
        });
        if (userStatsData) setUserStats(userStatsData as unknown as UserStats);

        // Weekly revenue data (last 7 days)
        const weekData: WeeklyData[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
          
          let dayQuery = supabase
            .from('orders')
            .select('total')
            .gte('created_at', dayStart.toISOString())
            .lte('created_at', dayEnd.toISOString())
            .neq('status', 'failed');
          if (filters.campusId) dayQuery = dayQuery.eq('campus_id', filters.campusId);
          
          const { data: dayData } = await dayQuery;
          const revenue = (dayData || []).reduce((sum, o) => sum + (o.total || 0), 0);
          weekData.push({
            day: format(date, 'EEE'),
            revenue,
            orders: dayData?.length || 0,
          });
        }
        setWeeklyData(weekData);
      } catch (err) {
        console.error('Error fetching dashboard extras:', err);
      } finally {
        setExtraLoading(false);
      }
    };
    fetchExtra();
  }, [filters.campusId]);

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
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">GrabTheByte Command Center</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("gap-1.5 py-1 px-2.5 text-xs",
            platformSettings?.manual_verification_enabled 
              ? "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10"
              : "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10"
          )}>
            <Activity className="h-3 w-3" />
            {platformSettings?.manual_verification_enabled ? "Manual" : "Auto Gateway"}
          </Badge>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => refreshData()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Total GMV" value={formatCurrency(dashboardStats?.total_gmv || 0)}
          subtitle="Gross Value" icon={IndianRupee} variant="primary" isLoading={isLoading} />
        <StatCard title="Net Revenue" value={formatCurrency(dashboardStats?.net_revenue || 0)}
          subtitle="Commission" icon={TrendingUp} variant="success" isLoading={isLoading} />
        <StatCard title="Pending Payouts" value={formatCurrency(dashboardStats?.pending_payouts || 0)}
          subtitle="Due to vendors" icon={Wallet} variant="warning" isLoading={isLoading} />
        <StatCard title="Active Orders" value={dashboardStats?.active_orders || 0}
          subtitle="Preparing" icon={ShoppingBag} variant="default" isLoading={isLoading} />
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
              <p className="text-[10px] sm:text-xs text-muted-foreground">Today</p>
              <p className="text-base sm:text-lg font-bold">{isLoading ? <Skeleton className="h-5 w-8" /> : dashboardStats?.total_orders_today || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 rounded-lg bg-amber-500/10"><BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" /></div>
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Commission</p>
              <p className="text-base sm:text-lg font-bold">{platformSettings?.global_commission_rate || 10}%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-sm sm:text-lg">Revenue (7 Days)</CardTitle>
            <CardDescription className="text-xs">Daily revenue trend</CardDescription>
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
                    <YAxis tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} className="text-[10px] sm:text-xs" tick={{ fontSize: 10 }} width={35} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-sm sm:text-lg">Orders (7 Days)</CardTitle>
            <CardDescription className="text-xs">Daily order volume</CardDescription>
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
                    <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Campus Health Monitor */}
      <CampusHealthMonitor />

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Orders */}
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

        {/* Right Column */}
        <div className="space-y-6">
          {/* Top Selling Items */}
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

          {/* User Distribution */}
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

          {/* Quick Links */}
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
