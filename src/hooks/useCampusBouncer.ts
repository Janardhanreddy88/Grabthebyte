import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

export function useCampusBouncer() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isInitializing } = useAuth();

  useEffect(() => {
    // 🛡️ FIX 1: Never run while auth is still initializing
    if (isInitializing) return;

    // 🛡️ FIX 2: Never run when offline — offline doesn't mean archived
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.log("🛡️ Bouncer: Offline detected. Skipping campus check — user stays logged in.");
      return;
    }

    // 🛡️ FIX 3: No user = nothing to bounce
    if (!user) return;

    // Super admins are immune
    if (user.role === 'super_admin') return;

    let bouncerChannel: any = null;
    let mounted = true;

    const enforceCampusStatus = async () => {
      try {
        // 🛡️ FIX 4: Use the user from AuthContext (already verified)
        // instead of calling supabase.auth.getSession() again
        const campusId = user.campusId;
        if (!campusId) return;

        // THE KICK-OUT FUNCTION
        const executeKickOut = async () => {
          if (!mounted) return;
          console.warn("🛡️ Bouncer: Campus archived. Executing logout.");

          // Clear caches
          try {
            localStorage.removeItem('campus_code');
            localStorage.removeItem('campus_name');
            localStorage.removeItem('campus_id');
            localStorage.removeItem('selected_campus');
            localStorage.removeItem('gtb_cached_user');
            localStorage.removeItem('selected_campus_id');
            localStorage.removeItem('campus_data_cache');
          } catch {}

          // Sign out from Supabase
          await supabase.auth.signOut().catch(() => {});

          toast({
            title: "Campus Offline",
            description: "This campus is currently inactive or has been archived.",
            variant: "destructive",
            duration: 6000,
          });

          navigate('/');
        };

        // INITIAL STATIC CHECK
        const { data, error: campusError } = await supabase
          .from('campuses')
          .select('status, is_active')
          .eq('id', campusId)
          .single();

        if (!mounted) return;

        // 🛡️ FIX 5: If the DB call itself fails (network error),
        // do NOT kick the user — it's a network issue, not an archive event
        if (campusError) {
          console.warn("🛡️ Bouncer: Campus check failed (network error). User stays logged in.");
          return;
        }

        const campus = data as any;

        if (campus?.status === 'archived' || campus?.is_active === false) {
          await executeKickOut();
          return;
        }

        // REAL-TIME RADAR: Watch for live archive events
        bouncerChannel = supabase
          .channel(`bouncer-${campusId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'campuses',
              filter: `id=eq.${campusId}`,
            },
            async (payload) => {
              const updatedCampus = payload.new as any;
              if (updatedCampus.status === 'archived' || updatedCampus.is_active === false) {
                await executeKickOut();
              }
            }
          )
          .subscribe();

      } catch (error) {
        // 🛡️ FIX 6: Any unexpected error → stay logged in, don't kick
        console.warn("🛡️ Bouncer: Unexpected error during campus check. User stays logged in.", error);
      }
    };

    enforceCampusStatus();

    return () => {
      mounted = false;
      if (bouncerChannel) {
        supabase.removeChannel(bouncerChannel);
      }
    };
  }, [navigate, toast, user, isInitializing]);
}