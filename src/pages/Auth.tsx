import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';
import { useCampus } from '@/context/CampusContext';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { Mail, Lock, User, ArrowRight, Loader2, RefreshCw, AlertTriangle, Phone, Timer } from 'lucide-react';
import { checkLoginRateLimit, recordLoginAttempt } from '@/lib/rateLimit';
import { sanitizeEmail } from '@/lib/sanitize';
import { motion } from 'framer-motion';

const InputField = ({ id, label, icon: Icon, type = "text", placeholder, value, onChange, error: fieldError, disabled, maxLength }: any) => (
  <div className="space-y-1">
    <Label htmlFor={id} className="text-[11px] font-semibold text-muted-foreground">{label}</Label>
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
      <Input id={id} type={type} placeholder={placeholder} value={value} onChange={onChange} maxLength={maxLength}
        className="h-9 pl-9 text-sm rounded-xl border border-border focus:border-primary transition-colors" required disabled={disabled} />
    </div>
    {fieldError && <p className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle size={10} /> {fieldError}</p>}
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
  const [resendCountdown, setResendCountdown] = useState(0); // For the 60s timer
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);

  // Timer Effect for Resend Logic
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCountdown > 0) {
      timer = setInterval(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCountdown]);

  useEffect(() => {
    const shouldLogout = searchParams.get('logout') === 'true';
    if (!shouldLogout) return;
    let cancelled = false;
    (async () => {
      setIsLoggingOut(true);
      await supabase.auth.signOut();
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      setIsLoggingOut(false);
      if (!session) navigate('/auth', { replace: true });
    })();
    return () => { cancelled = true; };
  }, [searchParams, navigate]);

  useEffect(() => {
    if (isLoggingOut) return;
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: roles } = await supabase.from('user_roles').select('role, campus_id').eq('user_id', session.user.id).maybeSingle();
        if (roles?.role !== 'super_admin' && campus?.id) {
          if (roles?.campus_id && roles.campus_id !== campus.id) {
            await supabase.auth.signOut();
            toast({ title: 'Wrong Campus', description: 'Your account is registered with a different campus.', variant: 'destructive' });
            return;
          }
        }
        if (roles?.role === 'admin') navigate('/admin');
        else if (roles?.role === 'kiosk') navigate('/kiosk-scanner');
        else navigate('/menu');
      }
    };
    checkSession();
  }, [navigate, isLoggingOut, campus, toast]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(async () => {
          const [rolesResult, profileResult] = await Promise.all([
            supabase.from('user_roles').select('role, campus_id').eq('user_id', session.user.id).maybeSingle(),
            supabase.from('profiles').select('campus_id').eq('user_id', session.user.id).maybeSingle(),
          ]);
          const userRole = rolesResult.data?.role;
          const userCampusId = rolesResult.data?.campus_id || profileResult.data?.campus_id;
          if (userRole !== 'super_admin' && campus?.id) {
            if (userCampusId && userCampusId !== campus.id) {
              await supabase.auth.signOut();
              toast({ title: 'Wrong Campus', description: 'Your account is registered with a different campus.', variant: 'destructive' });
              return;
            }
          }
          if (userRole === 'admin' || userRole === 'kiosk') navigate(userRole === 'admin' ? '/admin' : '/kiosk-scanner');
          else navigate('/menu');
        }, 0);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, campus, toast]);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); clearErrors(); setRateLimitMessage(null);
    if (!validateLoginForm()) return;
    if (!campus?.id) { toast({ title: 'Campus Required', description: 'Please select a campus first.', variant: 'destructive' }); navigate('/select-campus'); return; }
    const sanitizedEmail = sanitizeEmail(loginEmail);
    const rateLimit = checkLoginRateLimit(sanitizedEmail);
    if (!rateLimit.allowed) { setRateLimitMessage(rateLimit.message || 'Too many login attempts.'); return; }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: sanitizedEmail, password: loginPassword });
      if (error) { recordLoginAttempt(sanitizedEmail, false); toast({ title: 'Login Failed', description: 'Invalid email or password.', variant: 'destructive' }); return; }
      recordLoginAttempt(sanitizedEmail, true);
      if (data.user) toast({ title: 'Welcome back!', description: 'Successfully logged in.' });
    } catch { toast({ title: 'Login Failed', description: 'Error occurred.', variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); clearErrors();
    if (!validateSignupForm()) return;
    if (!campus?.id) { toast({ title: 'Campus Required', description: 'Please select a campus first.', variant: 'destructive' }); navigate('/select-campus'); return; }
    setIsLoading(true);
    
    try {
      const { data: phoneExists } = await supabase.rpc('check_phone_exists' as any, { phone_input: signupPhone.trim() });
      if (phoneExists) { toast({ title: 'Phone Already Registered', description: 'This number is already in use.', variant: 'destructive' }); setIsLoading(false); return; }
      
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail.trim(), 
        password: signupPassword,
        options: { 
          data: { campus_id: campus.id, full_name: signupName.trim(), phone: signupPhone.trim() } 
        },
      });
      
      if (error) { 
        let msg = error.message; 
        if (msg.includes('already registered') || msg.includes('unique')) msg = 'This email is already registered.'; 
        toast({ title: 'Signup Failed', description: msg, variant: 'destructive' }); 
        return; 
      }
      
      setIsVerifyingOtp(true);
      setResendCountdown(60); // Initial 60s cooldown
      toast({ title: 'Check your email!', description: 'We sent a 6-digit verification code to your inbox.' });
      
    } catch { toast({ title: 'Signup Failed', description: 'An unexpected error occurred.', variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: signupEmail.trim(),
      });
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
        type: 'signup'
      });

      if (error) {
        toast({ title: 'Verification Failed', description: 'Invalid or expired code. Please try again.', variant: 'destructive' });
        return;
      }

      if (data.session) {
        await supabase.from('profiles').update({ phone: signupPhone.trim() }).eq('id', data.user?.id);
        toast({ title: 'Account Verified!', description: 'Welcome to GrabTheByte.' });
      }
    } catch {
      toast({ title: 'Error', description: 'Could not verify OTP.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[300px] h-[300px] rounded-full bg-primary/[0.03] blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[250px] h-[250px] rounded-full bg-secondary/[0.03] blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative w-full max-w-[340px]">
        <div className="text-center mb-4">
          <div className="flex justify-center mb-3"><Logo size="md" showText={false} /></div>
          <h1 className="font-display text-lg font-bold text-foreground">{campus?.name || 'Canteen'}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Sign in to order your favorite food</p>
          {campus && (
            <Button variant="ghost" size="sm" onClick={() => navigate('/select-campus')} className="mt-1.5 h-6 px-2 text-[10px] text-muted-foreground gap-1 rounded-md">
              <RefreshCw size={10} /> Switch Campus
            </Button>
          )}
        </div>

        <div className="bg-card rounded-2xl shadow-soft border border-border p-4">
          <Tabs defaultValue="login" className="w-full" onValueChange={(v) => { clearErrors(); setIsVerifyingOtp(false); }}>
            <TabsList className="grid w-full grid-cols-2 mb-4 h-8 rounded-xl bg-muted p-0.5">
              <TabsTrigger value="login" className="rounded-lg text-xs font-bold">Login</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg text-xs font-bold">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-0">
              <form onSubmit={handleLogin} className="space-y-3">
                <InputField id="login-email" label="Email" icon={Mail} type="email" placeholder="you@college.edu" value={loginEmail} onChange={(e: any) => setLoginEmail(e.target.value)} error={errors.loginEmail} disabled={isLoading} />
                <InputField id="login-password" label="Password" icon={Lock} type="password" placeholder="••••••••" value={loginPassword} onChange={(e: any) => setLoginPassword(e.target.value)} error={errors.loginPassword} disabled={isLoading} />
                <Button type="submit" className="w-full h-9 font-bold rounded-xl gap-1.5 text-xs btn-glow" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Sign In <ArrowRight size={14} /></>}
                </Button>
                {rateLimitMessage && (
                  <div className="flex items-center gap-1.5 p-2 rounded-lg bg-canteen-warning/10 text-canteen-warning">
                    <AlertTriangle size={12} /><span className="text-[10px] font-medium">{rateLimitMessage}</span>
                  </div>
                )}
                <div className="text-center">
                  <button type="button" onClick={() => navigate('/forgot-password')} className="text-[10px] text-muted-foreground hover:text-primary transition-colors font-medium">Forgot your password?</button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-0">
              {!isVerifyingOtp ? (
                <form onSubmit={handleSignup} className="space-y-3">
                  <InputField id="signup-name" label="Full Name" icon={User} placeholder="John Doe" value={signupName} onChange={(e: any) => setSignupName(e.target.value)} error={errors.signupName} disabled={isLoading} />
                  <InputField id="signup-phone" label="Phone Number" icon={Phone} type="tel" placeholder="99999 99999" value={signupPhone} onChange={(e: any) => setSignupPhone(e.target.value)} error={errors.signupPhone} disabled={isLoading} />
                  <InputField id="signup-email" label="Email" icon={Mail} type="email" placeholder="you@college.edu" value={signupEmail} onChange={(e: any) => setSignupEmail(e.target.value)} error={errors.signupEmail} disabled={isLoading} />
                  <InputField id="signup-password" label="Password" icon={Lock} type="password" placeholder="••••••••" value={signupPassword} onChange={(e: any) => setSignupPassword(e.target.value)} error={errors.signupPassword} disabled={isLoading} />
                  <Button type="submit" className="w-full h-9 font-bold rounded-xl gap-1.5 text-xs btn-glow" disabled={isLoading}>
                    {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Create Account <ArrowRight size={14} /></>}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4 text-center mt-4 pb-2">
                  <div className="flex justify-center mb-2">
                    <div className="bg-primary/10 p-3 rounded-full">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                  </div>
                  <h3 className="font-bold text-sm text-foreground">Check your email</h3>
                  <p className="text-[11px] text-muted-foreground px-2">
                    We sent a 6-digit code to <br/><span className="font-bold text-foreground">{signupEmail}</span>
                  </p>
                  
                  <div className="pt-2 px-4">
                    <InputField 
                      id="otp-input" 
                      label="" 
                      icon={Lock} 
                      type="text" 
                      maxLength={6}
                      placeholder="Enter 6-digit code" 
                      value={otpToken} 
                      onChange={(e: any) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                      disabled={isLoading} 
                    />
                  </div>
                  
                  <div className="space-y-3 px-4">
                    <Button type="submit" className="w-full h-9 font-bold rounded-xl gap-1.5 text-xs btn-glow mt-2" disabled={isLoading || otpToken.length !== 6}>
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Verify & Enter <ArrowRight size={14} /></>}
                    </Button>

                    <button 
                      type="button" 
                      onClick={handleResendOtp} 
                      disabled={isLoading || resendCountdown > 0} 
                      className={`text-[11px] w-full flex items-center justify-center gap-1.5 font-bold transition-colors ${resendCountdown > 0 ? 'text-muted-foreground' : 'text-primary hover:text-primary/80'}`}
                    >
                      {resendCountdown > 0 ? (
                        <><Timer size={12} /> Resend in {resendCountdown}s</>
                      ) : (
                        <><RefreshCw size={12} /> Resend Code</>
                      )}
                    </button>
                  </div>
                  
                  <button type="button" onClick={() => setIsVerifyingOtp(false)} className="text-[10px] text-muted-foreground hover:text-primary mt-4 font-medium underline block w-full">
                    Change Email
                  </button>
                  
                  <button type="button" onClick={() => setIsVerifyingOtp(false)} className="text-[10px] text-muted-foreground hover:text-primary mt-2 font-medium">
                    ← Back to Sign Up
                  </button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-4">
          By continuing, you agree to our{' '}
          <button onClick={() => navigate('/terms')} className="underline hover:text-foreground">Terms</button>
          {' & '}
          <button onClick={() => navigate('/privacy')} className="underline hover:text-foreground">Privacy Policy</button>
        </p>
      </motion.div>
    </div>
  );
}