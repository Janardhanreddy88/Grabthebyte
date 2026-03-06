import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { Mail, ArrowLeft, Loader2, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { motion, AnimatePresence } from 'framer-motion';

const emailSchema = z.string().trim().email('Please enter a valid email address').max(255);
const passwordSchema = z.string().min(6, 'Min 6 characters').max(72, 'Password is too long');

type Step = 'email' | 'otp' | 'password' | 'success';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    try { emailSchema.parse(email); setError(null); } catch (err: any) { setError(err.errors[0].message); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      setStep('otp');
      toast({ title: 'Code Sent!', description: 'Check your email for the verification code.' });
    } catch { toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) { setError('Please enter the 6-digit code'); return; }
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp, type: 'recovery' });
      if (error) { setError('Invalid or expired code. Please try again.'); return; }
      setStep('password');
      toast({ title: 'Verified!', description: 'Now set your new password.' });
    } catch { setError('Verification failed. Please try again.'); }
    finally { setIsLoading(false); }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try { passwordSchema.parse(password); } catch (err: any) { setError(err.errors[0].message); return; }
    if (password !== confirmPassword) { setError("Passwords don't match"); return; }
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      setStep('success');
      toast({ title: 'Password Updated!' });
      setTimeout(async () => { await supabase.auth.signOut(); navigate('/auth'); }, 2500);
    } catch { toast({ title: 'Error', variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  const stepVariants = { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 } };

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <motion.div {...stepVariants} className="w-full max-w-[320px] text-center">
          <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-7 h-7 text-green-500" />
          </div>
          <h1 className="text-base font-bold mb-1">Password Updated!</h1>
          <p className="text-xs text-muted-foreground mb-3">Redirecting to login...</p>
          <Loader2 className="w-4 h-4 animate-spin text-primary mx-auto" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="relative w-full max-w-[320px]">
        <div className="text-center mb-4">
          <div className="flex justify-center mb-3"><Logo size="md" showText={false} /></div>
          <h1 className="text-base font-bold">
            {step === 'email' && 'Forgot Password?'}
            {step === 'otp' && 'Verify Your Email'}
            {step === 'password' && 'Set New Password'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {step === 'email' && "We'll send a verification code to your email"}
            {step === 'otp' && `Enter the 6-digit code sent to ${email}`}
            {step === 'password' && 'Choose a strong new password'}
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <AnimatePresence mode="wait">
            {step === 'email' && (
              <motion.form key="email" {...stepVariants} onSubmit={handleSendOtp} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-[11px] font-semibold text-muted-foreground">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="you@college.edu" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }}
                      className={`h-9 pl-9 text-sm rounded-xl ${error ? 'border-destructive' : ''}`} required disabled={isLoading} autoFocus />
                  </div>
                  {error && <p className="text-[10px] text-destructive">{error}</p>}
                </div>
                <Button type="submit" className="w-full h-9 font-bold rounded-xl gap-1.5 text-xs" disabled={isLoading || !email.trim()}>
                  {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</> : <>Send Code</>}
                </Button>
              </motion.form>
            )}

            {step === 'otp' && (
              <motion.form key="otp" {...stepVariants} onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <Label className="text-[11px] font-semibold text-muted-foreground">Verification Code</Label>
                  <InputOTP maxLength={6} value={otp} onChange={(val) => { setOtp(val); setError(null); }}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  {error && <p className="text-[10px] text-destructive">{error}</p>}
                </div>
                <Button type="submit" className="w-full h-9 font-bold rounded-xl gap-1.5 text-xs" disabled={isLoading || otp.length !== 6}>
                  {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying...</> : <>Verify Code</>}
                </Button>
                <div className="text-center">
                  <button type="button" onClick={() => { setOtp(''); handleSendOtp({ preventDefault: () => {} } as any); }} className="text-[10px] text-muted-foreground hover:text-primary font-medium">
                    Didn't receive? Resend code
                  </button>
                </div>
              </motion.form>
            )}

            {step === 'password' && (
              <motion.form key="password" {...stepVariants} onSubmit={handleUpdatePassword} className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="new-password" className="text-[11px] font-semibold text-muted-foreground">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input id="new-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(null); }}
                      className="h-9 pl-9 pr-9 text-sm rounded-xl" required disabled={isLoading} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirm-password" className="text-[11px] font-semibold text-muted-foreground">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input id="confirm-password" type={showConfirm ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                      className="h-9 pl-9 pr-9 text-sm rounded-xl" required disabled={isLoading} />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showConfirm ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  {error && <p className="text-[10px] text-destructive">{error}</p>}
                </div>
                <Button type="submit" className="w-full h-9 font-bold rounded-xl gap-1.5 text-xs" disabled={isLoading || !password || !confirmPassword}>
                  {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating...</> : <>Update Password</>}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        <div className="text-center mt-4">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5" onClick={() => {
            if (step === 'otp') setStep('email');
            else if (step === 'password') setStep('otp');
            else navigate('/auth');
          }}>
            <ArrowLeft size={12} /> {step === 'email' ? 'Back to Login' : 'Go Back'}
          </Button>
        </div>
      </div>
    </div>
  );
}
