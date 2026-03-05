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
import { Mail, Lock, User, ArrowRight, Loader2, Building2, RefreshCw, AlertTriangle, Phone } from 'lucide-react';
import { checkLoginRateLimit, recordLoginAttempt } from '@/lib/rateLimit';
import { sanitizeEmail } from '@/lib/sanitize';

// Validation schemas
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null);

  // Handle logout parameter
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
      if (!session) {
        navigate('/auth', { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate]);

  // Check for existing session
  useEffect(() => {
    if (isLoggingOut) return;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role, campus_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        // CAMPUS VALIDATION: Super admins can access any campus
        if (roles?.role !== 'super_admin' && campus?.id) {
          if (roles?.campus_id && roles.campus_id !== campus.id) {
            // Wrong campus - sign out and stay on auth page
            await supabase.auth.signOut();
            toast({ 
              title: 'Wrong Campus', 
              description: 'Your account is registered with a different campus. Please switch campus.', 
              variant: 'destructive' 
            });
            return;
          }
        }

        if (roles?.role === 'admin') {
          navigate('/admin');
        } else if (roles?.role === 'kiosk') {
          navigate('/kiosk-scanner');
        } else {
          navigate('/menu');
        }
      }
    };

    checkSession();
  }, [navigate, isLoggingOut, campus, toast]);

  // Auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(async () => {
          const [rolesResult, profileResult] = await Promise.all([
            supabase
              .from('user_roles')
              .select('role, campus_id')
              .eq('user_id', session.user.id)
              .maybeSingle(),
            supabase
              .from('profiles')
              .select('campus_id')
              .eq('user_id', session.user.id)
              .maybeSingle(),
          ]);

          const userRole = rolesResult.data?.role;
          const userCampusId = rolesResult.data?.campus_id || profileResult.data?.campus_id;

          // CAMPUS VALIDATION in auth state change
          // Super admins can access any campus
          if (userRole !== 'super_admin' && campus?.id) {
            if (userCampusId && userCampusId !== campus.id) {
              // User belongs to different campus - sign out
              await supabase.auth.signOut();
              toast({ 
                title: 'Wrong Campus', 
                description: 'Your account is registered with a different campus.', 
                variant: 'destructive' 
              });
              return;
            }
          }
          
          if (userRole === 'admin' || userRole === 'kiosk') {
            navigate(userRole === 'admin' ? '/admin' : '/kiosk-scanner');
          } else {
            navigate('/menu');
          }
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
    e.preventDefault();
    clearErrors();
    setRateLimitMessage(null);
    if (!validateLoginForm()) return;

    // Require campus selection
    if (!campus?.id) {
      toast({ title: 'Campus Required', description: 'Please select a campus first.', variant: 'destructive' });
      navigate('/select-campus');
      return;
    }

    const sanitizedEmail = sanitizeEmail(loginEmail);
    const rateLimit = checkLoginRateLimit(sanitizedEmail);
    if (!rateLimit.allowed) {
      setRateLimitMessage(rateLimit.message || 'Too many login attempts.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password: loginPassword,
      });
      
      if (error) {
        recordLoginAttempt(sanitizedEmail, false);
        toast({ title: 'Login Failed', description: 'Invalid email or password.', variant: 'destructive' });
        return;
      }

      // CAMPUS VALIDATION: Check if user belongs to selected campus
      if (data.user) {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('campus_id, role')
          .eq('user_id', data.user.id)
          .maybeSingle();

        // Super admins can access any campus
        if (userRole?.role !== 'super_admin') {
          // Check if user's campus matches selected campus
          if (userRole?.campus_id && userRole.campus_id !== campus.id) {
            // User belongs to a different campus - sign them out and show error
            await supabase.auth.signOut();
            toast({ 
              title: 'Wrong Campus', 
              description: `Your account is registered with a different campus. Please select the correct campus.`, 
              variant: 'destructive' 
            });
            return;
          }
        }
      }

      recordLoginAttempt(sanitizedEmail, true);
      if (data.user) toast({ title: 'Welcome back!', description: 'Successfully logged in.' });
    } catch (error) {
      toast({ title: 'Login Failed', description: 'Error occurred.', variant: 'destructive' });
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
      navigate('/select-campus');
      return;
    }

    setIsLoading(true);
    
    try {
      // 1. CHECK FOR DUPLICATE PHONE (Using our SQL function)
      // FIX: Added 'as any' to bypass TypeScript check for the new function
      const { data: phoneExists, error: rpcError } = await supabase
        .rpc('check_phone_exists' as any, { phone_input: signupPhone.trim() });

      if (rpcError) {
         // RPC check failed - continue with signup anyway
      }
      
      // If RPC returned true, phone is taken
      if (phoneExists) {
         toast({ 
            title: 'Phone Already Registered', 
            description: 'This number is already in use. Please login instead.', 
            variant: 'destructive' 
         });
         setIsLoading(false);
         return; 
      }

      // 2. Proceed with Signup
      const redirectUrl = `${window.location.origin}/`;
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail.trim(),
        password: signupPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            campus_id: campus.id,
            full_name: signupName.trim(),
            phone: signupPhone.trim(), 
          },
        },
      });
      
      if (error) {
        let msg = error.message;
        if (msg.includes('already registered') || msg.includes('unique')) {
           msg = 'This email is already registered. Please login.';
        }
        toast({ title: 'Signup Failed', description: msg, variant: 'destructive' });
        return;
      }

      if (data.user) {
        // Ensure profile is synced immediately
        if (data.session) {
          await supabase.from('profiles').update({ phone: signupPhone.trim() }).eq('id', data.user.id);
        }
        toast({ title: 'Account Created!', description: 'Welcome to Campus Canteen.' });
      }
    } catch {
      toast({ title: 'Signup Failed', description: 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="fixed inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-secondary/[0.02]" />
      <div className="relative w-full max-w-[380px]">
        
        {campus && (
          <div className="flex items-center justify-center gap-2 mb-5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground">
              <Building2 size={14} />
              <span className="text-xs font-medium">{campus.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/select-campus')} className="h-8 px-2.5 text-xs text-muted-foreground gap-1.5">
              <RefreshCw size={12} /> Switch
            </Button>
          </div>
        )}
        
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4"><Logo size="lg" showText={false} /></div>
          <h1 className="font-display text-xl font-semibold text-foreground">{campus?.name || 'Campus'} Canteen</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to order your favorite food</p>
        </div>

        <div className="bg-card rounded-2xl shadow-soft border border-border p-5">
          <Tabs defaultValue="login" className="w-full" onValueChange={clearErrors}>
            <TabsList className="grid w-full grid-cols-2 mb-5 h-10 rounded-xl bg-muted p-1">
              <TabsTrigger value="login" className="rounded-lg text-sm font-medium">Login</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-lg text-sm font-medium">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-0">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="you@college.edu" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="h-11 pl-10 rounded-xl" required disabled={isLoading} />
                  </div>
                  {errors.loginEmail && <p className="text-xs text-destructive">{errors.loginEmail}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="h-11 pl-10 rounded-xl" required disabled={isLoading} />
                  </div>
                  {errors.loginPassword && <p className="text-xs text-destructive">{errors.loginPassword}</p>}
                </div>
                <Button type="submit" className="w-full h-11 font-semibold rounded-xl gap-2 mt-2" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight size={16} /></>}
                </Button>
                {rateLimitMessage && <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-600"><AlertTriangle size={16} /><span className="text-xs">{rateLimitMessage}</span></div>}
                <div className="text-center">
                    <button type="button" onClick={() => navigate('/forgot-password')} className="text-xs text-muted-foreground hover:text-primary">Forgot your password?</button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-0">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="signup-name" placeholder="John Doe" value={signupName} onChange={(e) => setSignupName(e.target.value)} className="h-11 pl-10 rounded-xl" required disabled={isLoading} />
                  </div>
                  {errors.signupName && <p className="text-xs text-destructive">{errors.signupName}</p>}
                </div>
                
                {/* Phone Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="signup-phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="signup-phone" type="tel" placeholder="99999 99999" value={signupPhone} onChange={(e) => setSignupPhone(e.target.value)} className="h-11 pl-10 rounded-xl" required disabled={isLoading} />
                  </div>
                  {errors.signupPhone && <p className="text-xs text-destructive">{errors.signupPhone}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="signup-email" type="email" placeholder="you@college.edu" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} className="h-11 pl-10 rounded-xl" required disabled={isLoading} />
                  </div>
                  {errors.signupEmail && <p className="text-xs text-destructive">{errors.signupEmail}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="signup-password" type="password" placeholder="••••••••" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} className="h-11 pl-10 rounded-xl" required disabled={isLoading} />
                  </div>
                  {errors.signupPassword && <p className="text-xs text-destructive">{errors.signupPassword}</p>}
                </div>
                <Button type="submit" className="w-full h-11 font-semibold rounded-xl gap-2 mt-2" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight size={16} /></>}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}