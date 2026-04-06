import { useState, useEffect } from 'react';
import { 
  BarChart3, TrendingUp, DollarSign, ShoppingCart, Calendar,
  RefreshCw, Loader2, Building2, Download
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { toast } from 'sonner';
import { format, subDays, startOfDay } from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

interface DailyStats {
  date: string;
  orders: number;
  revenue: number;
  commission: number;
}

interface CampusRevenue {
  campus_id: string;
  campus_name: string;
  campus_code: string;
  orders: number;
  revenue: number;
  commission: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function Analytics() {
  const { filters, campuses } = useSuperAdmin();
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7');
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [campusRevenue, setCampusRevenue] = useState<CampusRevenue[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<{ name: string; value: number }[]>([]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const days = parseInt(dateRange);
      const startDate = startOfDay(subDays(new Date(), days));

      // Fetch all orders in range
      let query = supabase
        .from('orders')
        .select('created_at, total, commission_amount, status, campus_id')
        .gte('created_at', startDate.toISOString());

      if (filters.campusId) query = query.eq('campus_id', filters.campusId);
      const { data: ordersData, error } = await query;
      if (error) throw error;

      const validOrders = (ordersData || []).filter(o => o.status === 'confirmed' || o.status === 'collected');

      // Group by date
      const dailyMap = new Map<string, { orders: number; revenue: number; commission: number }>();
      for (let i = 0; i <= days; i++) {
        const date = format(subDays(new Date(), days - i), 'MMM d');
        dailyMap.set(date, { orders: 0, revenue: 0, commission: 0 });
      }

      validOrders.forEach(order => {
        const date = format(new Date(order.created_at), 'MMM d');
        const existing = dailyMap.get(date) || { orders: 0, revenue: 0, commission: 0 };
        dailyMap.set(date, {
          orders: existing.orders + 1,
          revenue: existing.revenue + (order.total || 0),
          commission: existing.commission + (order.commission_amount ?? order.total * 0.1 ?? 0)
        });
      });

      setDailyStats(Array.from(dailyMap.entries()).map(([date, stats]) => ({ date, ...stats })));

      // Status breakdown (all orders)
      const allOrders = ordersData || [];
      const statusCounts = new Map<string, number>();
      allOrders.forEach(o => statusCounts.set(o.status, (statusCounts.get(o.status) || 0) + 1));
      setStatusBreakdown(Array.from(statusCounts.entries()).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1), value
      })));

      // Campus-level revenue comparison
      if (!filters.campusId) {
        const campusMap = new Map<string, { orders: number; revenue: number; commission: number }>();
        validOrders.forEach(o => {
          const existing = campusMap.get(o.campus_id) || { orders: 0, revenue: 0, commission: 0 };
          campusMap.set(o.campus_id, {
            orders: existing.orders + 1,
            revenue: existing.revenue + (o.total || 0),
            commission: existing.commission + (o.commission_amount ?? o.total * 0.1 ?? 0),
          });
        });

        const campusRevenueData: CampusRevenue[] = Array.from(campusMap.entries()).map(([cid, stats]) => {
          const campus = campuses.find(c => c.id === cid);
          return { campus_id: cid, campus_name: campus?.name || 'Unknown', campus_code: campus?.code || '?', ...stats };
        }).sort((a, b) => b.revenue - a.revenue);

        setCampusRevenue(campusRevenueData);
      } else {
        setCampusRevenue([]);
      }
    } catch (err) {
      console.error('Analytics error:', err);
      toast.error('Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAnalytics(); }, [filters.campusId, dateRange]);

  const totalRevenue = dailyStats.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = dailyStats.reduce((s, d) => s + d.orders, 0);
  const totalCommission = dailyStats.reduce((s, d) => s + d.commission, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

  const exportCSV = () => {
    const headers = ['Date', 'Orders', 'Revenue', 'Commission'];
    const rows = dailyStats.map(d => [d.date, d.orders, d.revenue, d.commission]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `analytics-${dateRange}days-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Analytics exported');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Revenue trends, order analysis, and campus performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={exportCSV}><Download className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={fetchAnalytics}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Order Value (GMV)', value: formatCurrency(totalRevenue), icon: DollarSign, bg: 'bg-green-500/10', color: 'text-green-600' },
          { label: 'Confirmed Orders', value: totalOrders.toString(), icon: ShoppingCart, bg: 'bg-blue-500/10', color: 'text-blue-600' },
          { label: 'Platform Commission', value: formatCurrency(totalCommission), icon: TrendingUp, bg: 'bg-purple-500/10', color: 'text-purple-600' },
          { label: 'Avg Order Value', value: formatCurrency(avgOrderValue), icon: BarChart3, bg: 'bg-orange-500/10', color: 'text-orange-600' },
        ].map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                </div>
                <div className={`p-3 rounded-full ${kpi.bg}`}><kpi.icon className={`h-6 w-6 ${kpi.color}`} /></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Daily revenue and commission over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} className="text-xs" />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="commission" name="Commission" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Orders Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Orders</CardTitle>
                <CardDescription>Order volume per day</CardDescription>
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

            {/* Status Pie */}
            <Card>
              <CardHeader>
                <CardTitle>Order Status Breakdown</CardTitle>
                <CardDescription>Distribution of order statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center">
                  {statusBreakdown.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-muted-foreground">No data</p>}
                </div>
                <div className="flex flex-wrap gap-4 justify-center mt-4">
                  {statusBreakdown.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm">{entry.name}: {entry.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Campus Revenue Comparison */}
          {!filters.campusId && campusRevenue.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Campus Revenue Comparison</CardTitle>
                <CardDescription>Revenue breakdown per campus for the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 mb-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={campusRevenue} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} className="text-xs" />
                      <YAxis type="category" dataKey="campus_code" className="text-xs" width={80} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="commission" name="Commission" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {campusRevenue.map((campus, index) => (
                    <div key={campus.campus_id} className="flex items-center gap-4 p-3 rounded-lg border">
                      <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{campus.campus_name}</p>
                          <Badge variant="outline" className="text-xs">{campus.campus_code}</Badge>
                        </div>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{campus.orders} orders</span>
                          <span>Revenue: {formatCurrency(campus.revenue)}</span>
                          <span>Commission: {formatCurrency(campus.commission)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(campus.revenue)}</p>
                        <p className="text-xs text-muted-foreground">Net: {formatCurrency(campus.revenue - campus.commission)}</p>
                      </div>
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
