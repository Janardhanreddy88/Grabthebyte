import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { Lock, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';

const confirmPasswordSchema = z.object({
  password: z.string().min(6, 'Min 6 characters').max(72),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ['confirmPassword'] });

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const hash = window.location.hash;
      setIsValidSession(!!(session || hash.includes('type=recovery') || hash.includes('access_token')));
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((e) => { if (e === 'PASSWORD_RECOVERY') setIsValidSession(true); });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = confirmPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) { const ne: Record<string, string> = {}; result.error.errors.forEach(er => { if (er.path[0]) ne[er.path[0] as string] = er.message; }); setErrors(ne); return; }
    setErrors({}); setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      setIsSuccess(true);
      toast({ title: 'Password Updated!' });
      setTimeout(async () => { await supabase.auth.signOut(); navigate('/auth'); }, 2000);
    } catch { toast({ title: 'Error', variant: 'destructive' }); } finally { setIsLoading(false); }
  };

  if (isValidSession === null) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (!isValidSession) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-[300px] text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3"><AlertCircle className="w-6 h-6 text-destructive" /></div>
        <h1 className="text-base font-bold mb-1">Invalid Reset Link</h1>
        <p className="text-xs text-muted-foreground mb-4">This link is expired.</p>
        <Button size="sm" className="text-xs" onClick={() => navigate('/forgot-password')}>Request New Link</Button>
      </div>
    </div>
  );

  if (isSuccess) return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-[300px] text-center">
        <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3"><CheckCircle2 className="w-6 h-6 text-green-500" /></div>
        <h1 className="text-base font-bold mb-1">Password Reset!</h1>
        <p className="text-xs text-muted-foreground mb-3">Redirecting to login...</p>
        <Loader2 className="w-4 h-4 animate-spin text-primary mx-auto" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="relative w-full max-w-[320px]">
        <div className="text-center mb-4">
          <div className="flex justify-center mb-3"><Logo size="md" showText={false} /></div>
          <h1 className="text-base font-bold">Reset Password</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Enter your new password</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="password" className="text-[11px] font-semibold text-muted-foreground">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                  className={`h-9 pl-9 pr-9 text-sm rounded-xl ${errors.password ? 'border-destructive' : ''}`} required disabled={isLoading} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {errors.password && <p className="text-[10px] text-destructive">{errors.password}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="text-[11px] font-semibold text-muted-foreground">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input id="confirmPassword" type={showConfirm ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); setErrors({}); }}
                  className={`h-9 pl-9 pr-9 text-sm rounded-xl ${errors.confirmPassword ? 'border-destructive' : ''}`} required disabled={isLoading} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showConfirm ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-[10px] text-destructive">{errors.confirmPassword}</p>}
            </div>
            <Button type="submit" className="w-full h-9 font-bold rounded-xl text-xs" disabled={isLoading || !password || !confirmPassword}>
              {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...</> : 'Reset Password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}