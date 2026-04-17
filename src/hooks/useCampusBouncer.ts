import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function useCampusBouncer() {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let bouncerChannel: any = null;

    const enforceCampusStatus = async () => {
      try {
        // 1. Check if someone is currently logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        // 🌟 2. VIP BYPASS: Check if the user is a Super Admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        // If they are the CEO (super_admin), they are immune. Let them stay.
        if (roleData?.role === 'super_admin') {
          return; 
        }

        // 3. For everyone else, find out which campus they belong to
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('campus_id')
          .eq('user_id', session.user.id)
          .single();

        if (profileError || !profile?.campus_id) return;

        // 🌟 THE KICK-OUT FUNCTION (Defined once to use statically and real-time)
        const executeKickOut = async () => {
          console.warn("🛡️ Security Bouncer: Campus is offline. Forcing logout.");
          
          // Destroy the session in the backend
          await supabase.auth.signOut();
          
          // Wipe the browser memory completely
          localStorage.removeItem('campus_code'); 
          localStorage.removeItem('campus_name'); 
          localStorage.removeItem('campus_id'); 
          localStorage.removeItem('selected_campus'); 

          // Show the error message to the user
          toast({
            title: "Campus Offline",
            description: "This campus is currently inactive or has been archived.",
            variant: "destructive",
            duration: 6000,
          });
          
          // Redirect to the Select Campus screen
          navigate('/'); 
        };

        // 4. INITIAL STATIC CHECK: When they first load the page
        const { data, error: campusError } = await supabase
          .from('campuses')
          .select('status, is_active')
          .eq('id', profile.campus_id)
          .single();

        if (campusError) {
          console.error("Failed to fetch campus status:", campusError);
          return;
        }

        const campus = data as any; 

        // If ALREADY archived, kick them out!
        if (campus?.status === 'archived' || campus?.is_active === false) {
          await executeKickOut();
          return; // Stop running the rest of the script
        }

        // 🌟 5. REAL-TIME RADAR: Watch the database LIVE
        bouncerChannel = supabase
          .channel(`bouncer-${profile.campus_id}`)
          .on(
            'postgres_changes',
            { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'campuses', 
              filter: `id=eq.${profile.campus_id}` 
            },
            async (payload) => {
              const updatedCampus = payload.new as any;
              
              // If the Super Admin archives it while the student is looking at the app:
              if (updatedCampus.status === 'archived' || updatedCampus.is_active === false) {
                await executeKickOut();
              }
            }
          )
          .subscribe();

      } catch (error) {
        console.error("Bouncer check failed:", error);
      }
    };

    enforceCampusStatus();

    // 🌟 CLEANUP: Turn off the radar if the user navigates away safely
    return () => {
      if (bouncerChannel) {
        supabase.removeChannel(bouncerChannel);
      }
    };
  }, [navigate, toast]);
}