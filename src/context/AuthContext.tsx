import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { User, UserRole } from "@/types/canteen";

type UserAccess = { role: UserRole; campusId?: string };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isKiosk: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapRole = (role: unknown): UserRole => {
  if (role === "admin" || role === "kiosk" || role === "student" || role === "super_admin") return role;
  return "student";
};

const getFullName = (sessionEmail: string | undefined, fullNameMeta: unknown) => {
  const metaName = typeof fullNameMeta === "string" ? fullNameMeta.trim() : "";
  if (metaName) return metaName;
  return (sessionEmail ?? "User").split("@")[0].replace(/[._]/g, " ");
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserAccess = useCallback(async (userId: string): Promise<UserAccess> => {
    // Fetch role + campus from user_roles; also fall back to profiles.campus_id
    const [rolesResult, profileResult] = await Promise.all([
      supabase.from("user_roles").select("role, campus_id").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("campus_id").eq("user_id", userId).maybeSingle(),
    ]);

    const role = mapRole(rolesResult.data?.role);
    const campusId = (rolesResult.data?.campus_id as string | undefined) || (profileResult.data?.campus_id as string | undefined);
    return { role, campusId };
  }, []);

  const setFromSession = useCallback(
    async (nextSession: Session | null) => {
      setSession(nextSession);

      if (!nextSession?.user) {
        setUser(null);
        return;
      }

      const access = await fetchUserAccess(nextSession.user.id);
      setUser({
        id: nextSession.user.id,
        email: nextSession.user.email ?? "",
        fullName: getFullName(nextSession.user.email, nextSession.user.user_metadata?.full_name),
        phone: typeof nextSession.user.phone === "string" && nextSession.user.phone ? nextSession.user.phone : undefined,
        role: access.role,
        campusId: access.campusId,
      });
    },
    [fetchUserAccess]
  );

  // Validate session - checks if user still exists in Supabase Auth
  const validateSession = useCallback(async () => {
    if (!session) return;
    
    try {
      const { data, error } = await supabase.auth.getUser();
      
      // If user doesn't exist anymore, force logout
      if (error || !data.user) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
      }
    } catch {
      // On error, force logout for security
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
    }
  }, [session]);

  // Initialize + listen for auth changes
  useEffect(() => {
    let mounted = true;

    // Listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      // Only sync state here; defer any Supabase reads to avoid deadlocks
      setSession(nextSession);

      setTimeout(() => {
        if (!mounted) return;
        setFromSession(nextSession).finally(() => setIsLoading(false));
      }, 0);
    });

    // THEN get current session
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setFromSession(data.session).finally(() => setIsLoading(false));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setFromSession]);

  // Periodically validate session (every 5 minutes)
  useEffect(() => {
    if (!session) return;

    // Validate immediately on mount/session change
    validateSession();

    // Then validate periodically
    const interval = setInterval(validateSession, 300000);

    return () => clearInterval(interval);
  }, [session, validateSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) return { success: false, error: error.message };

        const role = data.user ? (await fetchUserAccess(data.user.id)).role : undefined;
        // navigation is handled elsewhere via onAuthStateChange
        return { success: true, role };
      } catch {
        return { success: false, error: "An unexpected error occurred" };
      } finally {
        setIsLoading(false);
      }
    },
    [fetchUserAccess]
  );

  const signup = useCallback(async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch {
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    // Local UI-only updates (Profile page). Do NOT persist roles client-side.
    setUser((prev) => {
      if (!prev) return prev;
      const next: User = { ...prev, ...updates, role: prev.role };
      return next;
    });
  }, []);

  const changePassword = useCallback(async (_currentPassword: string, newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch {
      return { success: false, error: "An unexpected error occurred" };
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch {
      return { success: false, error: "An unexpected error occurred" };
    }
  }, []);

  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";
  const isKiosk = user?.role === "kiosk";
  const isSuperAdmin = user?.role === "super_admin";

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      isLoading,
      isAuthenticated,
      isAdmin,
      isKiosk,
      isSuperAdmin,
      login,
      signup,
      logout,
      updateUser,
      changePassword,
      requestPasswordReset,
    }),
    [user, session, isLoading, isAuthenticated, isAdmin, isKiosk, isSuperAdmin, login, signup, logout, updateUser, changePassword, requestPasswordReset]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
