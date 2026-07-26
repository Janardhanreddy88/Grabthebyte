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

export function CampusProvider({ children }: { children: ReactNode }) {
  const [campus, setCampus] = useState<Campus | null>(null);
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
      console.error('[Campus] Lookup failed:', publicError?.message || 'Not found', publicError);
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
      return {
        ...fullData,
        settings,
      } as Campus;
    }

    const publicBranding = publicData.branding as Partial<CampusSettings['branding']> | null;
    const publicOperational = publicData.public_operational_settings as Partial<CampusSettings['operational']> | null;

    const settings: CampusSettings = {
      ...defaultSettings,
      branding: {
        ...defaultSettings.branding,
        ...(publicBranding || {}),
      },
      operational: {
        ...defaultSettings.operational,
        ...(publicOperational || {}),
      },
    };

    return {
      id: publicData.id,
      name: publicData.name,
      code: publicData.code,
      logo_url: publicData.logo_url,
      address: publicData.address,
      is_active: publicData.is_active,
      status: publicData.status, // 🚀 FIX 2: Added status so the bouncer can read it
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
      // 🚀 FIX 3: Removed .eq('is_active', true) so we intentionally fetch archived campuses to kick them!
      .single();

    if (fullData) {
      const settings = {
        ...defaultSettings,
        ...(fullData.settings as unknown as Partial<CampusSettings>),
      };
      return {
        ...fullData,
        settings,
      } as Campus;
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
      branding: {
        ...defaultSettings.branding,
        ...(publicBranding || {}),
      },
      operational: {
        ...defaultSettings.operational,
        ...(publicOperational || {}),
      },
    };

    return {
      id: publicData.id,
      name: publicData.name,
      code: publicData.code,
      logo_url: publicData.logo_url,
      address: publicData.address,
      is_active: publicData.is_active,
      status: publicData.status, // 🚀 FIX 2: Added status here too
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
          setCampus({
            ...updated,
            settings,
          } as Campus);
          localStorage.setItem(CAMPUS_DATA_CACHE_KEY, JSON.stringify({ ...updated, settings }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campus?.id]);

  useEffect(() => {
    const initCampus = async () => {
      try {
        const savedCode = localStorage.getItem(CAMPUS_CODE_KEY);
        
        // 🚀 FIX 1: We load the cache to show UI instantly, but we DON'T stop. 
        // We let the code continue down to fetch the live data in the background to ensure it wasn't archived!
        const cachedData = localStorage.getItem(CAMPUS_DATA_CACHE_KEY);
        if (cachedData) {
          try {
            const parsedCampus = JSON.parse(cachedData);
            setCampus(parsedCampus);
          } catch (e) { console.error("Cache parse failed"); }
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setIsLoading(false);
          return;
        }

        if (savedCode) {
          const campusData = await fetchCampusByCode(savedCode);
          if (campusData) {
            setCampus(campusData);
            localStorage.setItem(CAMPUS_DATA_CACHE_KEY, JSON.stringify(campusData)); 
          }
        } else {
          // If no code, check session
          const { data: { session } } = await supabase.auth.getSession();
          const campusId = session?.user?.user_metadata?.campus_id;
          if (typeof campusId === 'string' && campusId) {
            const campusData = await fetchCampusById(campusId);
            if (campusData) {
              setCampus(campusData);
              localStorage.setItem(CAMPUS_CODE_KEY, campusData.code);
              localStorage.setItem(CAMPUS_DATA_CACHE_KEY, JSON.stringify(campusData));
            }
          }
        }
      } catch (err) {
        console.error("Boot error:", err);
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
      localStorage.setItem(CAMPUS_DATA_CACHE_KEY, JSON.stringify(campusData)); 
      return { success: true };
    } catch (err) {
      setError('Failed to fetch campus details');
      return { success: false, error: 'Failed' };
    } finally {
      setIsLoading(false);
    }
  }, [fetchCampusByCode]);

  const switchCampus = useCallback(() => {
    setCampus(null);
    localStorage.removeItem(CAMPUS_CODE_KEY);
    localStorage.removeItem(CAMPUS_DATA_CACHE_KEY); 
  }, []);

  return (
    <CampusContext.Provider value={{ campus, isLoading, error, settings: campus?.settings || null, setCampusByCode, switchCampus, hasCampus: !!campus }}>
      {children}
    </CampusContext.Provider>
  );
}

export function useCampus() {
  const context = useContext(CampusContext);
  if (!context) throw new Error('useCampus must be used within a CampusProvider');
  return context;
}