import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { useImageUpload } from '@/hooks/useImageUpload';

const ADMIN_CATEGORIES = [
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'lunch', name: 'Lunch' },
  { id: 'snacks', name: 'Snacks' },
] as const;

const TIME_PERIODS = [
  { id: 'breakfast', name: 'Breakfast (8-11 AM)' },
  { id: 'lunch', name: 'Lunch (11:15 AM - 2:45 PM)' },
  { id: 'snacks', name: 'Snacks (3-5 PM)' },
];

const AVAILABLE_DAYS = [
  { id: 'mon-sat', name: 'Mon-Sat', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
  { id: 'mon', name: 'Mon' },
  { id: 'tue', name: 'Tue' },
  { id: 'wed', name: 'Wed' },
  { id: 'thu', name: 'Thu' },
  { id: 'fri', name: 'Fri' },
  { id: 'sat', name: 'Sat' },
] as const;

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string | null;
  is_veg: boolean;
  is_popular: boolean;
  is_available: boolean;
  quantity: number | null;
  available_time_periods: string[];
  available_days: string[];
}

interface AdminMenuTabProps {
  menuItems: MenuItem[];
  menuLoading: boolean;
  createMenuItem: { mutateAsync: (data: any) => Promise<any>; isPending: boolean };
  updateMenuItem: { mutateAsync: (data: any) => Promise<any>; isPending: boolean };
  deleteMenuItem: { mutateAsync: (id: string) => Promise<any>; isPending: boolean };
}

