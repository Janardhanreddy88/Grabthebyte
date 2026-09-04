import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface AdminAuthContextType {
  isAdmin: boolean;
  isAdminAuthenticated: boolean;
  isLoading: boolean;
  hasPin: boolean;
  storedAdminEmail: string | null;
  authenticate: (pin: string) => Promise<{ success: boolean; error?: string; remainingAttempts?: number }>;
  createPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  changePin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  resetPin: () => Promise<void>;
  logout: () => Promise<void>;
  lastActivity: Date | null;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const SESSION_TOKEN_KEY = 'canteen_admin_session_token';
const ADMIN_EMAIL_KEY = 'canteen_admin_email';

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  // 🛡️ FIX: Pull isInitializing so we never check isAdmin too early
  const { user, isAdmin, isInitializing } = useAuth();

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPin, setHasPin] = useState(false);
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const getStoredAdminEmail = (): string | null => {
    try { return localStorage.getItem(ADMIN_EMAIL_KEY); } catch { return null; }
  };

  const storedAdminEmail = getStoredAdminEmail();

  const getAuthToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  const callAdminAuth = async (
    action: string,
    data: Record<string, string> = {}
  ): Promise<{ success?: boolean; error?: string; [key: string]: unknown }> => {
    const token = await getAuthToken();
    if (!token) return { error: 'Not authenticated' };

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };

    const storedSession = localStorage.getItem(SESSION_TOKEN_KEY);
    if (storedSession) {
      headers['X-Admin-Session'] = storedSession;
    }

    const { data: response, error } = await supabase.functions.invoke('admin-auth', {
      body: { action, ...data },
      headers,
    });

    if (error) {
      console.error('Admin auth error:', error);
      return { error: error.message };
    }

    return response;
  };

  // 🛡️ FIX: Wait for isInitializing to be false before checking isAdmin
  // Previously this ran immediately and saw isAdmin=false (role not loaded yet)
  // causing admin to be treated as student briefly
  useEffect(() => {
    // Don't run until AuthContext has finished its first boot check
    if (isInitializing) return;

    const checkPinAndSession = async () => {
      // Not an admin — clear everything and stop
      if (!user || !isAdmin) {
        setIsAdminAuthenticated(false);
        setHasPin(false);
        setIsLoading(false);
        return;
      }

      try {
        // Check if PIN exists
        const pinResult = await callAdminAuth('check-pin');
        setHasPin(!!pinResult.hasPin);

        // Verify existing session token
        const storedSession = localStorage.getItem(SESSION_TOKEN_KEY);
        if (storedSession) {
          const sessionResult = await callAdminAuth('verify-session');
          if (sessionResult.valid) {
            setIsAdminAuthenticated(true);
            setSessionToken(storedSession);
            setLastActivity(new Date());
          } else {
            localStorage.removeItem(SESSION_TOKEN_KEY);
            setIsAdminAuthenticated(false);
          }
        }
      } catch (error) {
        console.error('Error checking PIN/session:', error);
      }

      setIsLoading(false);
    };

    checkPinAndSession();
  }, [user, isAdmin, isInitializing]); // 🛡️ FIX: Added isInitializing to deps

  // Periodically verify session and extend it
  useEffect(() => {
    if (!isAdminAuthenticated || !sessionToken) return;

    const interval = setInterval(async () => {
      const result = await callAdminAuth('verify-session');
      if (!result.valid) {
        setIsAdminAuthenticated(false);
        setSessionToken(null);
        localStorage.removeItem(SESSION_TOKEN_KEY);
      } else {
        setLastActivity(new Date());
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAdminAuthenticated, sessionToken]);

  const authenticate = useCallback(async (
    pin: string
  ): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> => {
    if (!user || !isAdmin) return { success: false, error: 'Not authorized' };

    const result = await callAdminAuth('verify-pin', { pin });

    if (result.success && result.sessionToken) {
      localStorage.setItem(SESSION_TOKEN_KEY, result.sessionToken as string);
      localStorage.setItem(ADMIN_EMAIL_KEY, user.email?.toLowerCase() || '');
      setSessionToken(result.sessionToken as string);
      setIsAdminAuthenticated(true);
      setLastActivity(new Date());
      return { success: true };
    }

    return {
      success: false,
      error: result.error as string,
      remainingAttempts: result.remainingAttempts as number | undefined,
    };
  }, [user, isAdmin]);

  const createPin = useCallback(async (pin: string): Promise<{ success: boolean; error?: string }> => {
    if (!user || !isAdmin) return { success: false, error: 'Not authorized' };
    if (pin.length < 4 || pin.length > 8) return { success: false, error: 'PIN must be 4-8 digits' };

    const result = await callAdminAuth('create-pin', { pin });
    if (result.success) {
      setHasPin(true);
      return authenticate(pin);
    }

    return { success: false, error: result.error as string };
  }, [user, isAdmin, authenticate]);

  const changePin = useCallback(async (
    oldPin: string,
    newPin: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user || !isAdmin) return { success: false, error: 'Not authorized' };
    if (newPin.length < 4 || newPin.length > 8) return { success: false, error: 'New PIN must be 4-8 digits' };

    const result = await callAdminAuth('change-pin', { pin: oldPin, newPin });
    if (result.success) return { success: true };
    return { success: false, error: result.error as string };
  }, [user, isAdmin]);

  const logout = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (token) await callAdminAuth('logout');
    } catch {
      console.log('Admin logout cleanup (auth may already be invalidated)');
    }

    localStorage.removeItem(SESSION_TOKEN_KEY);
    setSessionToken(null);
    setIsAdminAuthenticated(false);
    setLastActivity(null);
  }, []);

  const resetPin = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (token) await callAdminAuth('reset-pin');
    } catch {
      console.log('Admin reset cleanup (auth may already be invalidated)');
    }

    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(ADMIN_EMAIL_KEY);
    setSessionToken(null);
    setHasPin(false);
    setIsAdminAuthenticated(false);
    setLastActivity(null);
  }, []);

  return (
    <AdminAuthContext.Provider value={{
      isAdmin,
      isAdminAuthenticated,
      isLoading,
      hasPin,
      storedAdminEmail,
      authenticate,
      createPin,
      changePin,
      resetPin,
      logout,
      lastActivity,
    }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  return context;
}