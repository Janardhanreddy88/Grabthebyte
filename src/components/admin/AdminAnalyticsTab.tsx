import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Clock, TrendingUp, ShoppingBag, IndianRupee, Package, Users,
  Sun, Utensils, Cookie, ChevronDown, Calendar, PieChart, Loader2,
} from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, Legend } from 'recharts';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { PeriodBreakdown } from './PeriodBreakdown';
import { TopItemsList } from './TopItemsList';
import { StatSummaryCards } from './StatSummaryCards';

interface AdminAnalyticsTabProps {
  todayStats: any;
  todayLoading: boolean;
  weeklyStats: any;
  weeklyLoading: boolean;
  monthlyStats: any;
  monthlyLoading: boolean;
  lowStockItems: Array<{ id: string; name: string; quantity: number; category: string }>;
  onRestockClick: (itemId: string) => void;
}

export function AdminAnalyticsTab({
  todayStats, todayLoading,
  weeklyStats, weeklyLoading,
  monthlyStats, monthlyLoading,
  lowStockItems, onRestockClick,
}: AdminAnalyticsTabProps) {
  return (
    <div className="space-y-6">
      {/* Today's Report */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Today's Report</h3>
              <p className="text-sm text-muted-foreground">{todayStats?.dateString}</p>
            </div>
          </div>
          {todayStats?.currentPeriod && (
            <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-medium animate-pulse">
              {todayStats.currentPeriod}
            </span>
          )}
        </div>

        {todayLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="rounded-2xl card-shadow bg-primary/5">
                <CardContent className="p-4">
                  <div className="text-center">
                    <ShoppingBag className="w-6 h-6 mx-auto text-primary mb-1" />
                    <p className="text-3xl font-bold text-primary">{todayStats?.totalOrders || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Orders</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-2xl card-shadow bg-secondary/5">
                <CardContent className="p-4">
                  <div className="text-center">
                    <IndianRupee className="w-6 h-6 mx-auto text-secondary mb-1" />
                    <p className="text-3xl font-bold text-secondary">₹{(todayStats?.totalRevenue || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Today Total Revenue</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <Card className="rounded-2xl card-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Orders by Time Period
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PeriodBreakdown data={todayStats?.periodBreakdown || []} showActiveIndicator />
                </CardContent>
              </Card>

              <Card className="rounded-2xl card-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Top Items Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <TopItemsList items={todayStats?.topItems || []} emptyMessage="No items sold today" />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* Weekly Review */}
      <Collapsible defaultOpen={false} className="space-y-4">
        <CollapsibleTrigger className="w-full group">
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
            <TrendingUp className="h-5 w-5 text-secondary" />
            <h3 className="text-lg font-semibold">Weekly Review</h3>
            {weeklyStats?.weekRange && (
              <span className="text-sm text-muted-foreground">({weeklyStats.weekRange})</span>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4">
          {weeklyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <StatSummaryCards stats={[
                { label: 'Total Orders', value: weeklyStats?.totalOrders || 0, valueColor: 'text-primary' },
                { label: 'Revenue', value: `₹${(weeklyStats?.totalRevenue || 0).toLocaleString()}`, valueColor: 'text-secondary' },
                { label: 'Busiest Day', value: weeklyStats?.busiestDay || '-' },
                { label: 'Peak Hour', value: weeklyStats?.peakHour || '-' },
              ]} />

              <div className="grid lg:grid-cols-2 gap-4">
                <Card className="rounded-2xl card-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Orders by Time Period
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PeriodBreakdown data={weeklyStats?.periodBreakdown || []} />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl card-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Top Selling Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <TopItemsList items={weeklyStats?.topItems || []} emptyMessage="No items sold this week" />
                  </CardContent>
                </Card>
              </div>

              {/* Daily Orders Chart */}
              <Card className="rounded-2xl card-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Daily Orders (Mon-Sun)</CardTitle>
                </CardHeader>
                <CardContent>
                  {weeklyStats?.dailyBreakdown && weeklyStats.dailyBreakdown.some((d: any) => d.orders > 0) ? (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyStats.dailyBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip
                            formatter={(value: number, name: string) => [
                              name === 'revenue' ? `₹${value.toLocaleString()}` : value,
                              name === 'revenue' ? 'Revenue' : 'Orders'
                            ]}
                            contentStyle={{
                              background: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "12px",
                            }}
                          />
                          <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-center py-6 text-muted-foreground">No daily data available</p>
                  )}
                </CardContent>
              </Card>

              {/* Additional Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-2xl card-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                        <Package className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Completion Rate</p>
                        <p className="text-2xl font-bold text-green-600">{weeklyStats?.completionRate || 0}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl card-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                        <Users className="w-5 h-5 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Avg Order Value</p>
                        <p className="text-2xl font-bold">₹{weeklyStats?.avgOrderValue || 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Monthly Analytics */}
      <Collapsible defaultOpen={false} className="space-y-4">
        <CollapsibleTrigger className="w-full group">
          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
            <Calendar className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">
              {monthlyStats?.monthName} {monthlyStats?.year} Analytics
            </h3>
            <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4">
          {monthlyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <StatSummaryCards
                columns={3}
                stats={[
                  { label: 'Total Orders', value: monthlyStats?.totalOrders || 0, valueColor: 'text-primary' },
                  { label: 'Total Revenue', value: `₹${(monthlyStats?.totalRevenue || 0).toLocaleString()}`, valueColor: 'text-secondary' },
                  { label: 'Avg Order', value: `₹${monthlyStats?.avgOrderValue || 0}` },
                ]}
              />

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Pie Chart */}
                <Card className="rounded-2xl card-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PieChart className="h-5 w-5" /> Revenue by Time Period
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {monthlyStats?.periodBreakdown && monthlyStats.periodBreakdown.some((p: any) => p.orders > 0) ? (
                      <>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPie>
                              <Pie
                                data={monthlyStats.periodBreakdown.filter((p: any) => p.revenue > 0)}
                                dataKey="revenue"
                                nameKey="period"
                                cx="50%" cy="50%"
                                innerRadius={40} outerRadius={80}
                                paddingAngle={2}
                              >
                                {monthlyStats.periodBreakdown.filter((p: any) => p.revenue > 0).map((_: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={[
                                    'hsl(45, 93%, 47%)', 'hsl(217, 91%, 60%)',
                                    'hsl(270, 50%, 60%)', 'hsl(24, 95%, 53%)',
                                  ][index % 4]} />
                                ))}
                              </Pie>
                              <Legend />
                              <Tooltip
                                formatter={(value: number) => `₹${value.toLocaleString()}`}
                                contentStyle={{
                                  background: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "12px",
                                }}
                              />
                            </RechartsPie>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 mt-4">
                          {monthlyStats.periodBreakdown.map((period: any, idx: number) => {
                            const colors = ['bg-amber-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500'];
                            const icons = [Sun, Utensils, Cookie, Utensils];
                            const Icon = icons[idx];
                            return (
                              <div key={period.period} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${colors[idx]}`} />
                                  <Icon className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium text-sm">{period.period}</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold">₹{period.revenue.toLocaleString()}</p>
                                  <p className="text-xs text-muted-foreground">{period.orders} orders</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">No order data this month</p>
                    )}
                  </CardContent>
                </Card>

                {/* Daily Trends */}
                <Card className="rounded-2xl card-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">Daily Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {monthlyStats?.dailyTrends && monthlyStats.dailyTrends.some((d: any) => d.orders > 0) ? (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={monthlyStats.dailyTrends}>
                            <defs>
                              <linearGradient id="colorMonthlyRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} interval="preserveStartEnd" />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                            <Tooltip
                              formatter={(value: number, name: string) => [
                                name === 'revenue' ? `₹${value.toLocaleString()}` : value,
                                name === 'revenue' ? 'Revenue' : 'Orders'
                              ]}
                              labelFormatter={(label) => `Day ${label}`}
                              contentStyle={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "12px",
                              }}
                            />
                            <Area type="monotone" dataKey="revenue" stroke="hsl(var(--secondary))" strokeWidth={2} fill="url(#colorMonthlyRevenue)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-center py-8 text-muted-foreground">No trend data available</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <Card className="rounded-2xl card-shadow border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-destructive" /> Low Stock Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-background cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => onRestockClick(item.id)}>
                  <span className="font-medium text-sm">{item.name}</span>
                  <span className="text-xs text-destructive font-semibold">Only {item.quantity} left</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
