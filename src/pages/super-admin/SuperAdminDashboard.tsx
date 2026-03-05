import { 
  TrendingUp, 
  TrendingDown, 
  IndianRupee, 
  Wallet, 
  ShoppingBag, 
  Clock,
  AlertCircle,
  ArrowRight,
  Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { cn } from '@/lib/utils';

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

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue,
  variant = 'default',
  isLoading 
}: StatCardProps) {
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
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-12 w-12 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("relative overflow-hidden transition-all hover:shadow-md", variantStyles[variant])}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {(subtitle || trendValue) && (
              <div className="flex items-center gap-2">
                {trendValue && (
                  <span className={cn(
                    "flex items-center text-xs font-medium",
                    trend === 'up' && "text-green-600 dark:text-green-400",
                    trend === 'down' && "text-destructive"
                  )}>
                    {trend === 'up' && <TrendingUp className="h-3 w-3 mr-0.5" />}
                    {trend === 'down' && <TrendingDown className="h-3 w-3 mr-0.5" />}
                    {trendValue}
                  </span>
                )}
                {subtitle && (
                  <span className="text-xs text-muted-foreground">{subtitle}</span>
                )}
              </div>
            )}
          </div>
          <div className={cn("p-3 rounded-xl", iconStyles[variant])}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SuperAdminDashboard() {
  const { dashboardStats, platformSettings, pendingCount, isLoading } = useSuperAdmin();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome to GrabTheByte Command Center
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant="outline" 
            className={cn(
              "gap-1.5 py-1.5 px-3",
              platformSettings?.manual_verification_enabled 
                ? "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                : "border-green-500/50 text-green-600 dark:text-green-400 bg-green-500/10"
            )}
          >
            <Activity className="h-3.5 w-3.5" />
            {platformSettings?.manual_verification_enabled 
              ? "Manual Verification Mode"
              : "Automated Gateway Mode"
            }
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total GMV"
          value={formatCurrency(dashboardStats?.total_gmv || 0)}
          subtitle="Gross Merchandise Value"
          icon={IndianRupee}
          variant="primary"
          isLoading={isLoading}
        />
        <StatCard
          title="Net Revenue"
          value={formatCurrency(dashboardStats?.net_revenue || 0)}
          subtitle="Platform Commission"
          icon={TrendingUp}
          variant="success"
          isLoading={isLoading}
        />
        <StatCard
          title="Pending Payouts"
          value={formatCurrency(dashboardStats?.pending_payouts || 0)}
          subtitle="Due to vendors"
          icon={Wallet}
          variant="warning"
          isLoading={isLoading}
        />
        <StatCard
          title="Active Orders"
          value={dashboardStats?.active_orders || 0}
          subtitle="Currently preparing"
          icon={ShoppingBag}
          variant="default"
          isLoading={isLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Verification Alert */}
        {pendingCount > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-amber-500/10">
                  <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">
                    {pendingCount} Payment{pendingCount !== 1 ? 's' : ''} Awaiting Verification
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Student payments need manual approval. Act now to prevent delays.
                  </p>
                  <Button asChild className="mt-3" size="sm">
                    <Link to="/super-admin/verification">
                      Open War Room
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Today's Summary */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Today's Summary</CardTitle>
            <CardDescription>Quick overview of today's activity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Total Orders Today</span>
              <span className="font-semibold">
                {isLoading ? (
                  <Skeleton className="h-5 w-12" />
                ) : (
                  dashboardStats?.total_orders_today || 0
                )}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-sm text-muted-foreground">Pending Verification</span>
              <Badge variant={pendingCount > 0 ? "destructive" : "secondary"}>
                {pendingCount}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Commission Rate</span>
              <span className="font-semibold">
                {platformSettings?.global_commission_rate || 10}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* No pending verification message */}
        {pendingCount === 0 && (
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-green-500/10">
                  <AlertCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">All Clear!</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    No pending payment verifications. All student payments have been processed.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
