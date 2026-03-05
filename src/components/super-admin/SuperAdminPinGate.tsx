import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Logo } from '@/components/Logo';

interface SuperAdminPinGateProps {
  children: React.ReactNode;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 300; // 5 minutes

export function SuperAdminPinGate({ children }: SuperAdminPinGateProps) {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if user is super admin
  useEffect(() => {
    const checkSuperAdmin = async () => {
      if (!user) {
        setIsSuperAdmin(false);
        return;
      }

      const { data, error } = await supabase.rpc('is_super_admin', {
        _user_id: user.id
      });

      if (error) {
        console.error('Error checking super admin status:', error);
        setIsSuperAdmin(false);
        return;
      }

      setIsSuperAdmin(data);
    };

    if (user) {
      checkSuperAdmin();
    }
  }, [user]);

  // Check if super admin has a PIN set
  useEffect(() => {
    const checkPin = async () => {
      if (!user || !isSuperAdmin) return;

      try {
        const { data, error } = await supabase.functions.invoke('admin-auth', {
          body: { action: 'check-pin' }
        });

        if (error) throw error;
        setHasPin(data.hasPin);
      } catch (err) {
        console.error('Error checking PIN:', err);
        setHasPin(false);
      }
    };

    if (isSuperAdmin) {
      checkPin();
    }
  }, [user, isSuperAdmin]);

  // Lockout timer
  useEffect(() => {
    if (!lockoutEnd) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutEnd - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      
      if (remaining === 0) {
        setLockoutEnd(null);
        setAttempts(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutEnd]);

  // Focus input
  useEffect(() => {
    if (isSuperAdmin && hasPin !== null && !isVerified) {
      inputRef.current?.focus();
    }
  }, [isSuperAdmin, hasPin, isVerified]);

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutEnd && Date.now() < lockoutEnd) {
      toast.error('Too many attempts. Please wait.');
      return;
    }

    if (pin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }

    setIsVerifying(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-auth', {
        body: { action: 'verify-pin', pin }
      });

      if (error) throw error;

      if (data.success) {
        setIsVerified(true);
        setAttempts(0);
        toast.success('Access granted');
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        
        if (newAttempts >= MAX_ATTEMPTS) {
          setLockoutEnd(Date.now() + LOCKOUT_TIME * 1000);
          toast.error(`Too many attempts. Locked for ${LOCKOUT_TIME / 60} minutes.`);
        } else {
          toast.error(`Invalid PIN. ${MAX_ATTEMPTS - newAttempts} attempts remaining.`);
        }
      }
    } catch (err) {
      console.error('Error verifying PIN:', err);
      toast.error('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
      setPin('');
    }
  };

  const handleCreatePin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pin.length < 4 || pin.length > 8) {
      toast.error('PIN must be 4-8 digits');
      return;
    }

    setIsVerifying(true);

    try {
      const { data, error } = await supabase.functions.invoke('admin-auth', {
        body: { action: 'create-pin', pin }
      });

      if (error) throw error;

      if (data.success) {
        setHasPin(true);
        setIsVerified(true);
        toast.success('PIN created successfully');
      } else {
        toast.error(data.error || 'Failed to create PIN');
      }
    } catch (err) {
      console.error('Error creating PIN:', err);
      toast.error('Failed to create PIN');
    } finally {
      setIsVerifying(false);
      setPin('');
    }
  };

  // Loading state
  if (authLoading || isSuperAdmin === null || (isSuperAdmin && hasPin === null)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    navigate('/auth');
    return null;
  }

  // Not a super admin
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle className="text-xl text-destructive">Access Denied</CardTitle>
            <CardDescription>
              You don't have Super Admin privileges. This area is restricted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => navigate('/')}
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already verified
  if (isVerified) {
    return <>{children}</>;
  }

  // PIN gate UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <Logo size="md" />
          </div>
          <div className="mx-auto w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-xl">
            {hasPin ? 'Super Admin Access' : 'Set Up Super Admin PIN'}
          </CardTitle>
          <CardDescription>
            {hasPin 
              ? 'Enter your PIN to access the Super Admin dashboard'
              : 'Create a secure PIN (4-8 digits) for accessing this dashboard'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={hasPin ? handleVerifyPin : handleCreatePin} className="space-y-4">
            {/* Lockout warning */}
            {lockoutEnd && Date.now() < lockoutEnd && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Locked. Try again in {Math.floor(lockoutRemaining / 60)}:
                  {String(lockoutRemaining % 60).padStart(2, '0')}
                </span>
              </div>
            )}

            {/* Attempts warning */}
            {attempts > 0 && attempts < MAX_ATTEMPTS && (
              <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{MAX_ATTEMPTS - attempts} attempts remaining</span>
              </div>
            )}

            {/* PIN input */}
            <div className="relative">
              <Input
                ref={inputRef}
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder={hasPin ? 'Enter PIN' : 'Create PIN (4-8 digits)'}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                disabled={isVerifying || (lockoutEnd && Date.now() < lockoutEnd) ? true : false}
                className="text-center text-lg tracking-[0.5em] pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={isVerifying || pin.length < 4 || (lockoutEnd && Date.now() < lockoutEnd) ? true : false}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {hasPin ? 'Verifying...' : 'Creating...'}
                </>
              ) : (
                hasPin ? 'Unlock Dashboard' : 'Create PIN'
              )}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Protected by GrabTheByte Security
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
