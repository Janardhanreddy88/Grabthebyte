import { useState } from 'react';
import { UtensilsCrossed, ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CategoryData {
  category: string;
  orders: number;
  revenue: number;
  percentage: number;
}

interface CategoryOrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface CategoryOrder {
  id: string;
  orderNumber: string;
  total: number;
  status: string;
  createdAt: string;
  customerName: string;
  items: CategoryOrderItem[];
}

interface CategoryBreakdownProps {
  data: CategoryData[];
  categoryOrders?: Record<string, CategoryOrder[]>;
}

const CATEGORY_COLORS = [
  { color: 'bg-primary', bgColor: 'bg-primary/10' },
  { color: 'bg-secondary', bgColor: 'bg-secondary/10' },
  { color: 'bg-amber-500', bgColor: 'bg-amber-500/10' },
  { color: 'bg-purple-500', bgColor: 'bg-purple-500/10' },
  { color: 'bg-blue-500', bgColor: 'bg-blue-500/10' },
  { color: 'bg-orange-500', bgColor: 'bg-orange-500/10' },
];

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-500/10 text-green-600',
  collected: 'bg-blue-500/10 text-blue-600',
  pending: 'bg-amber-500/10 text-amber-600',
  failed: 'bg-destructive/10 text-destructive',
  expired: 'bg-muted text-muted-foreground',
};

export function CategoryBreakdown({ data, categoryOrders }: CategoryBreakdownProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  if (!data || data.length === 0 || !data.some(c => c.orders > 0)) {
    return <p className="text-center py-6 text-muted-foreground">No orders yet</p>;
  }

  // Show orders for selected category
  if (selectedCategory && categoryOrders) {
    const orders = categoryOrders[selectedCategory] || [];
    return (
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedCategory(null)}
          className="gap-1.5 text-xs font-semibold -ml-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Categories
        </Button>

        <div className="flex items-center gap-2 mb-2">
          <UtensilsCrossed className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">{selectedCategory}</h4>
          <span className="text-xs text-muted-foreground">({orders.length} orders)</span>
        </div>

        {orders.length === 0 ? (
          <p className="text-center py-4 text-muted-foreground text-sm">No orders in this category</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {orders.map((order) => (
              <div
                key={order.id}
                className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-primary">#{order.orderNumber}</span>
                    <span className={cn(
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize',
                      STATUS_STYLES[order.status] || 'bg-muted text-muted-foreground'
                    )}>
                      {order.status}
                    </span>
                  </div>
                  <span className="font-bold text-sm">₹{order.total}</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit', hour12: true
                  })}
                  <span className="mx-1">·</span>
                  <span>{order.customerName}</span>
                </div>

                <div className="space-y-1">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{item.name} × {item.quantity}</span>
                      <span className="text-muted-foreground">₹{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default: show category bars (clickable)
  return (
    <div className="space-y-3">
      {data.map((cat, idx) => {
        const config = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
        const isClickable = !!categoryOrders;
        return (
          <div
            key={cat.category}
            className={cn(
              `p-3 rounded-xl ${config.bgColor} transition-all`,
              isClickable && 'cursor-pointer hover:ring-2 hover:ring-primary/20 active:scale-[0.98]'
            )}
            onClick={() => isClickable && setSelectedCategory(cat.category)}
          >
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
