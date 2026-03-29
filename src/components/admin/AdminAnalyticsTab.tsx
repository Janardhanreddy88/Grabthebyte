import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Clock, TrendingUp, TrendingDown, Minus, ShoppingBag, IndianRupee, Package, Users,
  ChevronDown, ChevronLeft, ChevronRight, Calendar, PieChart, Loader2, UtensilsCrossed, Hash,
} from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, Legend } from 'recharts';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { CategoryBreakdown } from './CategoryBreakdown';
import { TopItemsList } from './TopItemsList';
import { StatSummaryCards } from './StatSummaryCards';
import { cn } from '@/lib/utils';

const PIE_COLORS = [
  'hsl(var(--primary))', 'hsl(var(--secondary))',
  'hsl(45, 93%, 47%)', 'hsl(270, 50%, 60%)',
  'hsl(217, 91%, 60%)', 'hsl(24, 95%, 53%)',
];

interface AdminAnalyticsTabProps {
  todayStats: any;
  todayLoading: boolean;
  todaySelectedDate: Date;
  todaySetSelectedDate: (d: Date) => void;
  weeklyStats: any;
  weeklyLoading: boolean;
  monthlyStats: any;
  monthlyLoading: boolean;
  monthlySelectedMonth: Date;
  monthlySetSelectedMonth: (d: Date) => void;
  monthlyMonthOptions: Array<{ value: string; label: string }>;
  lowStockItems: Array<{ id: string; name: string; quantity: number; category: string }>;
  onRestockClick: (itemId: string) => void;
}

