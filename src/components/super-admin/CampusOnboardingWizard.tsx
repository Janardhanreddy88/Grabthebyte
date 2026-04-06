import { useState } from 'react';
import { 
  Building2,
  ArrowRight,
  ArrowLeft,
  Check,
  User,
  CreditCard,
  UserPlus,
  Loader2,
  Mail,
  Lock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CampusOnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const STEPS = ['Basic Info', 'Payment', 'First Admin'];

export function CampusOnboardingWizard({ open, onOpenChange, onSuccess }: CampusOnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newCampusId, setNewCampusId] = useState<string | null>(null);

  const [campusForm, setCampusForm] = useState({
    name: '', code: '', address: '', is_active: true,
    owner_name: '', owner_email: '', owner_phone: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    upi_id: '', bank_account_name: '', bank_account_number: '',
    bank_ifsc: '', commission_rate: 10,
  });

  const [adminForm, setAdminForm] = useState({
    email: '', password: '', full_name: '', skip: false,
  });

  const handleCreateCampus = async () => {
    if (!campusForm.name.trim() || !campusForm.code.trim()) {
      toast.error('Campus name and code are required');
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('campuses').insert({
        name: campusForm.name.trim(),
        code: campusForm.code.trim().toUpperCase(),
        address: campusForm.address.trim() || null,
        is_active: campusForm.is_active,
        owner_name: campusForm.owner_name.trim() || null,
        owner_email: campusForm.owner_email.trim() || null,
        owner_phone: campusForm.owner_phone.trim() || null,
        upi_id: paymentForm.upi_id.trim() || null,
        bank_account_name: paymentForm.bank_account_name.trim() || null,
        bank_account_number: paymentForm.bank_account_number.trim() || null,
        bank_ifsc: paymentForm.bank_ifsc.trim() || null,
        commission_rate: paymentForm.commission_rate,
      }).select('id').single();

      if (error) throw error;
      setNewCampusId(data.id);
      toast.success('Campus created!');
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create campus');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (adminForm.skip || !newCampusId) {
      finish();
      return;
    }
    if (!adminForm.email || !adminForm.password) {
      toast.error('Email and password are required');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'create',
          email: adminForm.email,
          password: adminForm.password,
          full_name: adminForm.full_name,
          role: 'admin',
          campus_id: newCampusId,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);

      toast.success('Admin account created!');
      finish();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create admin');
    } finally {
      setIsSubmitting(false);
    }
  };

  const finish = () => {
    setStep(0);
    setCampusForm({ name: '', code: '', address: '', is_active: true, owner_name: '', owner_email: '', owner_phone: '' });
    setPaymentForm({ upi_id: '', bank_account_name: '', bank_account_number: '', bank_ifsc: '', commission_rate: 10 });
    setAdminForm({ email: '', password: '', full_name: '', skip: false });
    setNewCampusId(null);
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Campus Onboarding
          </DialogTitle>
          <DialogDescription>Step-by-step campus setup wizard</DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors",
                i < step ? "bg-primary text-primary-foreground border-primary" :
                i === step ? "border-primary text-primary" :
                "border-muted text-muted-foreground"
              )}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={cn("flex-1 h-0.5", i < step ? "bg-primary" : "bg-muted")} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground -mt-1 px-1">
          {STEPS.map(s => <span key={s}>{s}</span>)}
        </div>

        <Separator />

        {/* Step 1: Basic Info */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Campus Name *</Label>
                <Input placeholder="e.g., CMRTC Main Campus" value={campusForm.name}
                  onChange={(e) => setCampusForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input placeholder="e.g., CMRTC01" value={campusForm.code}
                  onChange={(e) => setCampusForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input placeholder="Full address" value={campusForm.address}
                onChange={(e) => setCampusForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Owner Name</Label>
                <Input placeholder="Canteen owner" value={campusForm.owner_name}
                  onChange={(e) => setCampusForm(p => ({ ...p, owner_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Owner Phone</Label>
                <Input placeholder="+91 9876543210" value={campusForm.owner_phone}
                  onChange={(e) => setCampusForm(p => ({ ...p, owner_phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Owner Email</Label>
              <Input type="email" placeholder="owner@example.com" value={campusForm.owner_email}
                onChange={(e) => setCampusForm(p => ({ ...p, owner_email: e.target.value }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={campusForm.is_active}
                onCheckedChange={(c) => setCampusForm(p => ({ ...p, is_active: c }))} />
              <Label>Active at launch</Label>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => { if (!campusForm.name || !campusForm.code) { toast.error('Name and code required'); return; } setStep(1); }}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Payment */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>UPI ID</Label>
              <Input placeholder="name@upi" value={paymentForm.upi_id}
                onChange={(e) => setPaymentForm(p => ({ ...p, upi_id: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Account Name</Label>
                <Input placeholder="Name on account" value={paymentForm.bank_account_name}
                  onChange={(e) => setPaymentForm(p => ({ ...p, bank_account_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input placeholder="Account number" value={paymentForm.bank_account_number}
                  onChange={(e) => setPaymentForm(p => ({ ...p, bank_account_number: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>IFSC</Label>
                <Input placeholder="IFSC code" value={paymentForm.bank_ifsc}
                  onChange={(e) => setPaymentForm(p => ({ ...p, bank_ifsc: e.target.value.toUpperCase() }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Commission Rate (%)</Label>
              <Input type="number" min="0" max="100" value={paymentForm.commission_rate}
                onChange={(e) => setPaymentForm(p => ({ ...p, commission_rate: Number(e.target.value) }))} />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleCreateCampus} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Campus & Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: First Admin */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-700 dark:text-green-400">
              ✅ Campus "{campusForm.name}" created successfully!
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={adminForm.skip}
                onCheckedChange={(c) => setAdminForm(p => ({ ...p, skip: c }))} />
              <Label>Skip admin creation (do it later)</Label>
            </div>
            {!adminForm.skip && (
              <>
                <div className="space-y-2">
                  <Label>Admin Name</Label>
                  <Input placeholder="Admin name" value={adminForm.full_name}
                    onChange={(e) => setAdminForm(p => ({ ...p, full_name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Admin Email *</Label>
                  <Input type="email" placeholder="admin@example.com" value={adminForm.email}
                    onChange={(e) => setAdminForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Password *</Label>
                  <Input type="password" placeholder="Min 6 characters" value={adminForm.password}
                    onChange={(e) => setAdminForm(p => ({ ...p, password: e.target.value }))} />
                </div>
              </>
            )}
            <div className="flex justify-end">
              <Button onClick={handleCreateAdmin} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {adminForm.skip ? 'Finish' : 'Create Admin & Finish'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
