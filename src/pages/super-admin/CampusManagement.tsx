import { useState, useEffect, useCallback } from 'react';
import {
  Building2, Plus, Edit, Trash2, RefreshCw, Search,
  MapPin, Phone, Mail, User, CreditCard, Percent, Sparkles
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
  
  // Campus Dialog
  const [showCampusDialog, setShowCampusDialog] = useState(false);
  const [editingCampus, setEditingCampus] = useState<Campus | null>(null);
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
    commission_rate: 10,
  });

  // Delete Dialog
  const [deleteTarget, setDeleteTarget] = useState<Campus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchCampuses = useCallback(async () => {
    setIsLoading(true);
    
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

  const handleSaveCampus = async () => {
    if (!campusForm.name.trim() || !campusForm.code.trim()) {
      toast.error('Name and code are required');
      return;
    }

    setIsProcessing(true);

    try {
      const data = {
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
        bank_ifsc: campusForm.bank_ifsc.trim() || null,
        commission_rate: campusForm.commission_rate,
      };

      if (editingCampus) {
        const { error } = await supabase
          .from('campuses')
          .update(data)
          .eq('id', editingCampus.id);

        if (error) throw error;
        toast.success('Campus updated successfully');
      } else {
        const { error } = await supabase
          .from('campuses')
          .insert(data);

        if (error) throw error;
        toast.success('Campus created successfully');
      }

      fetchCampuses();
      refreshData();
      setShowCampusDialog(false);
      resetCampusForm();
    } catch (err: unknown) {
      console.error('Error saving campus:', err);
      const message = err instanceof Error ? err.message : 'Failed to save campus';
      toast.error(message);
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
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;

      toast.success('Campus deleted successfully');
      fetchCampuses();
      refreshData();
    } catch (err: unknown) {
      console.error('Error deleting:', err);
      const message = err instanceof Error ? err.message : 'Failed to delete campus';
      toast.error(message);
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
      commission_rate: 10,
    });
    setEditingCampus(null);
  };

  const openEditCampus = (campus: Campus) => {
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
      commission_rate: campus.commission_rate || 10,
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campus Management</h1>
          <p className="text-muted-foreground">
            Manage your campuses and their settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { fetchCampuses(); refreshData(); }} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={() => { resetCampusForm(); setShowCampusDialog(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Campus
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search campuses..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Campus Grid */}
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
          {filteredCampuses.map((campus) => (
            <Card key={campus.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{campus.name}</h3>
                    <Badge variant="outline" className="mt-1">{campus.code}</Badge>
                  </div>
                  <Badge variant={campus.is_active ? 'default' : 'secondary'}>
                    {campus.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                
                {campus.address && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{campus.address}</span>
                  </div>
                )}
                
                {campus.owner_name && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <User className="h-4 w-4" />
                    <span>{campus.owner_name}</span>
                  </div>
                )}
                
                {campus.owner_phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Phone className="h-4 w-4" />
                    <span>{campus.owner_phone}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <Percent className="h-4 w-4" />
                  <span>Commission: {campus.commission_rate}%</span>
                </div>

                <div className="flex items-center gap-2">
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
                  <p className="text-xs text-muted-foreground">Use numbering for multiple: CMRTC01, CMRTC02</p>
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
                <Label htmlFor="is_active">Active</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="upi_id">UPI ID</Label>
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
                      placeholder="IFSC"
                      value={campusForm.bank_ifsc}
                      onChange={(e) => setCampusForm(prev => ({ ...prev, bank_ifsc: e.target.value.toUpperCase() }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission_rate">Commission Rate (%)</Label>
                  <Input
                    id="commission_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={campusForm.commission_rate}
                    onChange={(e) => setCampusForm(prev => ({ ...prev, commission_rate: Number(e.target.value) }))}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">Platform commission for this campus</p>
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
            <AlertDialogTitle>Delete Campus</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? 
              This will also delete all associated data including orders, menu items, and user profiles.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isProcessing}
            >
              {isProcessing ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
