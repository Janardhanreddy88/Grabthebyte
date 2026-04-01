import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bell, BellOff, Palette, Moon, Sun, Monitor,
  Lock, KeyRound, Trash2, ShoppingBag, FileText, Shield,
  ChevronRight, LogOut, Loader2, Info, HelpCircle, RotateCcw,
  Eye, EyeOff
} from 'lucide-react';
import OneSignalNative from 'onesignal-cordova-plugin';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type ThemeOption = 'light' | 'dark' | 'system';

interface SettingRowProps {
  icon: React.ElementType;
  label: string;
  description?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
}

function SettingRow({ icon: Icon, label, description, onClick, trailing, destructive }: SettingRowProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick && !trailing}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors rounded-xl hover:bg-muted/60 active:bg-muted ${destructive ? 'text-destructive' : ''}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${destructive ? 'bg-destructive/10' : 'bg-muted'}`}>
        <Icon className="w-4.5 h-4.5" size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>}
      </div>
      {trailing || (onClick && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />)}
    </button>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-4 pt-5 pb-1.5">{title}</h2>;
}

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout, changePassword } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Change password state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Notification preferences (local state)
  const [orderUpdates, setOrderUpdates] = useState(() => {
    try { return localStorage.getItem('pref_order_updates') !== 'false'; } catch { return true; }
  });
  const [promotions, setPromotions] = useState(() => {
    try { return localStorage.getItem('pref_promotions') !== 'false'; } catch { return true; }
  });

  const handleToggleNotif = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    try { localStorage.setItem(key, String(value)); } catch {}

    // Sync preference to OneSignal as a tag
    const tagKey = key === 'pref_order_updates' ? 'order_updates' : 'promotions';
    const tagValue = value ? 'true' : 'false';
    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      try {
        OneSignalNative.User.addTags({ [tagKey]: tagValue });
      } catch {}
    } else if (typeof window !== 'undefined' && window.OneSignalDeferred) {
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          await OneSignal.User.addTags({ [tagKey]: tagValue });
        } catch {}
      });
    }

    toast({ title: value ? 'Enabled' : 'Disabled', description: 'Notification preference updated.' });
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: 'Too Short', description: 'Password must be at least 6 characters.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Mismatch', description: 'Passwords do not match.', variant: 'destructive' });
      return;
    }
    setChangingPassword(true);
    try {
      const result = await changePassword('', newPassword);
      if (result.success) {
        toast({ title: 'Password Changed', description: 'Your password has been updated.' });
        setShowPasswordSection(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to change password.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong.', variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    toast({ title: 'Contact Support', description: 'To delete your account, please email support@grabthebyte.com' });
  };

  const handleClearCache = () => {
    try {
      const keysToKeep = ['theme', 'campus_id', 'campus_code', 'campus_name'];
      const preserved: Record<string, string | null> = {};
      keysToKeep.forEach(k => { preserved[k] = localStorage.getItem(k); });
      localStorage.clear();
      Object.entries(preserved).forEach(([k, v]) => { if (v) localStorage.setItem(k, v); });
      toast({ title: 'Cache Cleared', description: 'App cache has been cleared.' });
    } catch {
      toast({ title: 'Error', description: 'Could not clear cache.', variant: 'destructive' });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const themeOptions: { value: ThemeOption; icon: React.ElementType; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border safe-top">
        <div className="flex items-center gap-2.5 px-3 py-2.5 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm font-bold">Settings</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto">

        {/* ─── NOTIFICATIONS ─── */}
        <SectionHeader title="Notifications" />
        <div className="px-1">
          <SettingRow
            icon={Bell}
            label="Order Updates"
            description="Get notified about order status changes"
            trailing={
              <Switch
                checked={orderUpdates}
                onCheckedChange={(v) => handleToggleNotif('pref_order_updates', v, setOrderUpdates)}
              />
            }
          />
          <SettingRow
            icon={BellOff}
            label="Promotions & Offers"
            description="Receive deals and discount alerts"
            trailing={
              <Switch
                checked={promotions}
                onCheckedChange={(v) => handleToggleNotif('pref_promotions', v, setPromotions)}
              />
            }
          />
        </div>

        {/* ─── APPEARANCE ─── */}
        <SectionHeader title="Appearance" />
        <div className="px-4 py-2">
          <p className="text-xs text-muted-foreground mb-3">Choose your preferred theme</p>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map(({ value, icon: ThIcon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                  theme === value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:border-muted-foreground/30'
                }`}
              >
                <ThIcon className="w-5 h-5" />
                <span className="text-xs font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── ACCOUNT & SECURITY ─── */}
        <SectionHeader title="Account & Security" />
        <div className="px-1">
          <SettingRow
            icon={KeyRound}
            label="Change Password"
            description="Update your account password"
            onClick={() => setShowPasswordSection(!showPasswordSection)}
          />

          {showPasswordSection && (
            <div className="px-4 pb-3 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-pw" className="text-xs font-semibold text-muted-foreground">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="new-pw"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10 text-sm rounded-xl"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw" className="text-xs font-semibold text-muted-foreground">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm-pw"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 text-sm rounded-xl"
                  />
                </div>
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className="w-full rounded-xl text-sm font-semibold gap-2"
                size="sm"
              >
                {changingPassword ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : 'Update Password'}
              </Button>
            </div>
          )}

          <SettingRow
            icon={RotateCcw}
            label="Clear Cache"
            description="Free up storage and refresh data"
            onClick={handleClearCache}
          />

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <div>
                <SettingRow
                  icon={Trash2}
                  label="Delete Account"
                  description="Permanently remove your account and data"
                  onClick={handleDeleteAccount}
                  destructive
                />
              </div>
            </AlertDialogTrigger>
          </AlertDialog>
        </div>

        {/* ─── ORDER PREFERENCES ─── */}
        <SectionHeader title="Order Preferences" />
        <div className="px-1">
          <SettingRow
            icon={ShoppingBag}
            label="Order History"
            description="View all your past orders"
            onClick={() => navigate('/my-orders')}
          />
        </div>

        {/* ─── ABOUT & LEGAL ─── */}
        <SectionHeader title="About & Legal" />
        <div className="px-1">
          <SettingRow icon={FileText} label="Terms & Conditions" onClick={() => navigate('/terms')} />
          <SettingRow icon={Shield} label="Privacy Policy" onClick={() => navigate('/privacy')} />
          <SettingRow icon={FileText} label="Refund Policy" onClick={() => navigate('/refund-policy')} />
          <SettingRow icon={HelpCircle} label="Help & Support" onClick={() => navigate('/support')} />
          <SettingRow
            icon={Info}
            label="App Version"
            description="GrabTheByte v1.0.0"
            trailing={<span className="text-xs text-muted-foreground">v1.0.0</span>}
          />
        </div>

        {/* ─── LOGOUT ─── */}
        <div className="px-1 pt-4 pb-6">
          <SettingRow
            icon={LogOut}
            label="Logout"
            description={user?.email || ''}
            onClick={handleLogout}
            destructive
          />
        </div>

      </main>
    </div>
  );
}