export function AdminMenuTab({ menuItems, menuLoading, createMenuItem, updateMenuItem, deleteMenuItem }: AdminMenuTabProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, isUploading } = useImageUpload();

  const [formData, setFormData] = useState({
    name: '', price: '', quantity: '', category: 'snacks', image: '',
    is_veg: true, is_popular: false, is_available: true,
    available_time_periods: [] as string[],
    available_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as string[],
  });

  const resetForm = () => {
    setFormData({
      name: '', price: '', quantity: '', category: 'snacks', image: '',
      is_veg: true, is_popular: false, is_available: true,
      available_time_periods: [],
      available_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    });
    setEditingItem(null);
    setImagePreview(null);
    setSelectedFile(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be less than 5MB'); return; }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setFormData({ ...formData, image: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) { toast.error('Name and price are required'); return; }
    try {
      let imageUrl = formData.image;
      if (selectedFile) {
        const uploadedUrl = await uploadImage(selectedFile);
        if (!uploadedUrl) { toast.error('Failed to upload image'); return; }
        imageUrl = uploadedUrl;
      }
      const payload = {
        name: formData.name, price: parseFloat(formData.price),
        quantity: parseInt(formData.quantity) || 0, category: formData.category,
        image: imageUrl || undefined, is_veg: formData.is_veg,
        is_popular: formData.is_popular, is_available: formData.is_available,
        available_time_periods: formData.available_time_periods,
        available_days: formData.available_days,
      };
      if (editingItem) {
        await updateMenuItem.mutateAsync({ id: editingItem, ...payload });
        toast.success('Item updated successfully');
      } else {
        await createMenuItem.mutateAsync(payload);
        toast.success('Item added successfully');
      }
      setIsAddDialogOpen(false);
      resetForm();
    } catch { toast.error('Failed to save item'); }
  };

  const handleEdit = (item: MenuItem) => {
    setFormData({
      name: item.name, price: item.price.toString(),
      quantity: (item.quantity ?? 0).toString(), category: item.category,
      image: item.image || '', is_veg: item.is_veg ?? true,
      is_popular: item.is_popular ?? false, is_available: item.is_available ?? true,
      available_time_periods: item.available_time_periods || [],
      available_days: item.available_days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    });
    setEditingItem(item.id);
    setSelectedFile(null);
    setImagePreview(null);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      try { await deleteMenuItem.mutateAsync(id); toast.success('Item deleted'); }
      catch { toast.error('Failed to delete item'); }
    }
  };

  const handleToggleAvailability = async (id: string, currentValue: boolean) => {
    try { await updateMenuItem.mutateAsync({ id, is_available: !currentValue }); toast.success(`Item ${!currentValue ? 'enabled' : 'disabled'}`); }
    catch { toast.error('Failed to update availability'); }
  };

  return (
    <Card className="rounded-2xl card-shadow">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Menu Items</CardTitle>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="rounded-full gap-2"><Plus size={16} /> Add Item</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Item name" />
              </div>
              <div className="space-y-2">
                <Label>Quantity (Stock) *</Label>
                <Input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} placeholder="e.g., 150" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price *</Label>
                  <Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ADMIN_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Image</Label>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                {imagePreview || formData.image ? (
                  <div className="relative">
                    <img src={imagePreview || formData.image} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-border" />
                    <button type="button" onClick={clearImage} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors">
                    {isUploading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : (
                      <><Upload className="w-6 h-6 text-muted-foreground" /><span className="text-sm text-muted-foreground">Click to upload image</span></>
                    )}
                  </button>
                )}
              </div>

              {/* Time Periods */}
              <div className="space-y-2">
                <Label>Available Time Periods</Label>
                <div className="flex flex-wrap gap-2">
                  {TIME_PERIODS.map((period) => (
                    <button key={period.id} type="button"
                      onClick={() => {
                        const periods = formData.available_time_periods.includes(period.id)
                          ? formData.available_time_periods.filter((p) => p !== period.id)
                          : [...formData.available_time_periods, period.id];
                        setFormData({ ...formData, available_time_periods: periods });
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        formData.available_time_periods.includes(period.id)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >{period.name}</button>
                  ))}
                </div>
              </div>

              {/* Available Days */}
              <div className="space-y-2">
                <Label>Available Days</Label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_DAYS.map((day) => {
                    const isMonSat = day.id === 'mon-sat';
                    const isSelected = isMonSat
                      ? formData.available_days.length === 6 && ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'].every(d => formData.available_days.includes(d))
                      : formData.available_days.includes(day.id);
                    return (
                      <button key={day.id} type="button"
                        onClick={() => {
                          if (isMonSat) {
                            setFormData({ ...formData, available_days: isSelected ? [] : ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] });
                          } else {
                            const days = formData.available_days.includes(day.id)
                              ? formData.available_days.filter((d) => d !== day.id)
                              : [...formData.available_days, day.id];
                            setFormData({ ...formData, available_days: days });
                          }
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >{day.name}</button>
                    );
                  })}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex items-center justify-between"><Label>Vegetarian</Label><Switch checked={formData.is_veg} onCheckedChange={(checked) => setFormData({ ...formData, is_veg: checked })} /></div>
              <div className="flex items-center justify-between"><Label>Popular</Label><Switch checked={formData.is_popular} onCheckedChange={(checked) => setFormData({ ...formData, is_popular: checked })} /></div>
              <div className="flex items-center justify-between"><Label>Available</Label><Switch checked={formData.is_available} onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })} /></div>

              <Button className="w-full" onClick={handleSubmit} disabled={createMenuItem.isPending || updateMenuItem.isPending}>
                {createMenuItem.isPending || updateMenuItem.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editingItem ? 'Update Item' : 'Add Item'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {menuLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : menuItems.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No menu items yet</p>
        ) : (
          <div className="space-y-3">
            {menuItems.map((item) => {
              const categoryName = ADMIN_CATEGORIES.find((c) => c.id === item.category)?.name || item.category;
              return (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {item.image && <img src={item.image} alt={item.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm sm:text-base truncate">{item.name}</h3>
                        {item.is_veg && (
                          <span className="w-4 h-4 rounded border-2 border-green-500 flex items-center justify-center flex-shrink-0">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{categoryName} • ₹{item.price} • Stock: {item.quantity ?? 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end flex-shrink-0">
                    <Switch checked={item.is_available ?? true} onCheckedChange={() => handleToggleAvailability(item.id, item.is_available ?? true)} />
                    <Button variant="outline" size="sm" className="rounded-full text-xs sm:text-sm" onClick={() => handleEdit(item)}>Edit</Button>
                    <Button variant="outline" size="icon" className="rounded-full text-destructive hover:bg-destructive hover:text-destructive-foreground h-8 w-8" onClick={() => handleDelete(item.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
