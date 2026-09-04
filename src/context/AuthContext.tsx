import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback, useRef } from "react";
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

type UserAccess = { role: UserRole; campusId?: string; profile?: any };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitializing: boolean; // 🛡️ NEW: True only during the very first boot check
  isAuthenticated: boolean;
  isAdmin: boolean;
  isKiosk: boolean;
  isSuperAdmin: boolean;
  isAnonymous: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: UserRole }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Immortal cache keys
const CACHED_USER_KEY = 'gtb_cached_user';
const CACHED_CAMPUS_KEY = 'selected_campus_id';

const mapRole = (role: unknown): UserRole => {
  if (role === "admin" || role === "kiosk" || role === "student" || role === "super_admin") return role;
  return "student";
};

const getFullName = (sessionEmail: string | undefined, fullNameMeta: unknown) => {
  const metaName = typeof fullNameMeta === "string" ? fullNameMeta.trim() : "";
  if (metaName) return metaName;
  if (sessionEmail) return sessionEmail.split("@")[0].replace(/[._]/g, " ");
  return "Guest Visitor";
};

// ─── SAFE localStorage helpers (never throws) ────────────────────────────────
const safeGetUser = (): User | null => {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const safeSaveUser = (user: User) => {
  try { localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user)); } catch {}
};

