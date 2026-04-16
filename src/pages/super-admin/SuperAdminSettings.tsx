import { useState } from 'react';
import { 
  Shield, Database, Globe, CheckCircle2, AlertOctagon, 
  Download, Trash2, Percent, Wrench, Save, Loader2,
  Bell, Receipt, Webhook, Mail, Smartphone
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { toast } from 'sonner';

export function SuperAdminSettings() {
  const { campuses } = useSuperAdmin();
  
  // States
  const [isSaving, setIsSaving] = useState(false);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [platformFee, setPlatformFee] = useState("2.5");
  const [taxRate, setTaxRate] = useState("5.0"); // GST
  const [supportEmail, setSupportEmail] = useState("support@grabthebyte.com");

  const activeCampuses = campuses.filter(c => c.is_active).length;

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Global platform configuration saved! 🚀");
    }, 800);
  };

  const handleExportData = () => toast.success("Preparing platform data export... 📩");
  const handleClearCache = () => toast.success("Global Edge Cache cleared! 🧹");

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-muted-foreground">Master configuration for the GrabTheByte ecosystem</p>
        </div>
        <Button onClick={handleSaveConfig} disabled={isSaving} className="gap-2 font-bold shadow-md">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save All Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px] mb-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* 🟢 TAB 1: GENERAL & OPERATIONS */}
        <TabsContent value="general" className="space-y-6">
          <Card className="border-primary/20 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10"><Wrench className="h-5 w-5 text-blue-600" /></div>
                <div>
                  <CardTitle className="text-lg">Platform Operations</CardTitle>
                  <CardDescription>Control core app availability and global details</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="maintenance-mode" className="font-semibold text-base">Maintenance Mode</Label>
                    {isMaintenanceMode && <Badge variant="destructive" className="animate-pulse">Active</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">Lock all student apps. Only Super Admins can access the platform.</p>
                </div>
                <Switch id="maintenance-mode" checked={isMaintenanceMode} onCheckedChange={setIsMaintenanceMode} />
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <Label className="font-semibold">Global Support Email</Label>
                  <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="help@domain.com" />
                  <p className="text-xs text-muted-foreground">This email receives all student dispute tickets.</p>
                </div>
                <div className="space-y-3">
                  <Label className="font-semibold">Data Retention Policy</Label>
                  <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
                    <option value="30">Keep Audit Logs for 30 Days</option>
                    <option value="90">Keep Audit Logs for 90 Days</option>
                    <option value="365">Keep Audit Logs for 1 Year</option>
                  </select>
                  <p className="text-xs text-muted-foreground">Older logs are auto-deleted to save server costs.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 🟢 TAB 2: FINANCIALS */}
        <TabsContent value="financials" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10"><Receipt className="h-5 w-5 text-amber-600" /></div>
                <div>
                  <CardTitle className="text-lg">Fee & Tax Structure</CardTitle>
                  <CardDescription>Configure platform revenue models and taxation</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <Label className="font-semibold">Global Platform Commission (%)</Label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" step="0.1" value={platformFee} onChange={(e) => setPlatformFee(e.target.value)} className="pl-9" />
                  </div>
                  <p className="text-xs text-muted-foreground">The cut GrabTheByte takes from every canteen order.</p>
                </div>
                <div className="space-y-3">
                  <Label className="font-semibold">Platform Tax Rate / GST (%)</Label>
                  <div className="relative">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="number" step="0.1" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="pl-9" />
                  </div>
                  <p className="text-xs text-muted-foreground">Applied to platform convenience fees.</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="font-semibold">Automated Payout Schedule</Label>
                <div className="flex gap-4">
                  {['Daily', 'Weekly (Monday)', 'Monthly'].map((schedule) => (
                    <label key={schedule} className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <input type="radio" name="payout" defaultChecked={schedule === 'Daily'} className="text-primary" />
                      <span className="text-sm font-medium">{schedule}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 🟢 TAB 3: INTEGRATIONS */}
        <TabsContent value="integrations" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10"><Webhook className="h-5 w-5 text-emerald-600" /></div>
                <div>
                  <CardTitle className="text-lg">Third-Party Gateways</CardTitle>
                  <CardDescription>Manage external APIs and automated routing</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              
              {/* Razorpay Lock */}
              <div className="p-4 rounded-lg border-2 border-emerald-500/20 bg-emerald-500/5 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-emerald-800 dark:text-emerald-400">Razorpay Auto-Routing Active</p>
                  <p className="text-xs text-emerald-600/80 dark:text-emerald-500 mt-1">Payments are automatically verified and split directly to sub-accounts.</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center gap-2 text-primary">
                    <Smartphone className="h-5 w-5" />
                    <h3 className="font-semibold">SMS Gateway (OTP)</h3>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">API Key</Label>
                    <Input type="password" placeholder="sk_live_xxxxx..." defaultValue="sk_live_twil_883" />
                  </div>
                </div>

                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center gap-2 text-primary">
                    <Mail className="h-5 w-5" />
                    <h3 className="font-semibold">Email Service (SendGrid)</h3>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">API Key</Label>
                    <Input type="password" placeholder="SG.xxxxx..." defaultValue="SG.real_email_key_44" />
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* 🟢 TAB 4: SECURITY & DANGER ZONE */}
        <TabsContent value="security" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10"><Shield className="h-5 w-5 text-purple-600" /></div>
                  <div>
                    <CardTitle className="text-lg">Database Security</CardTitle>
                    <CardDescription>Infrastructure access policies</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border flex items-center justify-between">
                  <div>
                    <p className="font-medium">Row Level Security (RLS)</p>
                    <p className="text-sm text-muted-foreground">PostgreSQL tenant isolation</p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none shadow-none">Strict</Badge>
                </div>
                <div className="p-4 rounded-lg border flex items-center justify-between">
                  <div>
                    <p className="font-medium">Active Campuses Connected</p>
                    <p className="text-sm text-muted-foreground">Nodes operating on the DB</p>
                  </div>
                  <p className="text-xl font-bold">{activeCampuses}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-200 shadow-sm bg-red-50/10">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-500/10"><AlertOctagon className="h-5 w-5 text-red-600" /></div>
                  <div>
                    <CardTitle className="text-lg text-red-600">Danger Zone</CardTitle>
                    <CardDescription>Irreversible platform actions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border border-red-100 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-foreground">Export Global Ledger</p>
                    <p className="text-xs text-muted-foreground mt-1">Download CSV of all historical orders.</p>
                  </div>
                  <Button variant="outline" onClick={handleExportData} className="shrink-0"><Download className="h-4 w-4 mr-2" /> Export</Button>
                </div>

                <div className="p-4 rounded-lg border border-red-200 bg-red-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-red-700">Clear Global Cache</p>
                    <p className="text-xs text-red-600/80 mt-1">Forces a hard reload for all active devices.</p>
                  </div>
                  <Button variant="destructive" onClick={handleClearCache} className="shrink-0"><Trash2 className="h-4 w-4 mr-2" /> Execute Wipe</Button>
                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}