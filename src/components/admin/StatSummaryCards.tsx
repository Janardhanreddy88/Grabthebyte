import { Card, CardContent } from '@/components/ui/card';
import { type LucideIcon } from 'lucide-react';

interface StatItem {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  valueColor?: string;
}

interface StatSummaryCardsProps {
  stats: StatItem[];
  columns?: 2 | 3 | 4;
}

export function StatSummaryCards({ stats, columns = 4 }: StatSummaryCardsProps) {
  const gridCols = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
  }[columns];

  return (
    <div className={`grid ${gridCols} gap-3`}>
      {stats.map((stat) => (
        <Card key={stat.label} className="rounded-2xl card-shadow">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              {stat.icon && (
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.iconColor || 'bg-muted'}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              )}
              <div className={stat.icon ? '' : 'text-center w-full'}>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.valueColor || ''}`}>
                  {stat.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
