import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';
import { useCampus } from '@/context/CampusContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { Mail, Lock, User, ArrowRight, Loader2, RefreshCw, AlertTriangle, Phone, Timer, Info } from 'lucide-react';
import { sanitizeEmail } from '@/lib/sanitize';
import { motion } from 'framer-motion';

const InputField = ({ id, label, icon: Icon, type = "text", placeholder, value, onChange, error: fieldError, disabled, maxLength }: any) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</Label>
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input id={id} type={type} placeholder={placeholder} value={value} onChange={onChange} maxLength={maxLength}
        className="pl-10 text-sm rounded-xl border border-border focus:border-primary transition-colors" required disabled={disabled} />
    </div>
    {fieldError && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangle size={12} /> {fieldError}</p>}
  </div>
);

const emailSchema = z.string().trim().email('Please enter a valid email address').max(255, 'Email is too long');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters').max(72, 'Password is too long');
const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long');
const phoneSchema = z.string().trim().min(10, 'Phone number must be at least 10 digits').max(15, 'Phone number is too long').regex(/^\+?[0-9]+$/, 'Invalid phone number format');

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { campus } = useCampus();

  // 🛡️ FIX: Use AuthContext instead of raw supabase calls
  // This eliminates the duplicate session check and the competing
  // onAuthStateChange listener that was causing role confusion
  const { login: authLogin, isAuthenticated, user, isInitializing } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');

  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (resendCountdown > 0) {
      timer = setInterval(() => setResendCountdown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

  // Handle logout param
  useEffect(() => {
    const shouldLogout = searchParams.get('logout') === 'true';
    if (!shouldLogout) return;
    let cancelled = false;
    (async () => {
      setIsLoggingOut(true);
      await supabase.auth.signOut();
      if (cancelled) return;
      setIsLoggingOut(false);
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

  // 🛡️ FIX: Single redirect effect using AuthContext user + isInitializing
  // REMOVED: duplicate supabase.auth.getSession() check
  // REMOVED: own onAuthStateChange listener
  // Both were competing with AuthContext and causing role confusion
  useEffect(() => {
    if (isLoggingOut) return;
    if (isInitializing) return; // Wait for real role to be fetched
    if (!isAuthenticated || !user) return; // Not logged in — stay on auth page

    // ✅ Role-based redirect — uses the verified role from AuthContext
    if (user.role === 'super_admin') {
      navigate('/super-admin', { replace: true });
    } else if (user.role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (user.role === 'kiosk') {
      navigate('/kiosk-scanner', { replace: true });
    } else {
      navigate('/menu', { replace: true });
    }
  }, [isInitializing, isAuthenticated, user, isLoggingOut, navigate]);

  const clearErrors = () => setErrors({});

  const validateLoginForm = () => {
    const newErrors: Record<string, string> = {};
    try { emailSchema.parse(loginEmail); } catch (err: any) { newErrors.loginEmail = err.errors[0].message; }
    try { passwordSchema.parse(loginPassword); } catch (err: any) { newErrors.loginPassword = err.errors[0].message; }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignupForm = () => {
    const newErrors: Record<string, string> = {};
    try { nameSchema.parse(signupName); } catch (err: any) { newErrors.signupName = err.errors[0].message; }
    try { phoneSchema.parse(signupPhone); } catch (err: any) { newErrors.signupPhone = err.errors[0].message; }
    try { emailSchema.parse(signupEmail); } catch (err: any) { newErrors.signupEmail = err.errors[0].message; }
    try { passwordSchema.parse(signupPassword); } catch (err: any) { newErrors.signupPassword = err.errors[0].message; }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 🛡️ FIX: Use AuthContext login instead of raw supabase.auth.signInWithPassword
  // AuthContext.login() fetches the real role and saves to cache
  // The redirect is handled by the useEffect above — not here
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (!validateLoginForm()) return;

    if (!campus?.id) {
      toast({ title: 'Campus Required', description: 'Please select a campus first.', variant: 'destructive' });
      navigate('/select-campus', { replace: true });
      return;
    }

    const sanitizedEmail = sanitizeEmail(loginEmail);
    setIsLoading(true);
    try {
      const result = await authLogin(sanitizedEmail, loginPassword);
      if (!result.success) {
        toast({ title: 'Login Failed', description: result.error || 'Invalid email or password.', variant: 'destructive' });
        return;
      }

      // ✅ Campus mismatch check using the role returned from AuthContext
      if (result.role !== 'super_admin' && campus?.id) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('campus_id')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
          .maybeSingle();

        if (roleData?.campus_id && roleData.campus_id !== campus.id) {
          await supabase.auth.signOut();
          toast({
            title: 'Wrong Campus',
            description: 'Your account is registered with a different campus.',
            variant: 'destructive',
          });
          return;
        }
      }

      toast({ title: 'Welcome back!', description: 'Successfully logged in.' });
      // Redirect handled by useEffect above
    } catch {
      toast({ title: 'Login Failed', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (!validateSignupForm()) return;

    if (!campus?.id) {
      toast({ title: 'Campus Required', description: 'Please select a campus first.', variant: 'destructive' });
      navigate('/select-campus', { replace: true });
      return;
    }

    setIsLoading(true);
    try {
      const { data: phoneExists } = await supabase.rpc('check_phone_exists' as any, { phone_input: signupPhone.trim() });
      if (phoneExists) {
        toast({ title: 'Phone Already Registered', description: 'This number is already in use.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: signupEmail.trim(),
        password: signupPassword,
        options: {
          data: { campus_id: campus.id, full_name: signupName.trim(), phone: signupPhone.trim() },
        },
      });

      if (error) {
        let msg = error.message;
        if (msg.includes('already registered') || msg.includes('unique')) msg = 'This email is already registered.';
        toast({ title: 'Signup Failed', description: msg, variant: 'destructive' });
        return;
      }

      setIsVerifyingOtp(true);
      setResendCountdown(60);
      toast({ title: 'Check your email!', description: 'We sent a 6-digit verification code to your inbox.' });
    } catch {
      toast({ title: 'Signup Failed', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVisitorLogin = async () => {
    if (!campus?.id) {
      toast({ title: 'Campus Required', description: 'Please select a campus first.', variant: 'destructive' });
      navigate('/select-campus', { replace: true });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;

      if (data.user) {
        await supabase.from('profiles').upsert({
          user_id: data.user.id,
          full_name: 'Guest Visitor',
          phone: '0000000000',
          campus_id: campus.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        toast({ title: 'Welcome, Guest!', description: 'You can now browse and order.' });
        // Redirect handled by useEffect above after AuthContext updates
      }
    } catch (error: any) {
      toast({ title: 'Guest Login Failed', description: error.message || 'Error occurred.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: signupEmail.trim() });
      if (error) throw error;
      setResendCountdown(60);
      toast({ title: 'Code Resent!', description: 'Check your inbox for a new code.', className: "bg-green-600 text-white border-none" });
    } catch (error: any) {
      toast({ title: 'Resend Failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: signupEmail.trim(),
        token: otpToken.trim(),
        type: 'signup',
      });

      if (error) {
        toast({ title: 'Verification Failed', description: 'Invalid or expired code. Please try again.', variant: 'destructive' });
        return;
      }

      if (data.user) {
        await supabase.from('profiles').upsert({
          user_id: data.user.id,
          full_name: signupName.trim(),
          phone: signupPhone.trim(),
          campus_id: campus?.id!,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        toast({ title: 'Account Verified!', description: 'Welcome to GrabTheByte.' });
        // Redirect handled by useEffect above
      }
    } catch {
      toast({ title: 'Error', description: 'Could not verify OTP.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[300px] h-[300px] rounded-full bg-primary/[0.03] blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[250px] h-[250px] rounded-full bg-secondary/[0.03] blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative w-full max-w-sm">
        <div className="text-center mb-5">
          <div className="flex justify-center mb-3"><Logo size="lg" showText={false} /></div>
          <h1 className="font-display text-xl font-bold text-foreground">{campus?.name || 'Canteen'}</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to order your favorite food</p>
          {campus && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/select-campus', { replace: true })} className="mt-2 px-3 text-xs text-muted-foreground gap-1.5 rounded-lg">
              <RefreshCw size={12} /> Switch Campus
            </Button>
          )}
        </div>

        <div className="bg-card rounded-2xl shadow-soft border border-border p-4">
          <Tabs defaultValue="login" className="w-full" onValueChange={() => { clearErrors(); setIsVerifyingOtp(false); }}>
            <TabsList className="grid w-full grid-cols-2 mb-4 h-10 rounded-xl bg-muted p-1">
              <TabsTrigger value="login" className="rounded-lg text-sm font-bold">Login</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg text-sm font-bold">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-0">
              <form onSubmit={handleLogin} className="space-y-4">
                <InputField id="login-email" label="Email" icon={Mail} type="email" placeholder="you@college.edu" value={loginEmail} onChange={(e: any) => setLoginEmail(e.target.value)} error={errors.loginEmail} disabled={isLoading} />
                <InputField id="login-password" label="Password" icon={Lock} type="password" placeholder="••••••••" value={loginPassword} onChange={(e: any) => setLoginPassword(e.target.value)} error={errors.loginPassword} disabled={isLoading} />
                <Button type="submit" className="w-full font-bold rounded-xl gap-2 text-sm btn-glow" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight size={16} /></>}
                </Button>
                <div className="text-center">
                  <button type="button" onClick={() => navigate('/forgot-password')} className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium">Forgot your password?</button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-0">
              {!isVerifyingOtp ? (
                <form onSubmit={handleSignup} className="space-y-4">
                  <InputField id="signup-name" label="Full Name" icon={User} placeholder="John Doe" value={signupName} onChange={(e: any) => setSignupName(e.target.value)} error={errors.signupName} disabled={isLoading} />
                  <InputField id="signup-phone" label="Phone Number" icon={Phone} type="tel" placeholder="99999 99999" value={signupPhone} onChange={(e: any) => setSignupPhone(e.target.value)} error={errors.signupPhone} disabled={isLoading} />
                  <InputField id="signup-email" label="Email" icon={Mail} type="email" placeholder="you@college.edu" value={signupEmail} onChange={(e: any) => setSignupEmail(e.target.value)} error={errors.signupEmail} disabled={isLoading} />
                  <InputField id="signup-password" label="Password" icon={Lock} type="password" placeholder="••••••••" value={signupPassword} onChange={(e: any) => setSignupPassword(e.target.value)} error={errors.signupPassword} disabled={isLoading} />
                  <Button type="submit" className="w-full font-bold rounded-xl gap-2 text-sm btn-glow" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight size={16} /></>}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4 text-center mt-4 pb-2">
                  <div className="flex justify-center mb-2">
                    <div className="bg-primary/10 p-4 rounded-full">
                      <Mail className="w-7 h-7 text-primary" />
                    </div>
                  </div>
                  <h3 className="font-bold text-base text-foreground">Check your email</h3>
                  <p className="text-sm text-muted-foreground px-2">
                    We sent a 6-digit code to <br /><span className="font-bold text-foreground">{signupEmail}</span>
                  </p>
                  <div className="pt-2 px-4">
                    <InputField id="otp-input" label="" icon={Lock} type="text" maxLength={6} placeholder="Enter 6-digit code"
                      value={otpToken} onChange={(e: any) => setOtpToken(e.target.value.replace(/\D/g, ''))} disabled={isLoading} />
                  </div>
                  <div className="space-y-3 px-4">
                    <Button type="submit" className="w-full font-bold rounded-xl gap-2 text-sm btn-glow mt-2" disabled={isLoading || otpToken.length !== 6}>
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify & Enter <ArrowRight size={16} /></>}
                    </Button>
                    <button type="button" onClick={handleResendOtp} disabled={isLoading || resendCountdown > 0}
                      className={`text-xs w-full flex items-center justify-center gap-1.5 font-bold transition-colors ${resendCountdown > 0 ? 'text-muted-foreground' : 'text-primary hover:text-primary/80'}`}>
                      {resendCountdown > 0 ? <><Timer size={14} /> Resend in {resendCountdown}s</> : <><RefreshCw size={14} /> Resend Code</>}
                    </button>
                  </div>
                  <button type="button" onClick={() => setIsVerifyingOtp(false)} className="text-xs text-muted-foreground hover:text-primary mt-4 font-medium underline block w-full">
                    Change Email
                  </button>
                  <button type="button" onClick={() => setIsVerifyingOtp(false)} className="text-xs text-muted-foreground hover:text-primary mt-2 font-medium">
                    ← Back to Sign Up
                  </button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          {!isVerifyingOtp && (
            <div className="mt-4">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground font-semibold">Or</span>
                </div>
              </div>
              <Button type="button" variant="outline"
                className="w-full font-bold rounded-xl gap-2 text-sm border-dashed hover:bg-primary/5 hover:text-primary transition-colors"
                onClick={handleVisitorLogin} disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <User size={16} />}
                Continue as Visitor
              </Button>
              <div className="mt-3 flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-lg border border-amber-200 dark:border-amber-500/20">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-tight text-amber-800 dark:text-amber-200 font-medium">
                  <strong>Continue as Visitor</strong> button is strictly for people from other colleges
                </p>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          By continuing, you agree to our{' '}
          <button onClick={() => navigate('/terms')} className="underline hover:text-foreground">Terms</button>
          {' & '}
          <button onClick={() => navigate('/privacy')} className="underline hover:text-foreground">Privacy Policy</button>
        </p>
      </motion.div>
    </div>
  );
}