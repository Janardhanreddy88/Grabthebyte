import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Save,
  AlertCircle,
  Activity,
  Shield,
  Database,
  Globe
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function SuperAdminSettings() {
  const { platformSettings, updatePlatformSettings, campuses } = useSuperAdmin();
  const [isSaving, setIsSaving] = useState(false);
  const [localSettings, setLocalSettings] = useState({
    manual_verification_enabled: platformSettings?.manual_verification_enabled ?? true,
  });

  // Sync local state when platform settings load/change
  useEffect(() => {
    if (platformSettings) {
      setLocalSettings({
        manual_verification_enabled: platformSettings.manual_verification_enabled ?? true,
      });
    }
  }, [platformSettings]);

  const handleSave = async () => {
    setIsSaving(true);
    
    const success = await updatePlatformSettings({
      manual_verification_enabled: localSettings.manual_verification_enabled,
    });

    if (success) {
      toast.success('Settings saved successfully');
    } else {
      toast.error('Failed to save settings');
    }

    setIsSaving(false);
  };

  const hasChanges = 
    localSettings.manual_verification_enabled !== platformSettings?.manual_verification_enabled;

  // Calculate platform stats
  const activeCampuses = campuses.filter(c => c.is_active).length;
  const totalCampuses = campuses.length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-muted-foreground">
            Configure global platform settings and control panel
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Payment Verification Mode */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Payment Verification Mode</CardTitle>
                <CardDescription>
                  Control how student payments are processed
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="manual-mode" className="font-medium">
                    Manual Verification Mode
                  </Label>
                  <Badge 
                    variant={localSettings.manual_verification_enabled ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {localSettings.manual_verification_enabled ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  When enabled, all UPI payments require manual approval before orders are confirmed.
                </p>
              </div>
              <Switch
                id="manual-mode"
                checked={localSettings.manual_verification_enabled}
                onCheckedChange={(checked) => 
                  setLocalSettings(prev => ({ ...prev, manual_verification_enabled: checked }))
                }
              />
            </div>

            {/* Status Indicator */}
            <div className={cn(
              "p-4 rounded-lg border-2 flex items-center gap-3",
              localSettings.manual_verification_enabled 
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-green-500/30 bg-green-500/5"
            )}>
              <Activity className={cn(
                "h-5 w-5",
                localSettings.manual_verification_enabled 
                  ? "text-amber-600"
                  : "text-green-600"
              )} />
              <div>
                <p className="font-medium">
                  {localSettings.manual_verification_enabled 
                    ? 'Manual Verification Mode'
                    : 'Automated Gateway Mode'
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {localSettings.manual_verification_enabled 
                    ? 'Payments require admin approval via the War Room'
                    : 'Payments are automatically verified via payment gateway'
                  }
                </p>
              </div>
            </div>

            {localSettings.manual_verification_enabled && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Manual mode requires constant monitoring. Students will wait for payment verification
                  before their orders are confirmed.
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Platform Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Platform Overview</CardTitle>
                <CardDescription>
                  Current platform status and statistics
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">Active Campuses</p>
                <p className="text-2xl font-bold">{activeCampuses}</p>
                <p className="text-xs text-muted-foreground mt-1">of {totalCampuses} total</p>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">Platform Mode</p>
                <Badge 
                  variant="outline"
                  className={cn(
                    "mt-1",
                    localSettings.manual_verification_enabled 
                      ? "border-amber-500 text-amber-600"
                      : "border-green-500 text-green-600"
                  )}
                >
                  {localSettings.manual_verification_enabled ? 'Manual' : 'Automated'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security & Access */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Security & Access</CardTitle>
                <CardDescription>
                  Platform security settings
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Super Admin Access</p>
                  <p className="text-sm text-muted-foreground">PIN-protected access to admin panel</p>
                </div>
                <Badge variant="default">Enabled</Badge>
              </div>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Row Level Security</p>
                  <p className="text-sm text-muted-foreground">Database-level access control</p>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Database className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">System Information</CardTitle>
                <CardDescription>
                  Platform configuration and status
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">Platform</p>
                <p className="font-semibold">GrabTheByte</p>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="font-semibold">2.0.0</p>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">Environment</p>
                <Badge variant="outline">Production</Badge>
              </div>
              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-semibold">
                  {platformSettings?.updated_at 
                    ? new Date(platformSettings.updated_at).toLocaleDateString()
                    : 'N/A'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
