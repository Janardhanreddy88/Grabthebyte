import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Campus, CampusSettings } from '@/types/campus';

interface CampusContextType {
  campus: Campus | null;
  isLoading: boolean;
  error: string | null;
  settings: CampusSettings | null;
  setCampusByCode: (code: string) => Promise<{ success: boolean; error?: string }>;
  switchCampus: () => void;
  hasCampus: boolean;
}

const CampusContext = createContext<CampusContextType | undefined>(undefined);

const CAMPUS_CODE_KEY = 'campus_code';
const CAMPUS_DATA_CACHE_KEY = 'campus_data_cache';

const defaultSettings: CampusSettings = {
  payment: {
    provider: 'upi',
    upi_id: null,
    razorpay_key: null,
    razorpay_secret: null,
  },
  printer: {
    paper_width: '58mm',
    bluetooth_name_prefix: 'MTP',
    print_logo: true,
    footer_text: 'Thank you for your order!',
  },
  branding: {
    primary_color: '#10b981',
    secondary_color: '#f59e0b',
  },
  operational: {
    currency: 'INR',
    tax_rate: 0,
    service_charge: 0,
  },
};

// ─── Safe cache helpers ──────────────────────────────────────────────────────
const safeGetCampusCache = (): Campus | null => {
  try {
    const raw = localStorage.getItem(CAMPUS_DATA_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const safeSaveCampusCache = (campus: Campus) => {
  try { localStorage.setItem(CAMPUS_DATA_CACHE_KEY, JSON.stringify(campus)); } catch {}
};

export function CampusProvider({ children }: { children: ReactNode }) {
  // 🛡️ FIX 1: Initialize directly from cache so there's NEVER a blank state
  const [campus, setCampus] = useState<Campus | null>(() => safeGetCampusCache());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampusByCode = useCallback(async (code: string): Promise<Campus | null> => {
    console.log('[Campus] Looking up code:', code.toUpperCase());
    const { data: publicData, error: publicError } = await supabase
      .from('campus_public_info')
      .select('*')
      .eq('code', code.toUpperCase())
      .maybeSingle();

    if (publicError || !publicData) {
      console.error('[Campus] Lookup failed:', publicError?.message || 'Not found');
      return null;
    }

    const { data: fullData } = await supabase
      .from('campuses')
      .select('*')
      .eq('id', publicData.id)
      .single();

    if (fullData) {
      const settings = {
        ...defaultSettings,
        ...(fullData.settings as unknown as Partial<CampusSettings>),
      };
      return { ...fullData, settings } as Campus;
    }

    const publicBranding = publicData.branding as Partial<CampusSettings['branding']> | null;
    const publicOperational = publicData.public_operational_settings as Partial<CampusSettings['operational']> | null;

    const settings: CampusSettings = {
      ...defaultSettings,
      branding: { ...defaultSettings.branding, ...(publicBranding || {}) },
      operational: { ...defaultSettings.operational, ...(publicOperational || {}) },
    };

    return {
      id: publicData.id,
      name: publicData.name,
      code: publicData.code,
      logo_url: publicData.logo_url,
      address: publicData.address,
      is_active: publicData.is_active,
      status: publicData.status,
      settings,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Campus;
  }, []);

  const fetchCampusById = useCallback(async (id: string): Promise<Campus | null> => {
    const { data: fullData } = await supabase
      .from('campuses')
      .select('*')
      .eq('id', id)
      .single();

    if (fullData) {
      const settings = {
        ...defaultSettings,
        ...(fullData.settings as unknown as Partial<CampusSettings>),
      };
      return { ...fullData, settings } as Campus;
    }

    const { data: publicData, error: publicError } = await supabase
      .from('campus_public_info')
      .select('*')
      .eq('id', id)
      .single();

    if (publicError || !publicData) return null;

    const publicBranding = publicData.branding as Partial<CampusSettings['branding']> | null;
    const publicOperational = publicData.public_operational_settings as Partial<CampusSettings['operational']> | null;

    const settings: CampusSettings = {
      ...defaultSettings,
      branding: { ...defaultSettings.branding, ...(publicBranding || {}) },
      operational: { ...defaultSettings.operational, ...(publicOperational || {}) },
    };

    return {
      id: publicData.id,
      name: publicData.name,
      code: publicData.code,
      logo_url: publicData.logo_url,
      address: publicData.address,
      is_active: publicData.is_active,
      status: publicData.status,
      settings,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Campus;
  }, []);

  // Real-time subscription for campus changes
  useEffect(() => {
    if (!campus?.id) return;

    const channel = supabase
      .channel('campus-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campuses',
          filter: `id=eq.${campus.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          const settings = {
            ...defaultSettings,
            ...(updated.settings as unknown as Partial<CampusSettings>),
          };
          const updatedCampus = { ...updated, settings } as Campus;
          setCampus(updatedCampus);
          safeSaveCampusCache(updatedCampus);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [campus?.id]);

  useEffect(() => {
    const initCampus = async () => {
      try {
        // 🛡️ FIX 2: Cache is already loaded in useState initializer above
        // so the UI is never blank. Now try to refresh from network silently.

        // 🛡️ FIX 3: If offline, just use the cache and stop — no network calls
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (isOffline) {
          console.log('[Campus] Offline — using cached campus data.');
          setIsLoading(false);
          return;
        }

        const savedCode = localStorage.getItem(CAMPUS_CODE_KEY);

        if (savedCode) {
          // Refresh from network in background — but DON'T clear campus if it fails
          try {
            const campusData = await fetchCampusByCode(savedCode);
            if (campusData) {
              setCampus(campusData);
              safeSaveCampusCache(campusData);
            }
            // If campusData is null (network error), keep the cached campus — DON'T clear it
          } catch {
            console.warn('[Campus] Background refresh failed — keeping cached campus.');
          }
        } else {
          // No saved code — check if session has campus_id
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const campusId = session?.user?.user_metadata?.campus_id;
            if (typeof campusId === 'string' && campusId) {
              const campusData = await fetchCampusById(campusId);
              if (campusData) {
                setCampus(campusData);
                localStorage.setItem(CAMPUS_CODE_KEY, campusData.code);
                safeSaveCampusCache(campusData);
              }
            }
          } catch {
            console.warn('[Campus] Session campus lookup failed — keeping cached campus.');
          }
        }
      } catch (err) {
        console.error('[Campus] Boot error:', err);
        // 🛡️ FIX 4: Never clear campus on error — cache is the source of truth
      } finally {
        setIsLoading(false);
      }
    };

    initCampus();
  }, [fetchCampusByCode, fetchCampusById]);

  const setCampusByCode = useCallback(async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const campusData = await fetchCampusByCode(code);
      if (!campusData) {
        setError('Campus not found. Please check the code and try again.');
        return { success: false, error: 'Campus not found' };
      }
      setCampus(campusData);
      localStorage.setItem(CAMPUS_CODE_KEY, code.toUpperCase());
      safeSaveCampusCache(campusData);
      return { success: true };
    } catch (err) {
      setError('Failed to fetch campus details');
      return { success: false, error: 'Failed' };
    } finally {
      setIsLoading(false);
    }
  }, [fetchCampusByCode]);

  // Only called from explicit "Switch Campus" button — never called automatically
  const switchCampus = useCallback(() => {
    setCampus(null);
    try {
      localStorage.removeItem(CAMPUS_CODE_KEY);
      localStorage.removeItem(CAMPUS_DATA_CACHE_KEY);
    } catch {}
  }, []);

  return (
    <CampusContext.Provider
      value={{
        campus,
        isLoading,
        error,
        settings: campus?.settings || null,
        setCampusByCode,
        switchCampus,
        hasCampus: !!campus,
      }}
    >
      {children}
    </CampusContext.Provider>
  );
}

export function useCampus() {
  const context = useContext(CampusContext);
  if (!context) throw new Error('useCampus must be used within a CampusProvider');
  return context;
}