import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { Mail, ArrowLeft, Loader2, CheckCircle2, Send } from 'lucide-react';

const emailSchema = z.string().trim().email('Please enter a valid email address').max(255);

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { emailSchema.parse(email); setError(null); } catch (err: any) { setError(err.errors[0].message); return; }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
      setIsSubmitted(true);
      toast({ title: 'Email Sent!', description: 'Check your inbox for the reset link.' });
    } catch { toast({ title: 'Error', description: 'An unexpected error occurred.', variant: 'destructive' }); }
    finally { setIsLoading(false); }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="relative w-full max-w-[320px] text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3"><CheckCircle2 className="w-6 h-6 text-green-500" /></div>
          <h1 className="text-base font-bold mb-1">Check Your Email</h1>
          <p className="text-xs text-muted-foreground mb-4">Reset link sent to <strong className="text-foreground">{email}</strong></p>
          <div className="bg-card rounded-xl border border-border p-3 mb-3">
            <p className="text-xs text-muted-foreground">Didn't receive it? <button onClick={() => setIsSubmitted(false)} className="text-primary hover:underline font-medium">Try again</button></p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => navigate('/auth')}><ArrowLeft size={12} />Back to Login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="relative w-full max-w-[320px]">
        <div className="text-center mb-4">
          <div className="flex justify-center mb-3"><Logo size="md" showText={false} /></div>
          <h1 className="text-base font-bold">Forgot Password?</h1>
          <p className="text-xs text-muted-foreground mt-0.5">We'll send you reset instructions</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
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
              {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</> : <><Send size={13} /> Send Reset Link</>}
            </Button>
          </form>
        </div>
        <div className="text-center mt-4">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5" onClick={() => navigate('/auth')}><ArrowLeft size={12} />Back to Login</Button>
        </div>
      </div>
    </div>
  );
}