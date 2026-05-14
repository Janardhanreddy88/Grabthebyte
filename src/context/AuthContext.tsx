import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { User, UserRole } from "@/types/canteen";
import OneSignalNative from 'onesignal-cordova-plugin';
import { Capacitor } from '@capacitor/core';

declare global {
  interface Window {
    OneSignalDeferred: any[];
  }
}

// 🦅 ADDED 'profile' to grab the Guest Visitor data!
type UserAccess = { role: UserRole; campusId?: string; profile?: any };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isKiosk: boolean;
  isSuperAdmin: boolean;
  isAnonymous: boolean; // 🦅 NEW: Expose the Guest Status globally!
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

// 🦅 UPGRADED: Handle Anonymous Users who have no email!
const getFullName = (sessionEmail: string | undefined, fullNameMeta: unknown) => {
  const metaName = typeof fullNameMeta === "string" ? fullNameMeta.trim() : "";
  if (metaName) return metaName;
  if (sessionEmail) return sessionEmail.split("@")[0].replace(/[._]/g, " ");
  return "Guest Visitor"; // Fallback for Anonymous!
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserAccess = useCallback(async (userId: string): Promise<UserAccess> => {
    // 🚀 OFFLINE SHIELD: Skip network request if offline to avoid crashes
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { role: "student", campusId: undefined, profile: null };
    }

    try {
      const [rolesResult, profileResult] = await Promise.all([
        supabase.from("user_roles").select("role, campus_id").eq("user_id", userId).maybeSingle(),
        // 🦅 Fetch the profile so we get the Dummy Phone and Guest Name!
        supabase.from("profiles").select("campus_id, full_name, phone").eq("user_id", userId).maybeSingle(),
      ]);
      const role = mapRole(rolesResult.data?.role);
      const campusId = (rolesResult.data?.campus_id as string | undefined) || (profileResult.data?.campus_id as string | undefined);
      return { role, campusId, profile: profileResult.data };
    } catch {
      return { role: "student", campusId: undefined, profile: null };
    }
  }, []);

  const setFromSession = useCallback(
    async (nextSession: Session | null) => {
      setSession(nextSession);

      if (!nextSession?.user) {
        setUser(null);
        return;
      }

      const access = await fetchUserAccess(nextSession.user.id);
      const fallbackCampusId = access.campusId || nextSession.user.user_metadata?.campus_id;
      
      // 🦅 Extract data from the database profile if metadata is empty (Anonymous Users)
      const profileName = access.profile?.full_name;
      const profilePhone = access.profile?.phone;

      setUser({
        id: nextSession.user.id,
        email: nextSession.user.email ?? "",
        fullName: getFullName(nextSession.user.email, nextSession.user.user_metadata?.full_name || profileName),
        phone: typeof nextSession.user.phone === "string" && nextSession.user.phone ? nextSession.user.phone : (profilePhone || undefined),
        role: access.role,
        campusId: fallbackCampusId,
      } as User); // Asserting as User to satisfy the type

      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        try {
          OneSignalNative.initialize("be94972c-ff0b-4faa-ad5f-402ceedbf8ca");
          OneSignalNative.login(nextSession.user.id);
          OneSignalNative.User.addTags({ role: access.role, campus_id: fallbackCampusId || 'none' });
        } catch (err) {}
      } else if (typeof window !== "undefined" && window.OneSignalDeferred) {
        window.OneSignalDeferred.push(async function(OneSignal: any) {
          try {
            await OneSignal.login(nextSession.user.id);
            await OneSignal.User.addTags({ role: access.role, campus_id: fallbackCampusId || 'none' });
          } catch (err) {}
        });
      }
    },
    [fetchUserAccess]
  );

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setTimeout(() => {
        if (!mounted) return;
        setFromSession(nextSession).finally(() => setIsLoading(false));
      }, 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setFromSession(data.session).finally(() => setIsLoading(false));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setFromSession]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return { success: false, error: error.message };
      const role = data.user ? (await fetchUserAccess(data.user.id)).role : undefined;
      return { success: true, role };
    } catch {
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserAccess]);

  const signup = useCallback(async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email: email.trim(), password, options: { emailRedirectTo: redirectUrl, data: { full_name: fullName.trim() } },
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
      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        try { OneSignalNative.logout(); } catch (err) {}
      } else if (typeof window !== "undefined" && window.OneSignalDeferred) {
        window.OneSignalDeferred.push(async function(OneSignal: any) {
          try { await OneSignal.logout(); } catch (err) {}
        });
      }
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      return { ...prev, ...updates, role: prev.role };
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
  const isAnonymous = session?.user?.is_anonymous ?? false; // 🦅 THE GUEST CHECK FLAG

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      try {
        OneSignalNative.initialize("be94972c-ff0b-4faa-ad5f-402ceedbf8ca");
        OneSignalNative.Notifications.requestPermission(true).then((accepted: boolean) => {});
      } catch (err) {}
    }
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({ 
      user, session, isLoading, isAuthenticated, isAdmin, isKiosk, isSuperAdmin, isAnonymous, // 🦅 EXPORTED HERE
      login, signup, logout, updateUser, changePassword, requestPasswordReset 
    }),
    [user, session, isLoading, isAuthenticated, isAdmin, isKiosk, isSuperAdmin, isAnonymous, login, signup, logout, updateUser, changePassword, requestPasswordReset]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}