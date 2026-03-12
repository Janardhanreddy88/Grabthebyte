interface TopItem {
  name: string;
  quantity: number;
  revenue: number;
}

interface TopItemsListProps {
  items: TopItem[];
  emptyMessage?: string;
}

export function TopItemsList({ items, emptyMessage = 'No items sold yet' }: TopItemsListProps) {
  if (!items || items.length === 0) {
    return <p className="text-center py-6 text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div
          key={item.name}
          className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
        >
          <div className="flex items-center gap-3">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                idx === 0
                  ? 'bg-yellow-500 text-yellow-950'
                  : idx === 1
                    ? 'bg-gray-300 text-gray-700'
                    : idx === 2
                      ? 'bg-amber-600 text-amber-50'
                      : 'bg-muted text-muted-foreground'
              }`}
            >
              {idx + 1}
            </span>
            <div>
              <p className="font-medium text-sm">{item.name}</p>
              <p className="text-xs text-muted-foreground">₹{item.revenue.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-primary">{item.quantity}</p>
            <p className="text-xs text-muted-foreground">sold</p>
          </div>
        </div>
      ))}
    </div>
  );
}
