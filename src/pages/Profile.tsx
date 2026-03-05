import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Save, Loader2, Camera, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

export default function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth(); 

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form States
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [campusId, setCampusId] = useState<string | null>(null);
  const [campusCode, setCampusCode] = useState(''); // New State for displaying code

  // 1. Fetch Profile Data on Load
  useEffect(() => {
    const getProfile = async () => {
      try {
        if (!user) return;

        // A. Get Data from "profiles" table
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, phone, campus_id') 
          .eq('user_id', user.id)
          .maybeSingle();

        // B. Get Data from "user_roles" (Backup Source)
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('campus_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const safeUser = user as any; 
        
        // Populate User Details
        setFullName(profile?.full_name || safeUser.user_metadata?.full_name || '');
        setEmail(user.email || ''); 
        setPhone(profile?.phone || safeUser.user_metadata?.phone || ''); 
        
        // C. Find the Campus ID
        const foundCampusId = profile?.campus_id || roleData?.campus_id || safeUser.user_metadata?.campus_id;
        setCampusId(foundCampusId || null);

        // D. Fetch Campus Code (Display Name)
        if (foundCampusId) {
            const { data: campusData } = await supabase
                .from('campuses')
                .select('code, name') // We fetch code (e.g., CMRTC)
                .eq('id', foundCampusId)
                .maybeSingle();
            
            if (campusData) {
                setCampusCode(campusData.code || campusData.name || 'Unknown');
            }
        }

      } catch {
        // Profile loading error - fields will show defaults
      } finally {
        setLoading(false);
      }
    };

    getProfile();
  }, [user]);

  // 2. Handle Save Changes
  const handleSave = async () => {
    if (!user) return;
    
    // Validation
    if (!fullName.trim()) {
        toast({ title: "Name required", description: "Please enter your full name", variant: "destructive" });
        return;
    }
    if (phone && phone.length < 10) {
        toast({ title: "Invalid Phone", description: "Please enter a valid phone number", variant: "destructive" });
        return;
    }
    
    // 🛑 ORPHAN ACCOUNT FIX
    if (!campusId) {
        toast({ 
            title: "Campus Not Found", 
            description: "Please select your campus again to fix your account.", 
            variant: "destructive" 
        });
        navigate('/select-campus');
        return;
    }

    setSaving(true);

    try {
      const updates = {
        user_id: user.id,      // The Unique Key
        campus_id: campusId,    
        full_name: fullName.trim(),
        phone: phone.trim(),
        updated_at: new Date().toISOString(),
      };

       

      // Step A: Update the Public 'profiles' table
      const { error: dbError } = await supabase
        .from('profiles')
        .upsert(updates as any, { onConflict: 'user_id' });

      if (dbError) throw dbError;

      // Step B: Update Supabase Auth Metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { 
          full_name: fullName.trim(),
          phone: phone.trim(),
          campus_id: campusId 
        }
      });

      if (authError) throw authError;

      toast({
        title: "Profile Updated",
        description: "Your details have been saved successfully.",
      });

    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center gap-4 p-4 max-w-lg mx-auto">
          <button
            onClick={() => navigate('/menu')}
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold">Edit Profile</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        <div className="flex flex-col items-center py-6">
          <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-3xl font-bold mb-4 relative overflow-hidden">
            {getInitials(fullName)}
            <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                <Camera className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Your profile photo</p>
        </div>

        <div className="space-y-4">
          
          {/* 1. Full Name */}
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="fullName"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-12 pl-11 text-base rounded-xl"
              />
            </div>
          </div>

          {/* 2. Campus Code (Read-Only) - ADDED HERE */}
          <div className="space-y-2">
            <Label htmlFor="campus" className="text-sm font-medium">Campus</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="campus"
                type="text"
                value={campusCode}
                disabled
                className="h-12 pl-11 text-base rounded-xl bg-muted/50 text-muted-foreground cursor-not-allowed font-medium"
              />
            </div>
          </div>

          {/* 3. Email (Read-Only) */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                disabled
                className="h-12 pl-11 text-base rounded-xl bg-muted/50 text-muted-foreground cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted-foreground">Contact support to change email</p>
          </div>

          {/* 4. Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="Enter your 10-digit phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 pl-11 text-base rounded-xl"
              />
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full h-12 text-base font-bold rounded-xl gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </main>
    </div>
  );
}