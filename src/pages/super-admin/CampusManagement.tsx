import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Edit, Trash2, RefreshCw, Search,
  MapPin, Phone, Mail, User, CreditCard, Sparkles, Download, ShieldCheck, ArchiveRestore, Archive
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { Campus } from '@/types/superAdmin';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CampusOnboardingWizard } from '@/components/super-admin/CampusOnboardingWizard';

export function CampusManagement() {
  const { refreshData } = useSuperAdmin();
  const [campuses, setCampuses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  
  // Campus Dialog
  const [showCampusDialog, setShowCampusDialog] = useState(false);
  const [editingCampus, setEditingCampus] = useState<any | null>(null);
  
  const [campusForm, setCampusForm] = useState({
    name: '', code: '', address: '', is_active: true, owner_name: '', owner_email: '', owner_phone: '',
    upi_id: '', bank_account_name: '', bank_account_number: '', bank_ifsc: '', razorpay_account_id: '', 
  });

  // Action Dialogs
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchCampuses = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('campuses').select('*').order('name');
    if (error) toast.error('Failed to load campuses');
    else setCampuses(data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchCampuses(); }, [fetchCampuses]);

  const exportToCSV = () => {
    if (campuses.length === 0) return toast.error("No campuses to export!");
    const headers = ['Campus Name', 'Code', 'Status', 'Owner', 'Phone', 'Razorpay ID', 'UPI ID', 'A/C Name', 'A/C Number', 'IFSC'];
    const rows = campuses.map((c: any) => [
      `"${c.name}"`, c.code, c.status === 'archived' ? 'Archived' : (c.is_active ? 'Active' : 'Inactive'),
      `"${c.owner_name || ''}"`, c.owner_phone || '', c.razorpay_account_id || 'Not Linked',
      c.upi_id || '', `"${c.bank_account_name || ''}"`, c.bank_account_number || '', c.bank_ifsc || ''
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Campuses_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success("CSV Exported! 📈");
  };

  const copyPayoutDetails = (campus: any) => {
    let text = `Payout Details for ${campus.name}:\n`;
    if (campus.razorpay_account_id) text += `Razorpay Account: ${campus.razorpay_account_id}\n`;
    if (campus.upi_id) text += `UPI: ${campus.upi_id}\n`;
    if (campus.bank_account_number) text += `A/C Name: ${campus.bank_account_name || 'N/A'}\nA/C: ${campus.bank_account_number}\nIFSC: ${campus.bank_ifsc}`;
    if (!campus.upi_id && !campus.bank_account_number && !campus.razorpay_account_id) return toast.error("No bank details saved!");
    navigator.clipboard.writeText(text);
    toast.success("Bank details copied! 📋");
  };

  const handleSaveCampus = async () => {
    if (!campusForm.name.trim() || !campusForm.code.trim()) return toast.error('Campus Name and Code are required.');
    setIsProcessing(true);
    try {
      const data: any = {
        name: campusForm.name.trim(), code: campusForm.code.trim().toUpperCase(),
        address: campusForm.address.trim() || null, is_active: campusForm.is_active,
        owner_name: campusForm.owner_name.trim() || null, owner_email: campusForm.owner_email.trim() || null, owner_phone: campusForm.owner_phone.trim() || null,
        upi_id: campusForm.upi_id.trim() || null, bank_account_name: campusForm.bank_account_name.trim() || null,
        bank_account_number: campusForm.bank_account_number.trim() || null, bank_ifsc: campusForm.bank_ifsc.trim().toUpperCase() || null,
        razorpay_account_id: campusForm.razorpay_account_id.trim() || null, commission_rate: 0, status: 'active'
      };

      if (editingCampus) {
        const { error } = await supabase.from('campuses').update(data).eq('id', editingCampus.id);
        if (error) throw error;
        toast.success('Campus updated');
      } else {
        const { error } = await supabase.from('campuses').insert(data);
        if (error) throw error;
        toast.success('Campus created');
      }
      fetchCampuses(); refreshData(); setShowCampusDialog(false); resetCampusForm();
    } catch (err: any) {
      if (err.code === '23505') toast.error(`Code ${campusForm.code} already exists!`);
      else toast.error(err.message || 'Failed to save campus.');
    } finally { setIsProcessing(false); }
  };

  // 🌟 NEW: ARCHIVE LOGIC
  const handleArchive = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('campuses').update({ is_active: false, status: 'archived' }).eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Campus sent to Archived Vault.');
      fetchCampuses(); refreshData();
    } catch (err: any) { toast.error(err.message || 'Failed to archive campus'); } 
    finally { setIsProcessing(false); setDeleteTarget(null); }
  };

  // 🌟 NEW: RESTORE LOGIC
  const handleRestore = async () => {
    if (!restoreTarget) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('campuses').update({ is_active: true, status: 'active' }).eq('id', restoreTarget.id);
      if (error) throw error;
      toast.success('Campus restored successfully.');
      fetchCampuses(); refreshData();
    } catch (err: any) { toast.error(err.message || 'Failed to restore campus'); } 
    finally { setIsProcessing(false); setRestoreTarget(null); }
  };

  const resetCampusForm = () => {
    setCampusForm({ name: '', code: '', address: '', is_active: true, owner_name: '', owner_email: '', owner_phone: '', upi_id: '', bank_account_name: '', bank_account_number: '', bank_ifsc: '', razorpay_account_id: '' });
    setEditingCampus(null);
  };

  const openEditCampus = (campus: any) => {
    setCampusForm({
      name: campus.name, code: campus.code, address: campus.address || '', is_active: campus.is_active,
      owner_name: campus.owner_name || '', owner_email: campus.owner_email || '', owner_phone: campus.owner_phone || '',
      upi_id: campus.upi_id || '', bank_account_name: campus.bank_account_name || '', bank_account_number: campus.bank_account_number || '',
      bank_ifsc: campus.bank_ifsc || '', razorpay_account_id: campus.razorpay_account_id || '',
    });
    setEditingCampus(campus);
    setShowCampusDialog(true);
  };

  // 🌟 NEW: SPLIT CAMPUSES BY STATUS
  const searchFilter = (c: any) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(search) || c.code.toLowerCase().includes(search) || c.owner_name?.toLowerCase().includes(search);
  };

  const activeCampuses = campuses.filter(c => c.status !== 'archived' && searchFilter(c));
  const archivedCampuses = campuses.filter(c => c.status === 'archived' && searchFilter(c));

  const renderCampusCard = (campus: any, isArchived: boolean) => (
    <Card key={campus.id} className={`hover:shadow-md transition-shadow flex flex-col ${isArchived ? 'opacity-70 border-dashed' : ''}`}>
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className={`font-semibold text-lg ${isArchived ? 'line-through' : ''}`}>{campus.name}</h3>
            <Badge variant="outline" className="mt-1">{campus.code}</Badge>
          </div>
          <Badge variant={isArchived ? 'secondary' : (campus.is_active ? 'default' : 'secondary')}>
            {isArchived ? 'Archived' : (campus.is_active ? 'Active' : 'Offline')}
          </Badge>
        </div>
        
        <div className="space-y-3 mb-6 flex-1">
          {campus.address && <div className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" /><span>{campus.address}</span></div>}
          {campus.owner_name && <div className="flex items-center gap-2 text-sm text-muted-foreground"><User className="h-4 w-4" /><span>{campus.owner_name}</span></div>}
          {campus.owner_phone && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4" /><span>{campus.owner_phone}</span></div>}
          {campus.razorpay_account_id && <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded mt-2"><ShieldCheck className="h-4 w-4" /><span>Linked: {campus.razorpay_account_id}</span></div>}
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-gray-100 mt-auto">
          {!isArchived && (
            <>
              <Button variant="ghost" size="sm" className="px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => copyPayoutDetails(campus)} title="Copy Bank Details"><CreditCard className="h-4 w-4 mr-1" /> Copy Bank</Button>
              <div className="flex-1"></div>
              <Button variant="outline" size="sm" onClick={() => openEditCampus(campus)}><Edit className="h-4 w-4 mr-1" /> Edit</Button>
              <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteTarget(campus)}><Archive className="h-4 w-4 mr-1" /> Archive</Button>
            </>
          )}
          {isArchived && (
            <Button variant="outline" size="sm" className="w-full text-emerald-600 hover:bg-emerald-50 border-emerald-200" onClick={() => setRestoreTarget(campus)}><ArchiveRestore className="h-4 w-4 mr-2" /> Restore Campus</Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold tracking-tight">Campus Management</h1><p className="text-muted-foreground">Manage your campuses and their settings</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => { fetchCampuses(); refreshData(); }} disabled={isLoading}><RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} /><span className="hidden sm:inline">Refresh</span></Button>
          <Button variant="outline" onClick={exportToCSV} className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"><Download className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Export CSV</span></Button>
          <Button variant="outline" onClick={() => setShowWizard(true)}><Sparkles className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Onboard Campus</span></Button>
          <Button onClick={() => { resetCampusForm(); setShowCampusDialog(true); }}><Plus className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Quick Add</span></Button>
        </div>
      </div>

      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search campuses..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="active">Active Campuses ({activeCampuses.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived Vault ({archivedCampuses.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => (<Card key={i}><CardContent className="p-4"><Skeleton className="h-6 w-32 mb-2" /><Skeleton className="h-4 w-24" /></CardContent></Card>))}</div>
          ) : activeCampuses.length === 0 ? (
            <Card><CardContent className="p-12 text-center"><Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="font-semibold text-lg">No Active Campuses</h3><p className="text-muted-foreground">Add your first campus to get started.</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{activeCampuses.map(c => renderCampusCard(c, false))}</div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-0">
          {archivedCampuses.length === 0 ? (
            <Card><CardContent className="p-12 text-center"><Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" /><h3 className="font-semibold text-lg">Vault is Empty</h3><p className="text-muted-foreground">Archived campuses will appear here.</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{archivedCampuses.map(c => renderCampusCard(c, true))}</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Campus Dialog */}
      <Dialog open={showCampusDialog} onOpenChange={setShowCampusDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCampus ? 'Edit Campus' : 'Add New Campus'}</DialogTitle>
            <DialogDescription>{editingCampus ? 'Update campus details.' : 'Create a new campus.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2"><Building2 className="h-4 w-4" />Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Campus Name *</Label><Input placeholder="e.g., CMRTC Main" value={campusForm.name} onChange={(e) => setCampusForm(prev => ({ ...prev, name: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Campus Code *</Label><Input placeholder="e.g., CMRTC01" value={campusForm.code} onChange={(e) => setCampusForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} /><p className="text-xs text-muted-foreground">Must be unique</p></div>
              </div>
              <div className="mt-4 space-y-2"><Label>Address</Label><Input placeholder="Full address" value={campusForm.address} onChange={(e) => setCampusForm(prev => ({ ...prev, address: e.target.value }))} /></div>
              <div className="flex items-center gap-2 mt-4"><Switch checked={campusForm.is_active} onCheckedChange={(checked) => setCampusForm(prev => ({ ...prev, is_active: checked }))} /><Label>Active Campus</Label></div>
            </div>
            <Separator />
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2"><User className="h-4 w-4" />Owner Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Owner Name</Label><Input placeholder="Full name" value={campusForm.owner_name} onChange={(e) => setCampusForm(prev => ({ ...prev, owner_name: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input placeholder="+91 9876543210" value={campusForm.owner_phone} onChange={(e) => setCampusForm(prev => ({ ...prev, owner_phone: e.target.value }))} /></div>
              </div>
              <div className="mt-4 space-y-2"><Label>Email</Label><Input type="email" placeholder="owner@example.com" value={campusForm.owner_email} onChange={(e) => setCampusForm(prev => ({ ...prev, owner_email: e.target.value }))} /></div>
            </div>
            <Separator />
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2"><CreditCard className="h-4 w-4" />Payment Details</h4>
              <div className="space-y-4">
                <div className="space-y-2 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                  <Label className="flex items-center gap-2 text-emerald-800"><ShieldCheck className="h-4 w-4" />Razorpay Linked Account ID</Label>
                  <Input placeholder="e.g. acc_XYZ12345" className="border-emerald-200" value={campusForm.razorpay_account_id} onChange={(e) => setCampusForm(prev => ({ ...prev, razorpay_account_id: e.target.value }))} />
                  <p className="text-xs text-emerald-600/80">Required for automated T+2 payouts via Razorpay Route.</p>
                </div>
                <div className="space-y-2"><Label>Legacy UPI ID</Label><Input placeholder="name@upi" value={campusForm.upi_id} onChange={(e) => setCampusForm(prev => ({ ...prev, upi_id: e.target.value }))} /></div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Account Name</Label><Input placeholder="Name on account" value={campusForm.bank_account_name} onChange={(e) => setCampusForm(prev => ({ ...prev, bank_account_name: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Account Number</Label><Input placeholder="Account number" value={campusForm.bank_account_number} onChange={(e) => setCampusForm(prev => ({ ...prev, bank_account_number: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>IFSC Code</Label><Input placeholder="e.g. SBIN0001234" value={campusForm.bank_ifsc} onChange={(e) => setCampusForm(prev => ({ ...prev, bank_ifsc: e.target.value.toUpperCase() }))} /></div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampusDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveCampus} disabled={isProcessing}>{isProcessing ? 'Saving...' : (editingCampus ? 'Update Campus' : 'Create Campus')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Campus</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to archive <strong>{deleteTarget?.name}</strong>? This will hide it from students. Financial data will be safely preserved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-destructive hover:bg-destructive/90" disabled={isProcessing}>{isProcessing ? 'Archiving...' : 'Archive Campus'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation */}
      <AlertDialog open={!!restoreTarget} onOpenChange={() => setRestoreTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Campus</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to restore <strong>{restoreTarget?.name}</strong>? This will bring the campus back online.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore} className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isProcessing}>{isProcessing ? 'Restoring...' : 'Restore Campus'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CampusOnboardingWizard open={showWizard} onOpenChange={setShowWizard} onSuccess={() => { fetchCampuses(); refreshData(); }} />
    </div>
  );
}