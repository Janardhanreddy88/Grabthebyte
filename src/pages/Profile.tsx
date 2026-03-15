import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Save, Loader2, Building2 } from 'lucide-react';
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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [campusId, setCampusId] = useState<string | null>(null);
  const [campusCode, setCampusCode] = useState('');

  useEffect(() => {
    const getProfile = async () => {
      try {
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('full_name, email, phone, campus_id').eq('user_id', user.id).maybeSingle();
        const { data: roleData } = await supabase.from('user_roles').select('campus_id').eq('user_id', user.id).maybeSingle();
        const safeUser = user as any;
        setFullName(profile?.full_name || safeUser.user_metadata?.full_name || '');
        setEmail(user.email || '');
        setPhone(profile?.phone || safeUser.user_metadata?.phone || '');
        const fCampusId = profile?.campus_id || roleData?.campus_id || safeUser.user_metadata?.campus_id;
        setCampusId(fCampusId || null);
        if (fCampusId) {
          const { data: cd } = await supabase.from('campus_public_info').select('code, name').eq('id', fCampusId).maybeSingle();
          if (cd) setCampusCode(cd.code || cd.name || 'Unknown');
        }
      } catch {} finally { setLoading(false); }
    };
    getProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    if (!fullName.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (phone && phone.length < 10) { toast({ title: "Invalid Phone", variant: "destructive" }); return; }
    if (!campusId) { toast({ title: "Campus Not Found", description: "Please select your campus.", variant: "destructive" }); navigate('/select-campus'); return; }
    setSaving(true);
    try {
      const { error: dbError } = await supabase.from('profiles').upsert({ user_id: user.id, campus_id: campusId, full_name: fullName.trim(), phone: phone.trim(), updated_at: new Date().toISOString() } as any, { onConflict: 'user_id' });
      if (dbError) throw dbError;
      const { error: authError } = await supabase.auth.updateUser({ data: { full_name: fullName.trim(), phone: phone.trim(), campus_id: campusId } });
      if (authError) throw authError;
      toast({ title: "Profile Updated", description: "Saved successfully." });
    } catch (e: any) { toast({ title: "Update Failed", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const getInitials = (n: string) => n ? n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'U';

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const FieldRow = ({ id, label, icon: Icon, value, onChange, disabled, type = "text", placeholder }: any) => (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input id={id} type={type} placeholder={placeholder} value={value} onChange={onChange} disabled={disabled}
          className={`pl-10 text-sm rounded-xl ${disabled ? 'bg-muted/50 text-muted-foreground cursor-not-allowed' : ''}`} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-3 p-4 max-w-lg mx-auto">
          <button onClick={() => navigate('/menu')} className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><ArrowLeft size={18} /></button>
          <h1 className="text-base font-bold">Edit Profile</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        <div className="flex flex-col items-center py-6">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold mb-3">{getInitials(fullName)}</div>
          <p className="text-xs text-muted-foreground">Your profile</p>
        </div>

        <div className="space-y-4">
          <FieldRow id="fullName" label="Full Name" icon={User} placeholder="Enter your name" value={fullName} onChange={(e: any) => setFullName(e.target.value)} />
          <FieldRow id="campus" label="Campus" icon={Building2} value={campusCode} disabled />
          <FieldRow id="email" label="Email" icon={Mail} type="email" value={email} disabled />
          <FieldRow id="phone" label="Phone Number" icon={Phone} type="tel" placeholder="10-digit number" value={phone} onChange={(e: any) => setPhone(e.target.value)} />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full font-bold rounded-xl gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </Button>
      </main>
    </div>
  );
}
