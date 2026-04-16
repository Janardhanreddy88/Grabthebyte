import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Edit, Trash2, RefreshCw, Search,
  MapPin, Phone, Mail, User, CreditCard, Sparkles, Download, ShieldCheck
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { Campus } from '@/types/superAdmin';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CampusOnboardingWizard } from '@/components/super-admin/CampusOnboardingWizard';

export function CampusManagement() {
  const { refreshData } = useSuperAdmin();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  
  // Campus Dialog
  const [showCampusDialog, setShowCampusDialog] = useState(false);
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
  
  // 🌟 ADDED razorpay_account_id TO STATE
  const [campusForm, setCampusForm] = useState({
    name: '',
    code: '',
    address: '',
    is_active: true,
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    upi_id: '',
    bank_account_name: '',
    bank_account_number: '',
    bank_ifsc: '',
    razorpay_account_id: '', 
  });

  // Delete Dialog
  const [deleteTarget, setDeleteTarget] = useState<Campus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchCampuses = useCallback(async () => {
    setIsLoading(true);
    
    // Explicitly fetching razorpay_account_id just in case
    const { data, error } = await supabase
      .from('campuses')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching campuses:', error);
      toast.error('Failed to load campuses');
    } else {
      setCampuses((data || []) as Campus[]);
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchCampuses();
  }, [fetchCampuses]);

  // CFO Export Engine (CSV Download)
  const exportToCSV = () => {
    if (campuses.length === 0) {
      toast.error("No campuses to export!");
      return;
    }

    // 🌟 ADDED RAZORPAY ID TO EXPORT HEADERS
    const headers = ['Campus Name', 'Code', 'Status', 'Owner', 'Phone', 'Razorpay Linked Account', 'UPI ID', 'A/C Name', 'A/C Number', 'IFSC'];
    
    const rows = campuses.map((c: any) => [
      `"${c.name}"`, 
      c.code, 
      c.is_active ? 'Active' : 'Archived',
      `"${c.owner_name || ''}"`, 
      c.owner_phone || '', 
      c.razorpay_account_id || 'Not Linked', // 🌟 ADDED RAZORPAY ID
      c.upi_id || '',
      `"${c.bank_account_name || ''}"`, 
      c.bank_account_number || '', 
      c.bank_ifsc || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `GrabTheByte_Campuses_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast.success("CSV Exported! Give this to your accountant. 📈");
  };

  const copyPayoutDetails = (campus: any) => {
    let text = `Payout Details for ${campus.name}:\n`;
    if (campus.razorpay_account_id) text += `Razorpay Account: ${campus.razorpay_account_id}\n`;
    if (campus.upi_id) text += `UPI: ${campus.upi_id}\n`;
    if (campus.bank_account_number) text += `A/C Name: ${campus.bank_account_name || 'N/A'}\nA/C: ${campus.bank_account_number}\nIFSC: ${campus.bank_ifsc}`;
    
    if (!campus.upi_id && !campus.bank_account_number && !campus.razorpay_account_id) {
      toast.error("No bank details saved for this campus!");
      return;
    }
    
    navigator.clipboard.writeText(text);
    toast.success("Bank details copied to clipboard! 📋");
  };

  const handleSaveCampus = async () => {
    if (!campusForm.name.trim() || !campusForm.code.trim()) {
      toast.error('Campus Name and Code are strictly required.');
      return;
    }

    if (campusForm.bank_ifsc.trim()) {
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscRegex.test(campusForm.bank_ifsc.trim().toUpperCase())) {
        toast.error('Invalid IFSC Code. Please check the format (e.g., SBIN0001234).');
        return;
      }
    }

    if (campusForm.upi_id.trim() && !campusForm.upi_id.includes('@')) {
      toast.error('Invalid UPI ID format. Must contain @ (e.g., name@okbank).');
      return;
    }

    if (campusForm.owner_phone.trim() && campusForm.owner_phone.replace(/\D/g,'').length < 10) {
      toast.error('Phone number must be at least 10 digits.');
      return;
    }

    setIsProcessing(true);

    try {
      // 🌟 ADDED RAZORPAY ID & CAST AS ANY TO BYPASS STRICT TS CHECKS
      const data: any = {
        name: campusForm.name.trim(),
        code: campusForm.code.trim().toUpperCase(),
        address: campusForm.address.trim() || null,
        is_active: campusForm.is_active,
        owner_name: campusForm.owner_name.trim() || null,
        owner_email: campusForm.owner_email.trim() || null,
        owner_phone: campusForm.owner_phone.trim() || null,
        upi_id: campusForm.upi_id.trim() || null,
        bank_account_name: campusForm.bank_account_name.trim() || null,
        bank_account_number: campusForm.bank_account_number.trim() || null,
        bank_ifsc: campusForm.bank_ifsc.trim().toUpperCase() || null,
        razorpay_account_id: campusForm.razorpay_account_id.trim() || null, // 🌟 NEW FIELD
        commission_rate: 0, 
      };

      if (editingCampus) {
        const { error } = await supabase.from('campuses').update(data).eq('id', editingCampus.id);
        if (error) throw error;
        toast.success('Campus updated successfully');
      } else {
        const { error } = await supabase.from('campuses').insert(data);
        if (error) throw error;
        toast.success('Campus created successfully');
      }

      fetchCampuses();
      refreshData();
      setShowCampusDialog(false);
      resetCampusForm();
    } catch (err: any) {
      console.error('Error saving campus:', err);
      if (err.code === '23505') {
        toast.error(`A campus with the code ${campusForm.code} already exists!`);
      } else {
        toast.error(err.message || 'Failed to save campus details.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);

    try {
      const { error } = await supabase
        .from('campuses')
        .update({ 
          is_active: false, 
          name: `[ARCHIVED] ${deleteTarget.name}` 
        })
        .eq('id', deleteTarget.id);

      if (error) throw error;

      toast.success('Campus archived safely. Financial history preserved.');
      fetchCampuses();
      refreshData();
    } catch (err: any) {
      console.error('Error archiving:', err);
      toast.error(err.message || 'Failed to archive campus');
    } finally {
      setIsProcessing(false);
      setDeleteTarget(null);
    }
  };

  const resetCampusForm = () => {
    setCampusForm({
      name: '',
      code: '',
      address: '',
      is_active: true,
      owner_name: '',
      owner_email: '',
      owner_phone: '',
      upi_id: '',
      bank_account_name: '',
      bank_account_number: '',
      bank_ifsc: '',
      razorpay_account_id: '', // 🌟 RESET NEW FIELD
    });
    setEditingCampus(null);
  };

  const openEditCampus = (campus: any) => {
    setCampusForm({
      name: campus.name,
      code: campus.code,
      address: campus.address || '',
      is_active: campus.is_active,
      owner_name: campus.owner_name || '',
      owner_email: campus.owner_email || '',
      owner_phone: campus.owner_phone || '',
      upi_id: campus.upi_id || '',
      bank_account_name: campus.bank_account_name || '',
      bank_account_number: campus.bank_account_number || '',
      bank_ifsc: campus.bank_ifsc || '',
      razorpay_account_id: campus.razorpay_account_id || '', // 🌟 LOAD NEW FIELD
    });
    setEditingCampus(campus);
    setShowCampusDialog(true);
  };

  const filteredCampuses = campuses.filter(campus => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      campus.name.toLowerCase().includes(search) ||
      campus.code.toLowerCase().includes(search) ||
      campus.owner_name?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campus Management</h1>
          <p className="text-muted-foreground">
            Manage your campuses and their settings
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => { fetchCampuses(); refreshData(); }} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" onClick={exportToCSV} className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200">
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Button variant="outline" onClick={() => setShowWizard(true)}>
            <Sparkles className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Onboard Campus</span>
          </Button>
          <Button onClick={() => { resetCampusForm(); setShowCampusDialog(true); }}>
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Quick Add</span>
          </Button>
        </div>
      </div>

      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search campuses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCampuses.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No Campuses Found</h3>
            <p className="text-muted-foreground">Add your first campus to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCampuses.map((campus: any) => (
            <Card key={campus.id} className="hover:shadow-md transition-shadow flex flex-col">
              <CardContent className="p-4 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{campus.name}</h3>
                    <Badge variant="outline" className="mt-1">{campus.code}</Badge>
                  </div>
                  <Badge variant={campus.is_active ? 'default' : 'secondary'}>
                    {campus.is_active ? 'Active' : 'Archived'}
                  </Badge>
                </div>
                
                <div className="space-y-3 mb-6 flex-1">
                  {campus.address && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{campus.address}</span>
                    </div>
                  )}
                  
                  {campus.owner_name && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{campus.owner_name}</span>
                    </div>
                  )}
                  
                  {campus.owner_phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{campus.owner_phone}</span>
                    </div>
                  )}

                  {/* 🌟 NEW: DISPLAY RAZORPAY ID ON CARD IF LINKED */}
                  {campus.razorpay_account_id && (
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded mt-2">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Linked: {campus.razorpay_account_id}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100 mt-auto">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={() => copyPayoutDetails(campus)} 
                    title="Copy Bank Details"
                  >
                    <CreditCard className="h-4 w-4 mr-1" /> Copy Bank
                  </Button>
                  
                  <div className="flex-1"></div>
                  
                  <Button variant="outline" size="sm" onClick={() => openEditCampus(campus)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteTarget(campus)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Campus Dialog */}
      <Dialog open={showCampusDialog} onOpenChange={setShowCampusDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCampus ? 'Edit Campus' : 'Add New Campus'}</DialogTitle>
            <DialogDescription>
              {editingCampus 
                ? 'Update campus details including owner and payment information.' 
                : 'Create a new campus with owner and payment details.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Basic Information
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Campus Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., CMRTC Main Campus"
                    value={campusForm.name}
                    onChange={(e) => setCampusForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Campus Code *</Label>
                  <Input
                    id="code"
                    placeholder="e.g., CMRTC01"
                    value={campusForm.code}
                    onChange={(e) => setCampusForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  />
                  <p className="text-xs text-muted-foreground">Must be unique (e.g., CMRTC01)</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="Full address"
                  value={campusForm.address}
                  onChange={(e) => setCampusForm(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <Switch
                  id="is_active"
                  checked={campusForm.is_active}
                  onCheckedChange={(checked) => setCampusForm(prev => ({ ...prev, is_active: checked }))}
                />
                <Label htmlFor="is_active">Active Campus</Label>
              </div>
            </div>

            <Separator />

            {/* Owner Details */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Owner Details
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="owner_name">Owner Name</Label>
                  <Input
                    id="owner_name"
                    placeholder="Full name"
                    value={campusForm.owner_name}
                    onChange={(e) => setCampusForm(prev => ({ ...prev, owner_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner_phone">Phone</Label>
                  <Input
                    id="owner_phone"
                    placeholder="+91 9876543210"
                    value={campusForm.owner_phone}
                    onChange={(e) => setCampusForm(prev => ({ ...prev, owner_phone: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="owner_email">Email</Label>
                <Input
                  id="owner_email"
                  type="email"
                  placeholder="owner@example.com"
                  value={campusForm.owner_email}
                  onChange={(e) => setCampusForm(prev => ({ ...prev, owner_email: e.target.value }))}
                />
              </div>
            </div>

            <Separator />

            {/* Payment Details */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payment Details
              </h4>
              <div className="space-y-4">
                
                {/* 🌟 NEW: RAZORPAY ACCOUNT ID FIELD */}
                <div className="space-y-2 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                  <Label htmlFor="razorpay_account_id" className="flex items-center gap-2 text-emerald-800">
                    <ShieldCheck className="h-4 w-4" />
                    Razorpay Linked Account ID
                  </Label>
                  <Input
                    id="razorpay_account_id"
                    placeholder="e.g. acc_XYZ12345"
                    className="border-emerald-200"
                    value={campusForm.razorpay_account_id}
                    onChange={(e) => setCampusForm(prev => ({ ...prev, razorpay_account_id: e.target.value }))}
                  />
                  <p className="text-xs text-emerald-600/80">Required for automated T+2 payouts via Razorpay Route.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="upi_id">Legacy UPI ID</Label>
                  <Input
                    id="upi_id"
                    placeholder="name@upi"
                    value={campusForm.upi_id}
                    onChange={(e) => setCampusForm(prev => ({ ...prev, upi_id: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bank_account_name">Account Name</Label>
                    <Input
                      id="bank_account_name"
                      placeholder="Name on account"
                      value={campusForm.bank_account_name}
                      onChange={(e) => setCampusForm(prev => ({ ...prev, bank_account_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_account_number">Account Number</Label>
                    <Input
                      id="bank_account_number"
                      placeholder="Account number"
                      value={campusForm.bank_account_number}
                      onChange={(e) => setCampusForm(prev => ({ ...prev, bank_account_number: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bank_ifsc">IFSC Code</Label>
                    <Input
                      id="bank_ifsc"
                      placeholder="e.g. SBIN0001234"
                      value={campusForm.bank_ifsc}
                      onChange={(e) => setCampusForm(prev => ({ ...prev, bank_ifsc: e.target.value.toUpperCase() }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampusDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCampus} disabled={isProcessing}>
              {isProcessing ? 'Saving...' : (editingCampus ? 'Update Campus' : 'Create Campus')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Campus</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive <strong>{deleteTarget?.name}</strong>? 
              This will disable the campus and hide it from new students. For accounting safety, the campus data is archived, not permanently deleted, preserving your historical financial ledgers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isProcessing}
            >
              {isProcessing ? 'Archiving...' : 'Archive Campus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Campus Onboarding Wizard */}
      <CampusOnboardingWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onSuccess={() => { fetchCampuses(); refreshData(); }}
      />
    </div>
  );
}