const safeRemoveUser = () => {
  try { localStorage.removeItem(CACHED_USER_KEY); } catch {}
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 🛡️ isInitializing: true until the VERY FIRST boot check completes.
  // ProtectedRoute must wait for this to be false before making any redirect decisions.
  const [isInitializing, setIsInitializing] = useState(true);

  // Guard: prevent concurrent session restorations
  const isRestoringRef = useRef(false);

  const fetchUserAccess = useCallback(async (userId: string): Promise<UserAccess> => {
    // 🛡️ OFFLINE SHIELD: Never hit the network when offline — use cache
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (isOffline) {
      const cachedUser = safeGetUser();
      return {
        role: cachedUser?.role || "student",
        campusId: localStorage.getItem(CACHED_CAMPUS_KEY) || cachedUser?.campusId,
        profile: null,
      };
    }

    try {
      const [rolesResult, profileResult] = await Promise.all([
        supabase.from("user_roles").select("role, campus_id").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("campus_id, full_name, phone").eq("user_id", userId).maybeSingle(),
      ]);

      const role = mapRole(rolesResult.data?.role);
      const campusId =
        (rolesResult.data?.campus_id as string | undefined) ||
        (profileResult.data?.campus_id as string | undefined);

      if (campusId) {
        try { localStorage.setItem(CACHED_CAMPUS_KEY, campusId); } catch {}
      }

      return { role, campusId, profile: profileResult.data };
    } catch {
      // Network failed — trust the cache
      const cachedUser = safeGetUser();
      return {
        role: cachedUser?.role || "student",
        campusId: localStorage.getItem(CACHED_CAMPUS_KEY) || cachedUser?.campusId,
        profile: null,
      };
    }
  }, []);

  const buildAndSaveUser = useCallback(
    async (nextSession: Session): Promise<User> => {
      const access = await fetchUserAccess(nextSession.user.id);
      const fallbackCampusId =
        access.campusId ||
        nextSession.user.user_metadata?.campus_id ||
        localStorage.getItem(CACHED_CAMPUS_KEY) ||
        undefined;

      const profileName = access.profile?.full_name;
      const profilePhone = access.profile?.phone;

      const userData: User = {
        id: nextSession.user.id,
        email: nextSession.user.email ?? "",
        fullName: getFullName(
          nextSession.user.email,
          nextSession.user.user_metadata?.full_name || profileName
        ),
        phone:
          typeof nextSession.user.phone === "string" && nextSession.user.phone
            ? nextSession.user.phone
            : profilePhone || undefined,
        role: access.role,
        campusId: fallbackCampusId,
      } as User;

      setUser(userData);
      setSession(nextSession);
      safeSaveUser(userData);

      // OneSignal setup
      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        try {
          OneSignalNative.initialize("be94972c-ff0b-4faa-ad5f-402ceedbf8ca");
          OneSignalNative.login(nextSession.user.id);
          OneSignalNative.User.addTags({
            role: access.role,
            campus_id: fallbackCampusId || 'none',
          });
        } catch {}
      } else if (typeof window !== "undefined" && window.OneSignalDeferred) {
        window.OneSignalDeferred.push(async function (OneSignal: any) {
          try {
            await OneSignal.login(nextSession.user.id);
            await OneSignal.User.addTags({
              role: access.role,
              campus_id: fallbackCampusId || 'none',
            });
          } catch {}
        });
      }

      return userData;
    },
    [fetchUserAccess]
  );

  useEffect(() => {
    let mounted = true;

    // ─── BOOT: First thing on app start ────────────────────────────────────
    const boot = async () => {
      // Step 1: Instantly restore from immortal cache so UI is never blank
      const cachedUser = safeGetUser();
      if (cachedUser && mounted) {
        setUser(cachedUser);
        console.log("🦅 GrabTheByte: Immortal cache restored instantly.");
      }

      // Step 2: Try to get a real Supabase session (may fail offline)
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error || !data.session) {
          // No live session — but if cache exists, stay logged in
          if (cachedUser) {
            console.log("🦅 GrabTheByte: No live session, kept alive by immortal cache.");
          } else {
            setUser(null);
            setSession(null);
          }
        } else {
          // Live session found — build fresh user data
          if (!isRestoringRef.current) {
            isRestoringRef.current = true;
            try {
              await buildAndSaveUser(data.session);
            } finally {
              isRestoringRef.current = false;
            }
          }
        }
      } catch (err) {
        // Network error on boot — cache is the source of truth
        console.log("🦅 GrabTheByte: Boot network error, immortal cache is active.");
        if (!cachedUser && mounted) {
          setUser(null);
          setSession(null);
        }
      } finally {
        if (mounted) {
          setIsInitializing(false); // 🛡️ Boot complete — ProtectedRoute can now make decisions
        }
      }
    };

    boot();

    // ─── AUTH STATE LISTENER ────────────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (!mounted) return;

        console.log(`🦅 GrabTheByte Auth Event: ${event}`);

        // 🛡️ IMMORTAL BLOCKADE: Never auto-logout from background events
        // TOKEN_REFRESH_FAILED is allowed to pass through so the token
        // gets refreshed when network comes back — but we DON'T clear the user
        if (event === 'SIGNED_OUT') {
          // Only honor SIGNED_OUT if it came from our own logout() function
          // (logout() sets user/session to null itself — this handler does nothing extra)
          console.log("🦅 GrabTheByte: Background SIGNED_OUT blocked by Immortal Shield.");
          return;
        }

        if (event === 'TOKEN_REFRESH_FAILED') {
          // Network is down — stay logged in from cache, try again later
          console.log("🦅 GrabTheByte: Token refresh failed (offline?). Session preserved from cache.");
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (nextSession && !isRestoringRef.current) {
            isRestoringRef.current = true;
            try {
              await buildAndSaveUser(nextSession);
            } finally {
              isRestoringRef.current = false;
            }
          }
        }
      }
    );

    // OneSignal native init
    if (Capacitor.isNativePlatform()) {
      try {
        OneSignalNative.initialize("be94972c-ff0b-4faa-ad5f-402ceedbf8ca");
        OneSignalNative.Notifications.requestPermission(true).then(() => {});
      } catch {}
    }

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [buildAndSaveUser]);

  // ─── LOGIN ──────────────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) return { success: false, error: error.message };

      if (data.session) {
        const userData = await buildAndSaveUser(data.session);
        return { success: true, role: userData.role };
      }
      return { success: true };
    } catch {
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setIsLoading(false);
    }
  }, [buildAndSaveUser]);

  // ─── SIGNUP ─────────────────────────────────────────────────────────────────
  const signup = useCallback(async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: fullName.trim() },
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

  // ─── LOGOUT: THE ONLY WAY OUT ────────────────────────────────────────────────
  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      // OneSignal logout
      const isNative = Capacitor.isNativePlatform();
      if (isNative) {
        try { OneSignalNative.logout(); } catch {}
      } else if (typeof window !== "undefined" && window.OneSignalDeferred) {
        window.OneSignalDeferred.push(async function (OneSignal: any) {
          try { await OneSignal.logout(); } catch {}
        });
      }

      // Clear immortal vaults FIRST — then sign out
      safeRemoveUser();
      try { localStorage.removeItem(CACHED_CAMPUS_KEY); } catch {}

      // Clear state immediately so UI reacts
      setSession(null);
      setUser(null);

      // Sign out from Supabase (best effort — don't block on this)
      supabase.auth.signOut().catch(() => {});
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ─── UPDATE USER ─────────────────────────────────────────────────────────────
  const updateUser = useCallback((updates: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates, role: prev.role };
      safeSaveUser(updated);
      return updated;
    });
  }, []);

  // ─── CHANGE PASSWORD ─────────────────────────────────────────────────────────
  const changePassword = useCallback(async (_currentPassword: string, newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch {
      return { success: false, error: "An unexpected error occurred" };
    }
  }, []);

  // ─── PASSWORD RESET ──────────────────────────────────────────────────────────
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
  const isAnonymous = session?.user?.is_anonymous ?? false;

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      isLoading,
      isInitializing,
      isAuthenticated,
      isAdmin,
      isKiosk,
      isSuperAdmin,
      isAnonymous,
      login,
      signup,
      logout,
      updateUser,
      changePassword,
      requestPasswordReset,
    }),
    [
      user, session, isLoading, isInitializing,
      isAuthenticated, isAdmin, isKiosk, isSuperAdmin, isAnonymous,
      login, signup, logout, updateUser, changePassword, requestPasswordReset,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}