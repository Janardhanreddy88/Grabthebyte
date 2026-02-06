import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Calendar,
  RefreshCw,
  Loader2,
  Building2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { toast } from 'sonner';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
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
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DailyStats {
  date: string;
  orders: number;
  revenue: number;
  commission: number;
}

interface CampusPerformance {
  campus_id: string;
  campus_name: string;
  orders: number;
  revenue: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function Analytics() {
  const { filters, campuses, dashboardStats } = useSuperAdmin();
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [campusPerformance, setCampusPerformance] = useState<CampusPerformance[]>([]);
  const [orderStatusBreakdown, setOrderStatusBreakdown] = useState<{ name: string; value: number }[]>([]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const days = parseInt(dateRange);
      const startDate = startOfDay(subDays(new Date(), days));
      
      // Fetch daily order stats
      let ordersQuery = supabase
        .from('orders')
        .select('created_at, total, commission_amount, status')
        .gte('created_at', startDate.toISOString())
        .neq('status', 'failed');

      if (filters.campusId) {
        ordersQuery = ordersQuery.eq('campus_id', filters.campusId);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;

      if (ordersError) throw ordersError;

      // Group by date
      const dailyMap = new Map<string, { orders: number; revenue: number; commission: number }>();
      
      for (let i = 0; i <= days; i++) {
        const date = format(subDays(new Date(), days - i), 'MMM d');
        dailyMap.set(date, { orders: 0, revenue: 0, commission: 0 });
      }

      (ordersData || []).forEach(order => {
        const date = format(new Date(order.created_at), 'MMM d');
        const existing = dailyMap.get(date) || { orders: 0, revenue: 0, commission: 0 };
        dailyMap.set(date, {
          orders: existing.orders + 1,
          revenue: existing.revenue + (order.total || 0),
          commission: existing.commission + (order.commission_amount || order.total * 0.1 || 0)
        });
      });

      setDailyStats(Array.from(dailyMap.entries()).map(([date, stats]) => ({
        date,
        ...stats
      })));

      // Order status breakdown
      const statusCounts = new Map<string, number>();
      (ordersData || []).forEach(order => {
        statusCounts.set(order.status, (statusCounts.get(order.status) || 0) + 1);
      });

      setOrderStatusBreakdown(
        Array.from(statusCounts.entries()).map(([name, value]) => ({ 
          name: name.charAt(0).toUpperCase() + name.slice(1), 
          value 
        }))
      );

      // Campus performance (if no filter)
      if (!filters.campusId) {
        const campusMap = new Map<string, { orders: number; revenue: number }>();
        
        (ordersData || []).forEach(order => {
          // We'd need campus_id in the query - for now use mock
        });

        // Fetch from campuses with order counts
        const performanceData: CampusPerformance[] = [];
        for (const campus of campuses.slice(0, 5)) {
          const { count, error } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('campus_id', campus.id)
            .gte('created_at', startDate.toISOString())
            .neq('status', 'failed');

          if (!error) {
            performanceData.push({
              campus_id: campus.id,
              campus_name: campus.name,
              orders: count || 0,
              revenue: 0 // Would need aggregation
            });
          }
        }

        setCampusPerformance(performanceData.sort((a, b) => b.orders - a.orders));
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [filters.campusId, dateRange]);

  const totalRevenue = dailyStats.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = dailyStats.reduce((sum, d) => sum + d.orders, 0);
  const totalCommission = dailyStats.reduce((sum, d) => sum + d.commission, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            Revenue trends, order analysis, and campus performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchAnalytics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="p-3 rounded-full bg-green-500/10">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-2xl font-bold">{totalOrders}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-500/10">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Platform Earnings</p>
                <p className="text-2xl font-bold">{formatCurrency(totalCommission)}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/10">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Order Value</p>
                <p className="text-2xl font-bold">{formatCurrency(avgOrderValue)}</p>
              </div>
              <div className="p-3 rounded-full bg-orange-500/10">
                <BarChart3 className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Daily revenue over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis 
                      tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`}
                      className="text-xs" 
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelClassName="font-medium"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Orders Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Orders</CardTitle>
                <CardDescription>Number of orders per day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Order Status Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Order Status Breakdown</CardTitle>
                <CardDescription>Distribution of order statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  {orderStatusBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={orderStatusBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {orderStatusBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground">No data available</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 justify-center mt-4">
                  {orderStatusBreakdown.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <span 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm">{entry.name}: {entry.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Campus Performance */}
          {!filters.campusId && campusPerformance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Campus Performance
                </CardTitle>
                <CardDescription>Top performing campuses by order count</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {campusPerformance.map((campus, index) => (
                    <div key={campus.campus_id} className="flex items-center gap-4">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        #{index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{campus.campus_name}</p>
                        <div className="w-full bg-muted rounded-full h-2 mt-1">
                          <div 
                            className="bg-primary rounded-full h-2"
                            style={{ 
                              width: `${(campus.orders / (campusPerformance[0]?.orders || 1)) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                      <Badge variant="secondary">{campus.orders} orders</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
