import { UtensilsCrossed } from 'lucide-react';

interface CategoryData {
  category: string;
  orders: number;
  revenue: number;
  percentage: number;
}

interface CategoryBreakdownProps {
  data: CategoryData[];
}

const CATEGORY_COLORS = [
  { color: 'bg-primary', bgColor: 'bg-primary/10' },
  { color: 'bg-secondary', bgColor: 'bg-secondary/10' },
  { color: 'bg-amber-500', bgColor: 'bg-amber-500/10' },
  { color: 'bg-purple-500', bgColor: 'bg-purple-500/10' },
  { color: 'bg-blue-500', bgColor: 'bg-blue-500/10' },
  { color: 'bg-orange-500', bgColor: 'bg-orange-500/10' },
];

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  if (!data || data.length === 0 || !data.some(c => c.orders > 0)) {
    return <p className="text-center py-6 text-muted-foreground">No orders yet</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((cat, idx) => {
        const config = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
        return (
          <div key={cat.category} className={`p-3 rounded-xl ${config.bgColor}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="h-4 w-4" />
                <span className="font-semibold">{cat.category}</span>
              </div>
              <span className="text-sm font-bold">{cat.orders} orders</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-background/50 rounded-full overflow-hidden">
                <div
                  className={`h-full ${config.color} rounded-full transition-all`}
                  style={{ width: `${cat.percentage}%` }}
                />
              </div>
              <span className="text-xs font-medium w-10 text-right">{cat.percentage}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Revenue: ₹{cat.revenue.toLocaleString()}
            </p>
          </div>
        );
      })}
    </div>
  );
}
