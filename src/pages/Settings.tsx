import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bell, BellOff, Moon, Sun, Monitor,
  Lock, KeyRound, Trash2, ShoppingBag, FileText, Shield,
  ChevronRight, LogOut, Loader2, Info, HelpCircle, RotateCcw,
  Eye, EyeOff, User, Mail, Phone, Building2, Save
} from 'lucide-react';
import OneSignalNative from 'onesignal-cordova-plugin';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
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
  const { user, isLoading: authLoading, logout, changePassword } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Profile state
  const [fullName, setFullName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [campusCode, setCampusCode] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileEditOpen, setProfileEditOpen] = useState(false);

  // Change password state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Forgot password / OTP flow
  const [forgotMode, setForgotMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const getStoredCampusLabel = () => {
      try {
        return localStorage.getItem('campus_code') || localStorage.getItem('campus_name') || '';
      } catch {
        return '';
      }
    };

    if (authLoading) {
      setProfileLoading(true);
      return () => {
        isMounted = false;
      };
    }

    if (!user) {
      if (isMounted) {
        setFullName('');
        setProfileEmail('');
        setProfilePhone('');
        setCampusCode(getStoredCampusLabel());
        setProfileLoading(false);
      }
      return () => {
        isMounted = false;
      };
    }

    const loadProfile = async () => {
      setProfileLoading(true);

      try {
        // Show available values immediately
        setFullName(user.fullName || '');
        setProfileEmail(user.email || '');
        setProfilePhone(user.phone || '');
        setCampusCode(getStoredCampusLabel());

        const [{ data: profile }, { data: roleData }] = await Promise.all([
          supabase.from('profiles').select('full_name, phone, campus_id').eq('user_id', user.id).maybeSingle(),
          supabase.from('user_roles').select('campus_id').eq('user_id', user.id).maybeSingle(),
        ]);

        if (!isMounted) return;

        if (profile?.full_name) setFullName(profile.full_name);
        if (profile?.phone) setProfilePhone(profile.phone);

        const campusId = profile?.campus_id || roleData?.campus_id || user.campusId;
        if (campusId) {
          const { data: cd } = await supabase.from('campus_public_info').select('code, name').eq('id', campusId).maybeSingle();
          if (!isMounted) return;
          if (cd) setCampusCode(cd.code || cd.name || getStoredCampusLabel());
        }
      } catch {
        if (isMounted) {
          setCampusCode((current) => current || getStoredCampusLabel());
        }
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    };

    void loadProfile();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!fullName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    setSavingProfile(true);
    try {
      const { data: existing } = await supabase.from('profiles').select('campus_id').eq('user_id', user.id).maybeSingle();
      if (!existing?.campus_id) { toast({ title: "Campus not set", variant: "destructive" }); return; }
      await supabase.from('profiles').upsert({ user_id: user.id, campus_id: existing.campus_id, full_name: fullName.trim(), phone: profilePhone.trim(), updated_at: new Date().toISOString() } as any, { onConflict: 'user_id' });
      await supabase.auth.updateUser({ data: { full_name: fullName.trim(), phone: profilePhone.trim() } });
      toast({ title: "Profile Saved" });
    } catch (e: any) { toast({ title: "Failed", description: e.message, variant: "destructive" }); }
    finally { setSavingProfile(false); }
  };

  const getInitials = (n: string) => n ? n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'U';

  // Notification preference (single toggle)
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try { return localStorage.getItem('pref_notifications') !== 'false'; } catch { return true; }
  });

  const handleToggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    try { localStorage.setItem('pref_notifications', String(enabled)); } catch {}

    const isNative = Capacitor.isNativePlatform();

    if (isNative) {
      try {
        if (enabled) {
          OneSignalNative.User.pushSubscription.optIn();
        } else {
          OneSignalNative.User.pushSubscription.optOut();
        }
      } catch {}
    } else if (typeof window !== 'undefined' && window.OneSignalDeferred) {
      window.OneSignalDeferred.push(async (OneSignal: any) => {
        try {
          if (enabled) {
            await OneSignal.User.PushSubscription.optIn();
          } else {
            await OneSignal.User.PushSubscription.optOut();
          }
        } catch {}
      });
    }

    toast({ title: enabled ? 'Notifications Enabled' : 'Notifications Disabled', description: enabled ? 'You will receive push notifications.' : 'You will not receive any push notifications.' });
  };

  const handleSendOtp = async () => {
    if (!user?.email) return;
    setSendingOtp(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        setOtpSent(true);
        toast({ title: 'OTP Sent', description: 'Check your email for the 6-digit code.' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to send OTP.', variant: 'destructive' });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6 || !user?.email) return;
    setVerifyingOtp(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: user.email,
        token: otpCode,
        type: 'recovery',
      });
      if (error) {
        toast({ title: 'Invalid OTP', description: error.message, variant: 'destructive' });
      } else {
        setOtpVerified(true);
        toast({ title: 'Verified', description: 'You can now set a new password.' });
      }
    } catch {
      toast({ title: 'Error', description: 'Verification failed.', variant: 'destructive' });
    } finally {
      setVerifyingOtp(false);
    }
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

    // If not in forgot mode, verify current password first
    if (!forgotMode) {
      if (!currentPassword) {
        toast({ title: 'Required', description: 'Enter your current password.', variant: 'destructive' });
        return;
      }
      // Re-authenticate by signing in with current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });
      if (signInError) {
        toast({ title: 'Wrong Password', description: 'Current password is incorrect.', variant: 'destructive' });
        return;
      }
    }

    setChangingPassword(true);
    try {
      const result = await changePassword('', newPassword);
      if (result.success) {
        toast({ title: 'Password Changed', description: 'Your password has been updated.' });
        resetPasswordState();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to change password.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong.', variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  const resetPasswordState = () => {
    setShowPasswordSection(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotMode(false);
    setOtpSent(false);
    setOtpCode('');
    setOtpVerified(false);
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Error', description: 'You must be logged in.', variant: 'destructive' });
        return;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        toast({ title: 'Error', description: result.error || 'Failed to delete account.', variant: 'destructive' });
        return;
      }

      toast({ title: 'Account Deleted', description: 'Your account and data have been permanently removed.' });
      await logout();
      navigate('/auth');
    } catch {
      toast({ title: 'Error', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    } finally {
      setDeletingAccount(false);
      setDeleteConfirmOpen(false);
    }
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

  const showProfileForm = !!user && !authLoading;
  const profileDisplayName = fullName || user?.fullName || 'No name set';
  const profileDisplayEmail = profileEmail || user?.email || '';

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border safe-top">
        <div className="flex items-center gap-2.5 px-3 py-2.5 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-sm font-bold">Settings</h1>
        </div>
      </header>

      <main className="max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto">

        {/* ─── PROFILE ─── */}
        <SectionHeader title="Profile" />
        <div className="px-4 py-3 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-base font-bold shrink-0">
              {showProfileForm ? getInitials(profileDisplayName) : '…'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{showProfileForm ? profileDisplayName : 'Loading…'}</p>
              <p className="text-xs text-muted-foreground truncate">{profileDisplayEmail}</p>
            </div>
            {showProfileForm && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-xs shrink-0"
                onClick={() => setProfileEditOpen(!profileEditOpen)}
              >
                {profileEditOpen ? 'Close' : 'Edit'}
              </Button>
            )}
          </div>

          {showProfileForm && profileEditOpen && (
            <div className="space-y-4 pt-2 animate-in slide-in-from-top-2 duration-200">
              {profileLoading && (
                <p className="text-xs text-muted-foreground">Syncing profile details…</p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="s-name" className="text-xs font-semibold text-muted-foreground">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="s-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="pl-10 text-sm rounded-xl" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Campus</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={campusCode} disabled className="pl-10 text-sm rounded-xl bg-muted/50 text-muted-foreground cursor-not-allowed" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={profileDisplayEmail} disabled className="pl-10 text-sm rounded-xl bg-muted/50 text-muted-foreground cursor-not-allowed" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-phone" className="text-xs font-semibold text-muted-foreground">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="s-phone" type="tel" value={profilePhone} onChange={(e) => setProfilePhone(e.target.value)} placeholder="10-digit number" className="pl-10 text-sm rounded-xl" />
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full rounded-xl text-sm font-semibold gap-2" size="sm">
                {savingProfile ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Profile</>}
              </Button>
            </div>
          )}
        </div>
        <SectionHeader title="Notifications" />
        <div className="px-1">
          <SettingRow
            icon={notificationsEnabled ? Bell : BellOff}
            label="Allow Notifications"
            description="Receive push notifications from this app"
            trailing={
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={handleToggleNotifications}
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
            onClick={() => { setShowPasswordSection(!showPasswordSection); if (showPasswordSection) resetPasswordState(); }}
          />

          {showPasswordSection && (
            <div className="px-4 pb-3 space-y-3">

              {/* Normal flow: Ask current password first */}
              {!forgotMode && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="current-pw" className="text-xs font-semibold text-muted-foreground">Current Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="current-pw"
                        type={showCurrentPassword ? 'text' : 'password'}
                        placeholder="Enter current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pl-10 pr-10 text-sm rounded-xl"
                      />
                      <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForgotMode(true)}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    Forgot current password?
                  </button>
                </>
              )}

              {/* Forgot mode: OTP verification */}
              {forgotMode && !otpVerified && (
                <div className="space-y-3 p-3 rounded-xl bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground">We'll send a 6-digit code to <span className="font-semibold text-foreground">{user?.email}</span></p>
                  {!otpSent ? (
                    <Button onClick={handleSendOtp} disabled={sendingOtp} className="w-full rounded-xl text-sm font-semibold gap-2" size="sm">
                      {sendingOtp ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Mail className="w-4 h-4" /> Send OTP to Email</>}
                    </Button>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label htmlFor="otp-code" className="text-xs font-semibold text-muted-foreground">Enter 6-digit OTP</Label>
                        <Input
                          id="otp-code"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="000000"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="text-sm rounded-xl text-center tracking-[0.5em] font-mono text-lg"
                        />
                      </div>
                      <Button onClick={handleVerifyOtp} disabled={verifyingOtp || otpCode.length < 6} className="w-full rounded-xl text-sm font-semibold gap-2" size="sm">
                        {verifyingOtp ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</> : 'Verify OTP'}
                      </Button>
                      <button type="button" onClick={handleSendOtp} disabled={sendingOtp} className="text-xs text-primary font-medium hover:underline w-full text-center">
                        Resend OTP
                      </button>
                    </>
                  )}
                  <button type="button" onClick={() => { setForgotMode(false); setOtpSent(false); setOtpCode(''); }} className="text-xs text-muted-foreground hover:underline w-full text-center">
                    ← Back to current password
                  </button>
                </div>
              )}

              {forgotMode && otpVerified && (
                <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-400 text-xs text-center font-medium">
                  ✓ Identity verified. Set your new password below.
                </div>
              )}

              {/* New password fields — show if: normal mode OR (forgot mode + OTP verified) */}
              {(!forgotMode || otpVerified) && (
                <>
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
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
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
                </>
              )}
            </div>
          )}

          <SettingRow
            icon={RotateCcw}
            label="Clear Cache"
            description="Free up storage and refresh data"
            onClick={handleClearCache}
          />

          <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <AlertDialogTrigger asChild>
              <div>
                <SettingRow
                  icon={Trash2}
                  label="Delete Account"
                  description="Permanently remove your account and data"
                  onClick={() => setDeleteConfirmOpen(true)}
                  destructive
                />
              </div>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action is <strong>permanent and irreversible</strong>. All your data, orders, and profile will be deleted immediately. You will be logged out.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deletingAccount}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deletingAccount ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Deleting...</> : 'Yes, delete my account'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
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
