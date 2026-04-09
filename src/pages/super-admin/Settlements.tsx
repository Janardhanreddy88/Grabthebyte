import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function Settlements() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settlements</h1>
        <p className="text-muted-foreground">Campus payout management</p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-24 text-center">
          <div className="p-4 rounded-full bg-amber-500/10 mb-4">
            <Construction className="h-10 w-10 text-amber-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Rebuilding Settlement Engine</h2>
          <p className="text-muted-foreground max-w-md">
            The financial reconciliation and commission system is being rebuilt from scratch for 100% accuracy. This section will return with a new architecture.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