export function AdminAnalyticsTab({
  todayStats, todayLoading,
  weeklyStats, weeklyLoading,
  monthlyStats, monthlyLoading,
  monthlySelectedMonth, monthlySetSelectedMonth, monthlyMonthOptions,
  lowStockItems, onRestockClick,
}: AdminAnalyticsTabProps) {
  return (
    <div className="space-y-6">
      {/* Today's Report */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Today's Report</h3>
            <p className="text-sm text-muted-foreground">{todayStats?.dateString}</p>
          </div>
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
                    <UtensilsCrossed className="h-4 w-4" /> Orders by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CategoryBreakdown data={todayStats?.categoryBreakdown || []} />
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
            <h3 className="text-lg font-semibold">Weekly Report</h3>
            {weeklyStats?.weekRange && (
              <span className="text-sm text-muted-foreground">({weeklyStats.weekRange})</span>
            )}
            {/* Weekly growth badge */}
            {weeklyStats && weeklyStats.weeklyGrowth !== 0 && (
              <span className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5",
                weeklyStats.weeklyGrowth > 0 ? "bg-green-500/10 text-green-600" :
                "bg-red-500/10 text-red-600"
              )}>
                {weeklyStats.weeklyGrowth > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {weeklyStats.weeklyGrowth > 0 ? '+' : ''}{weeklyStats.weeklyGrowth}%
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4">
          {weeklyLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <>
              {/* Big summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-2xl card-shadow bg-primary/5">
                  <CardContent className="p-4 text-center">
                    <Hash className="w-5 h-5 mx-auto text-primary mb-1" />
                    <p className="text-3xl font-bold text-primary">{weeklyStats?.totalItemsSold?.toLocaleString() || 0}</p>
                    <p className="text-xs text-muted-foreground">Items Sold</p>
                    <p className="text-[10px] text-muted-foreground">in {weeklyStats?.daysElapsed || 0} days</p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl card-shadow bg-secondary/5">
                  <CardContent className="p-4 text-center">
                    <IndianRupee className="w-5 h-5 mx-auto text-secondary mb-1" />
                    <p className="text-3xl font-bold text-secondary">₹{(weeklyStats?.totalRevenue || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Revenue</p>
                    <p className="text-[10px] text-muted-foreground">This Week</p>
                  </CardContent>
                </Card>
              </div>

              <StatSummaryCards stats={[
                { label: 'Total Orders', value: weeklyStats?.totalOrders || 0, valueColor: 'text-primary' },
                { label: 'Avg/Day', value: `₹${(weeklyStats?.avgRevenuePerDay || 0).toLocaleString()}` },
                { label: 'Busiest Day', value: weeklyStats?.busiestDay || '-' },
                { label: 'Peak Hour', value: weeklyStats?.peakHour || '-' },
              ]} />

              {/* Day-by-Day Table */}
              <Card className="rounded-2xl card-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Day-by-Day Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-0 sm:p-6 sm:pt-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Day</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs text-right">Orders</TableHead>
                          <TableHead className="text-xs text-right">Sales</TableHead>
                          <TableHead className="text-xs text-right">vs Last Wk</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(weeklyStats?.dailyBreakdown || []).map((day: any) => (
                          <TableRow key={day.day} className={cn(
                            day.isToday && "bg-primary/5 font-semibold",
                            day.isFuture && "opacity-40"
                          )}>
                            <TableCell className="text-xs font-medium">
                              {day.day} {day.isToday && <span className="text-primary">•</span>}
                            </TableCell>
                            <TableCell className="text-xs">{day.date}</TableCell>
                            <TableCell className="text-xs text-right">{day.orders}</TableCell>
                            <TableCell className="text-xs text-right">₹{day.revenue.toLocaleString()}</TableCell>
                            <TableCell className="text-xs text-right">
                              {!day.isFuture && day.lastWeekRevenue > 0 && (
                                <span className={cn(
                                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                                  day.diffPercent > 0 ? "bg-green-500/10 text-green-600" :
                                  day.diffPercent < 0 ? "bg-red-500/10 text-red-600" :
                                  "bg-muted text-muted-foreground"
                                )}>
                                  {day.diffPercent > 0 ? '+' : ''}{day.diffPercent}%
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="grid lg:grid-cols-2 gap-4">
                <Card className="rounded-2xl card-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UtensilsCrossed className="h-4 w-4" /> Orders by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CategoryBreakdown data={weeklyStats?.categoryBreakdown || []} />
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

              {/* Bar chart */}
              <Card className="rounded-2xl card-shadow">
                <CardHeader className="pb-2"><CardTitle className="text-base">Daily Orders (Mon-Sun)</CardTitle></CardHeader>
                <CardContent>
                  {weeklyStats?.dailyBreakdown?.some((d: any) => d.orders > 0) ? (
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyStats.dailyBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip
                            formatter={(value: number, name: string) => [name === 'revenue' ? `₹${value.toLocaleString()}` : value, name === 'revenue' ? 'Revenue' : 'Orders']}
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
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
            <h3 className="text-lg font-semibold">Monthly Report</h3>
            <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4">
          {/* Month selector */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{monthlyStats?.monthName} {monthlyStats?.year}</p>
            <Select
              value={monthlySelectedMonth.toISOString()}
              onValueChange={(val) => monthlySetSelectedMonth(new Date(val))}
            >
              <SelectTrigger className="w-[180px] h-9 rounded-xl text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthlyMonthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {monthlyLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <>
              {/* Month summary */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-2xl card-shadow bg-primary/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{monthlyStats?.totalOrders || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Orders</p>
                    <p className="text-[10px] text-muted-foreground">{monthlyStats?.daysCount || 0} days</p>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl card-shadow bg-secondary/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-secondary">₹{(monthlyStats?.totalRevenue || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Revenue</p>
                    <p className="text-[10px] text-muted-foreground">{monthlyStats?.monthName}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Pie chart */}
                <Card className="rounded-2xl card-shadow">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <PieChart className="h-4 w-4" /> Revenue by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {monthlyStats?.categoryBreakdown?.some((p: any) => p.orders > 0) ? (
                      <>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsPie>
                              <Pie
                                data={monthlyStats.categoryBreakdown.filter((p: any) => p.revenue > 0)}
                                dataKey="revenue" nameKey="category"
                                cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2}
                              >
                                {monthlyStats.categoryBreakdown.filter((p: any) => p.revenue > 0).map((_: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Legend />
                              <Tooltip
                                formatter={(value: number) => `₹${value.toLocaleString()}`}
                                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
                              />
                            </RechartsPie>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-2 mt-4">
                          {monthlyStats.categoryBreakdown.map((cat: any, idx: number) => {
                            const colors = ['bg-primary', 'bg-secondary', 'bg-amber-500', 'bg-purple-500', 'bg-blue-500', 'bg-orange-500'];
                            return (
                              <div key={cat.category} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]}`} />
                                  <span className="font-medium text-sm">{cat.category}</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold">₹{cat.revenue.toLocaleString()}</p>
                                  <p className="text-xs text-muted-foreground">{cat.orders} orders</p>
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

                {/* Daily trends */}
                <Card className="rounded-2xl card-shadow">
                  <CardHeader><CardTitle className="text-base">Daily Trends</CardTitle></CardHeader>
                  <CardContent>
                    {monthlyStats?.dailyTrends?.some((d: any) => d.orders > 0) ? (
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
                              formatter={(value: number, name: string) => [name === 'revenue' ? `₹${value.toLocaleString()}` : value, name === 'revenue' ? 'Revenue' : 'Orders']}
                              labelFormatter={(label) => `Day ${label}`}
                              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }}
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

              {/* Item-wise Monthly Breakdown */}
              <Card className="rounded-2xl card-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" /> Item-wise Sales
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(monthlyStats?.topItems || []).length > 0 ? (
                    <div className="space-y-2">
                      {monthlyStats.topItems.map((item: any, index: number) => (
                        <div key={item.name} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                              index === 0 ? "bg-yellow-500 text-yellow-950" :
                              index === 1 ? "bg-gray-300 text-gray-700" :
                              index === 2 ? "bg-amber-600 text-amber-50" :
                              "bg-muted text-muted-foreground"
                            )}>
                              {index + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                {index < 3 && <span className="text-sm">🏆</span>}
                                <p className="font-medium text-sm">{item.name}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                {item.category}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary">×{item.quantity}</p>
                            <p className="text-xs text-muted-foreground">₹{item.revenue.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-6 text-muted-foreground">No sales data for this month</p>
                  )}
                </CardContent>
              </Card>
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
