import { Sun, Utensils, Cookie } from 'lucide-react';

interface PeriodData {
  period: string;
  orders: number;
  revenue: number;
  percentage: number;
  isActive?: boolean;
}

interface PeriodBreakdownProps {
  data: PeriodData[];
  showActiveIndicator?: boolean;
}

const PERIOD_CONFIG = [
  { color: 'bg-amber-500', bgColor: 'bg-amber-500/10', icon: Sun },
  { color: 'bg-blue-500', bgColor: 'bg-blue-500/10', icon: Utensils },
  { color: 'bg-purple-500', bgColor: 'bg-purple-500/10', icon: Cookie },
  { color: 'bg-orange-500', bgColor: 'bg-orange-500/10', icon: Utensils },
];

export function PeriodBreakdown({ data, showActiveIndicator = false }: PeriodBreakdownProps) {
  if (!data || !data.some(p => p.orders > 0)) {
    return <p className="text-center py-6 text-muted-foreground">No orders yet</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((period, idx) => {
        const config = PERIOD_CONFIG[idx % PERIOD_CONFIG.length];
        const Icon = config.icon;
        return (
          <div
            key={period.period}
            className={`p-3 rounded-xl ${config.bgColor} ${
              showActiveIndicator && period.isActive ? 'ring-2 ring-primary ring-offset-2' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="font-semibold">{period.period}</span>
                {showActiveIndicator && period.isActive && (
                  <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">NOW</span>
                )}
              </div>
              <span className="text-sm font-bold">{period.orders} orders</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-background/50 rounded-full overflow-hidden">
                <div
                  className={`h-full ${config.color} rounded-full transition-all`}
                  style={{ width: `${period.percentage}%` }}
                />
              </div>
              <span className="text-xs font-medium w-10 text-right">{period.percentage}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue: ₹{period.revenue.toLocaleString()}
            </p>
          </div>
        );
      })}
    </div>
  );
}
