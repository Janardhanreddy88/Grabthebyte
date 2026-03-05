import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useAdminMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useAdminOrders,
  useUpdateOrderStatus,
  useOrderStats,
  useMarkTokenUsed,
} from "@/hooks/useAdminData";
import { useMonthlyAnalytics } from "@/hooks/useMonthlyAnalytics";
import { useWeeklyAnalytics } from "@/hooks/useWeeklyAnalytics";
import { useTodayAnalytics } from "@/hooks/useTodayAnalytics";
import { useImageUpload } from "@/hooks/useImageUpload";
import { toast } from "sonner";
import {
  LogOut,
  QrCode,
  LayoutDashboard,
  UtensilsCrossed,
  TrendingUp,
  IndianRupee,
  ShoppingBag,
  Users,
  Clock,
  Plus,
  Trash2,
  Loader2,
  Package,
  Upload,
  ImageIcon,
  X,
  User,
  Mail,
  Phone,
  Building2,
  Sun,
  Utensils,
  Cookie,
  ChevronDown,
  Calendar,
  PieChart,
  CheckCircle2,
} from "lucide-react";
import { PieChart as RechartsPie, Pie, Cell, Legend } from "recharts";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const ADMIN_CATEGORIES = [
  { id: "breakfast", name: "Breakfast" },
  { id: "lunch", name: "Lunch" },
  { id: "snacks", name: "Snacks" },
] as const;

const TIME_PERIODS = [
  { id: "breakfast", name: "Breakfast (8-11 AM)" },
  { id: "lunch", name: "Lunch (11:15 AM - 2:45 PM)" },
  { id: "snacks", name: "Snacks (3-5 PM)" },
];

const AVAILABLE_DAYS = [
  { id: "mon-sat", name: "Mon-Sat", days: ["mon", "tue", "wed", "thu", "fri", "sat"] },
  { id: "mon", name: "Mon" },
  { id: "tue", name: "Tue" },
  { id: "wed", name: "Wed" },
  { id: "thu", name: "Thu" },
  { id: "fri", name: "Fri" },
  { id: "sat", name: "Sat" },
] as const;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout: pinLogout } = useAdminAuth();
  const { logout: authLogout } = useAuth();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [profileData, setProfileData] = useState<{
    full_name: string | null;
    email: string | null;
    phone: string | null;
    campus_name: string | null;
    campus_code: string | null;
  } | null>(null);

  // Fetch admin profile + campus data directly from Supabase
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      
      // Fetch profile with campus details in one query
      const { data } = await supabase
        .from('profiles')
        .select(`
          full_name,
          email,
          phone,
          campus_id,
          campuses:campus_id (
            name,
            code
          )
        `)
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      if (data) {
        const campusData = data.campuses as { name: string; code: string } | null;
        setProfileData({
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          campus_name: campusData?.name || null,
          campus_code: campusData?.code || null,
        });
      }
    };
    
    fetchProfile();
  }, []);

  // Note: Old orders are kept in database for monthly analytics
  // They are hidden from the orders list UI but available for reporting

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    quantity: "",
    category: "snacks",
    image: "",
    is_veg: true,
    is_popular: false,
    is_available: true,
    available_time_periods: [] as string[],
    available_days: ["mon", "tue", "wed", "thu", "fri", "sat"] as string[],
  });

  // Hooks
  const { data: menuItems = [], isLoading: menuLoading } = useAdminMenuItems();
  const { data: orders = [], isLoading: ordersLoading } = useAdminOrders();
  const { data: stats } = useOrderStats();
  const { data: monthlyStats, isLoading: monthlyLoading } = useMonthlyAnalytics();
  const { data: weeklyStats, isLoading: weeklyLoading } = useWeeklyAnalytics();
  const { data: todayStats, isLoading: todayLoading } = useTodayAnalytics();
  const createMenuItem = useCreateMenuItem();
  const updateMenuItem = useUpdateMenuItem();
  const deleteMenuItem = useDeleteMenuItem();
  const updateOrderStatus = useUpdateOrderStatus();
  const markTokenUsed = useMarkTokenUsed();
  const { uploadImage, isUploading } = useImageUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'AD';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSignOut = async () => {
    // Clear admin PIN session + Supabase session
    pinLogout();
    await authLogout();
    navigate("/auth?logout=true");
  };

  const resetForm = () => {
    setFormData({
      name: "",
      price: "",
      quantity: "",
      category: "snacks",
      image: "",
      is_veg: true,
      is_popular: false,
      is_available: true,
      available_time_periods: [],
      available_days: ["mon", "tue", "wed", "thu", "fri", "sat"],
    });
    setEditingItem(null);
    setImagePreview(null);
    setSelectedFile(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setSelectedFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setFormData({ ...formData, image: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) {
      toast.error("Name and price are required");
      return;
    }

    try {
      let imageUrl = formData.image;

      // Upload image if a new file was selected
      if (selectedFile) {
        const uploadedUrl = await uploadImage(selectedFile);
        if (!uploadedUrl) {
          toast.error("Failed to upload image");
          return;
        }
        imageUrl = uploadedUrl;
      }

      if (editingItem) {
        await updateMenuItem.mutateAsync({
          id: editingItem,
          name: formData.name,
          price: parseFloat(formData.price),
          quantity: parseInt(formData.quantity) || 0,
          category: formData.category,
          image: imageUrl || undefined,
          is_veg: formData.is_veg,
          is_popular: formData.is_popular,
          is_available: formData.is_available,
          available_time_periods: formData.available_time_periods,
          available_days: formData.available_days,
        });
        toast.success("Item updated successfully");
      } else {
        await createMenuItem.mutateAsync({
          name: formData.name,
          price: parseFloat(formData.price),
          quantity: parseInt(formData.quantity) || 0,
          category: formData.category,
          image: imageUrl || undefined,
          is_veg: formData.is_veg,
          is_popular: formData.is_popular,
          is_available: formData.is_available,
          available_time_periods: formData.available_time_periods,
          available_days: formData.available_days,
        });
        toast.success("Item added successfully");
      }
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error("Failed to save item");
    }
  };

  const handleEdit = (item: (typeof menuItems)[0]) => {
    setFormData({
      name: item.name,
      price: item.price.toString(),
      quantity: (item.quantity ?? 0).toString(),
      category: item.category,
      image: item.image || "",
      is_veg: item.is_veg ?? true,
      is_popular: item.is_popular ?? false,
      is_available: item.is_available ?? true,
      available_time_periods: item.available_time_periods || [],
      available_days: item.available_days || ["mon", "tue", "wed", "thu", "fri", "sat"],
    });
    setEditingItem(item.id);
    setSelectedFile(null);
    setImagePreview(null); // Will show existing image from formData.image
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      try {
        await deleteMenuItem.mutateAsync(id);
        toast.success("Item deleted");
      } catch (error) {
        toast.error("Failed to delete item");
      }
    }
  };

  const handleToggleAvailability = async (id: string, currentValue: boolean) => {
    try {
      await updateMenuItem.mutateAsync({ id, is_available: !currentValue });
      toast.success(`Item ${!currentValue ? "enabled" : "disabled"}`);
    } catch (error) {
      toast.error("Failed to update availability");
    }
  };

  // Simplified token system - only 5 statuses
  const handleOrderStatusChange = async (id: string, status: 'pending' | 'confirmed' | 'collected' | 'expired' | 'failed') => {
    try {
      await updateOrderStatus.mutateAsync({ id, status });
      toast.success("Order status updated");
    } catch (error) {
      toast.error("Failed to update order");
    }
  };

  const chartData = stats?.chartData || [];

  // Low stock items (quantity <= 10)
  const lowStockItems = menuItems
    .filter((item) => (item.quantity ?? 0) <= 10)
    .map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity ?? 0,
      category: ADMIN_CATEGORIES.find((c) => c.id === item.category)?.name || item.category,
    }))
    .sort((a, b) => a.quantity - b.quantity);

  const handleRestockClick = (itemId: string) => {
    const item = menuItems.find((i) => i.id === itemId);
    if (item) {
      handleEdit(item);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between px-4 lg:px-6 h-12">
          <Logo size="sm" />

          <div className="flex items-center gap-1.5">
            <Button onClick={() => navigate("/menu")} variant="outline" size="sm" className="gap-1.5 rounded-full h-7 text-[11px]">
              <Users size={13} />
              <span className="hidden sm:inline">Student View</span>
            </Button>
            <Button onClick={() => navigate("/kiosk-scanner")} size="sm" className="gap-1.5 rounded-full h-7 text-[11px] bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              <QrCode size={13} />
              <span className="hidden sm:inline">🚀 Kiosk</span>
            </Button>
            
            {/* Profile Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-[10px] hover:opacity-90 transition-opacity">
                  {getInitials(profileData?.full_name)}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-0">
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs">
                      {getInitials(profileData?.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{profileData?.full_name || 'Admin'}</p>
                      <p className="text-[10px] text-muted-foreground">Administrator</p>
                    </div>
                  </div>
                  <Separator className="mb-2" />
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs"><Mail size={12} className="text-muted-foreground shrink-0" /><span className="truncate">{profileData?.email || 'N/A'}</span></div>
                    <div className="flex items-center gap-2 text-xs"><Phone size={12} className="text-muted-foreground shrink-0" /><span>{profileData?.phone || 'Not set'}</span></div>
                    <div className="flex items-center gap-2 text-xs"><Building2 size={12} className="text-muted-foreground shrink-0" /><span className="truncate">{profileData?.campus_name || 'N/A'} ({profileData?.campus_code || 'N/A'})</span></div>
                  </div>
                </div>
                <Separator />
                <div className="p-1.5">
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs" onClick={handleSignOut}>
                    <LogOut size={13} /> Sign Out
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>

      <main className="p-3 lg:p-5 max-w-7xl mx-auto">
        {/* Page Title */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <LayoutDashboard className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Admin Dashboard</h1>
            <p className="text-[11px] text-muted-foreground">Manage your canteen</p>
          </div>
        </div>

        <Tabs defaultValue="analytics" className="space-y-4">
          <TabsList className="bg-muted rounded-full p-0.5 h-auto flex-wrap justify-start">
            <TabsTrigger value="analytics" className="gap-1 rounded-full px-3 py-1.5 text-[11px] data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <TrendingUp size={12} className="hidden sm:block" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-1 rounded-full px-3 py-1.5 text-[11px] data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Package size={12} className="hidden sm:block" /> Orders
            </TabsTrigger>
            <TabsTrigger value="menu" className="gap-1 rounded-full px-3 py-1.5 text-[11px] data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <UtensilsCrossed size={12} className="hidden sm:block" /> Menu
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {/* Today's Detailed Report */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Today's Report</h3>
                    <p className="text-sm text-muted-foreground">{todayStats?.dateString}</p>
                  </div>
                </div>
                {todayStats?.currentPeriod && (
                  <span className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-medium animate-pulse">
                    {todayStats.currentPeriod}
                  </span>
                )}
              </div>

              {todayLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Today's Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="rounded-2xl card-shadow bg-primary/5">
                      <CardContent className="p-3 sm:p-4">
                        <div className="text-center">
                          <ShoppingBag className="w-6 h-6 mx-auto text-primary mb-1" />
                          <p className="text-2xl sm:text-3xl font-bold text-primary">{todayStats?.totalOrders || 0}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Total Orders</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl card-shadow bg-secondary/5">
                      <CardContent className="p-3 sm:p-4">
                        <div className="text-center">
                          <IndianRupee className="w-6 h-6 mx-auto text-secondary mb-1" />
                          <p className="text-2xl sm:text-3xl font-bold text-secondary">₹{(todayStats?.totalRevenue || 0).toLocaleString()}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Today Total Revenue</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-4">
                    {/* Time Period Breakdown */}
                    <Card className="rounded-2xl card-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Orders by Time Period
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {todayStats?.periodBreakdown && todayStats.periodBreakdown.some(p => p.orders > 0) ? (
                          <div className="space-y-3">
                            {todayStats.periodBreakdown.map((period, idx) => {
                              const colors = ['bg-amber-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500'];
                              const bgColors = ['bg-amber-500/10', 'bg-blue-500/10', 'bg-purple-500/10', 'bg-orange-500/10'];
                              const icons = [Sun, Utensils, Cookie, Utensils];
                              const Icon = icons[idx];
                              return (
                                <div 
                                  key={period.period} 
                                  className={`p-3 rounded-xl ${bgColors[idx]} ${period.isActive ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4" />
                                      <span className="font-semibold">{period.period}</span>
                                      {period.isActive && (
                                        <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">NOW</span>
                                      )}
                                    </div>
                                    <span className="text-sm font-bold">{period.orders} orders</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-background/50 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full ${colors[idx]} rounded-full transition-all`}
                                        style={{ width: `${period.percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium w-10 text-right">{period.percentage}%</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Revenue: ₹{period.revenue.toLocaleString()}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-center py-6 text-muted-foreground">No orders today yet</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Top Selling Items Today */}
                    <Card className="rounded-2xl card-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Top Items Today
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {todayStats?.topItems && todayStats.topItems.length > 0 ? (
                          <div className="space-y-2">
                            {todayStats.topItems.map((item, idx) => (
                              <div 
                                key={item.name} 
                                className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    idx === 0 ? 'bg-yellow-500 text-yellow-950' : 
                                    idx === 1 ? 'bg-gray-300 text-gray-700' : 
                                    idx === 2 ? 'bg-amber-600 text-amber-50' : 
                                    'bg-muted text-muted-foreground'
                                  }`}>
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <p className="font-medium text-sm">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">₹{item.revenue.toLocaleString()}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-primary">{item.quantity}</p>
                                  <p className="text-xs text-muted-foreground">sold</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center py-6 text-muted-foreground">No items sold today</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                </>
              )}
            </div>

            {/* Weekly Detailed Review */}
            <Collapsible defaultOpen={false} className="space-y-4">
              <CollapsibleTrigger className="w-full group">
                <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                  <TrendingUp className="h-5 w-5 text-secondary" />
                  <h3 className="text-lg font-semibold">Weekly Review</h3>
                  {weeklyStats?.weekRange && (
                    <span className="text-sm text-muted-foreground">({weeklyStats.weekRange})</span>
                  )}
                  <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4">

              {weeklyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Weekly Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="rounded-2xl card-shadow">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground">Total Orders</p>
                        <p className="text-xl font-bold text-primary">{weeklyStats?.totalOrders || 0}</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl card-shadow">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground">Revenue</p>
                        <p className="text-xl font-bold text-secondary">₹{(weeklyStats?.totalRevenue || 0).toLocaleString()}</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl card-shadow">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground">Busiest Day</p>
                        <p className="text-xl font-bold">{weeklyStats?.busiestDay || '-'}</p>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl card-shadow">
                      <CardContent className="p-3">
                        <p className="text-[10px] text-muted-foreground">Peak Hour</p>
                        <p className="text-xl font-bold">{weeklyStats?.peakHour || '-'}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-4">
                    {/* Orders by Time Period */}
                    <Card className="rounded-2xl card-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Orders by Time Period
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {weeklyStats?.periodBreakdown && weeklyStats.periodBreakdown.some(p => p.orders > 0) ? (
                          <div className="space-y-3">
                            {weeklyStats.periodBreakdown.map((period, idx) => {
                              const colors = ['bg-amber-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500'];
                              const bgColors = ['bg-amber-500/10', 'bg-blue-500/10', 'bg-purple-500/10', 'bg-orange-500/10'];
                              const icons = [Sun, Utensils, Cookie, Utensils];
                              const Icon = icons[idx];
                              return (
                                <div key={period.period} className={`p-3 rounded-xl ${bgColors[idx]}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4" />
                                      <span className="font-semibold">{period.period}</span>
                                    </div>
                                    <span className="text-sm font-bold">{period.orders} orders</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-background/50 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full ${colors[idx]} rounded-full transition-all`}
                                        style={{ width: `${period.percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium w-10 text-right">{period.percentage}%</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Revenue: ₹{period.revenue.toLocaleString()}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-center py-6 text-muted-foreground">No orders this week</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Top Selling Items */}
                    <Card className="rounded-2xl card-shadow">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Top Selling Items
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {weeklyStats?.topItems && weeklyStats.topItems.length > 0 ? (
                          <div className="space-y-2">
                            {weeklyStats.topItems.map((item, idx) => (
                              <div 
                                key={item.name} 
                                className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
                              >
                                <div className="flex items-center gap-3">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                    idx === 0 ? 'bg-yellow-500 text-yellow-950' : 
                                    idx === 1 ? 'bg-gray-300 text-gray-700' : 
                                    idx === 2 ? 'bg-amber-600 text-amber-50' : 
                                    'bg-muted text-muted-foreground'
                                  }`}>
                                    {idx + 1}
                                  </span>
                                  <div>
                                    <p className="font-medium text-sm">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">₹{item.revenue.toLocaleString()} revenue</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-primary">{item.quantity}</p>
                                  <p className="text-xs text-muted-foreground">sold</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center py-6 text-muted-foreground">No items sold this week</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Daily Orders Chart */}
                  <Card className="rounded-2xl card-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Daily Orders (Mon-Sun)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {weeklyStats?.dailyBreakdown && weeklyStats.dailyBreakdown.some(d => d.orders > 0) ? (
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={weeklyStats.dailyBreakdown}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                              <Tooltip
                                formatter={(value: number, name: string) => [
                                  name === 'revenue' ? `₹${value.toLocaleString()}` : value,
                                  name === 'revenue' ? 'Revenue' : 'Orders'
                                ]}
                                contentStyle={{
                                  background: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "12px",
                                }}
                              />
                              <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-center py-6 text-muted-foreground">No daily data available</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Additional Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <Card className="rounded-2xl card-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                            <Package className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Completion Rate</p>
                            <p className="text-2xl font-bold text-green-600">{weeklyStats?.completionRate || 0}%</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl card-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                            <Users className="w-5 h-5 text-accent-foreground" />
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Avg Order Value</p>
                            <p className="text-2xl font-bold">₹{weeklyStats?.avgOrderValue || 0}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
              </CollapsibleContent>
            </Collapsible>

            {/* Monthly Analytics Section */}
            <Collapsible defaultOpen={false} className="space-y-4">
              <CollapsibleTrigger className="w-full group">
                <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">
                    {monthlyStats?.monthName} {monthlyStats?.year} Analytics
                  </h3>
                  <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4">
              {monthlyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Monthly Stats Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="rounded-2xl card-shadow">
                      <CardContent className="p-3 sm:p-4">
                        <div className="text-center">
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Total Orders</p>
                          <p className="text-lg sm:text-2xl font-bold text-primary">
                            {monthlyStats?.totalOrders || 0}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl card-shadow">
                      <CardContent className="p-3 sm:p-4">
                        <div className="text-center">
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Total Revenue</p>
                          <p className="text-lg sm:text-2xl font-bold text-secondary">
                            ₹{(monthlyStats?.totalRevenue || 0).toLocaleString()}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="rounded-2xl card-shadow">
                      <CardContent className="p-3 sm:p-4">
                        <div className="text-center">
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Avg Order</p>
                          <p className="text-lg sm:text-2xl font-bold">
                            ₹{monthlyStats?.avgOrderValue || 0}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Time Period Breakdown */}
                    <Card className="rounded-2xl card-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <PieChart className="h-5 w-5" />
                          Revenue by Time Period
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {monthlyStats?.periodBreakdown && monthlyStats.periodBreakdown.some(p => p.orders > 0) ? (
                          <>
                            <div className="h-[200px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <RechartsPie>
                                  <Pie
                                    data={monthlyStats.periodBreakdown.filter(p => p.revenue > 0)}
                                    dataKey="revenue"
                                    nameKey="period"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={80}
                                    paddingAngle={2}
                                  >
                                    {monthlyStats.periodBreakdown.filter(p => p.revenue > 0).map((_, index) => (
                                      <Cell
                                        key={`cell-${index}`}
                                        fill={[
                                          'hsl(45, 93%, 47%)',   // Breakfast - amber
                                          'hsl(217, 91%, 60%)',  // Lunch - blue
                                          'hsl(270, 50%, 60%)',  // Snacks - purple
                                          'hsl(24, 95%, 53%)',   // Dinner - orange
                                        ][index % 4]}
                                      />
                                    ))}
                                  </Pie>
                                  <Legend />
                                  <Tooltip
                                    formatter={(value: number) => `₹${value.toLocaleString()}`}
                                    contentStyle={{
                                      background: "hsl(var(--card))",
                                      border: "1px solid hsl(var(--border))",
                                      borderRadius: "12px",
                                    }}
                                  />
                                </RechartsPie>
                              </ResponsiveContainer>
                            </div>
                            <div className="space-y-2 mt-4">
                              {monthlyStats.periodBreakdown.map((period, idx) => {
                                const colors = ['bg-amber-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500'];
                                const icons = [Sun, Utensils, Cookie, Utensils];
                                const Icon = icons[idx];
                                return (
                                  <div key={period.period} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3 h-3 rounded-full ${colors[idx]}`} />
                                      <Icon className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium text-sm">{period.period}</span>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-bold">₹{period.revenue.toLocaleString()}</p>
                                      <p className="text-xs text-muted-foreground">{period.orders} orders</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <p className="text-center py-8 text-muted-foreground">No order data this month</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Daily Trends Chart */}
                    <Card className="rounded-2xl card-shadow">
                      <CardHeader>
                        <CardTitle className="text-lg">Daily Trends</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {monthlyStats?.dailyTrends && monthlyStats.dailyTrends.some(d => d.orders > 0) ? (
                          <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={monthlyStats.dailyTrends}>
                                <defs>
                                  <linearGradient id="colorMonthlyRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis 
                                  dataKey="date" 
                                  stroke="hsl(var(--muted-foreground))" 
                                  fontSize={10}
                                  interval="preserveStartEnd"
                                />
                                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                                <Tooltip
                                  formatter={(value: number, name: string) => [
                                    name === 'revenue' ? `₹${value.toLocaleString()}` : value,
                                    name === 'revenue' ? 'Revenue' : 'Orders'
                                  ]}
                                  labelFormatter={(label) => `Day ${label}`}
                                  contentStyle={{
                                    background: "hsl(var(--card))",
                                    border: "1px solid hsl(var(--border))",
                                    borderRadius: "12px",
                                  }}
                                />
                                <Area
                                  type="monotone"
                                  dataKey="revenue"
                                  stroke="hsl(var(--secondary))"
                                  strokeWidth={2}
                                  fill="url(#colorMonthlyRevenue)"
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <p className="text-center py-8 text-muted-foreground">No trend data available</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
              </CollapsibleContent>
            </Collapsible>

            {/* Low Stock Alerts */}
            {lowStockItems.length > 0 && (
              <Card className="rounded-2xl card-shadow border-destructive/20 bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-destructive" />
                    Low Stock Alert
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {lowStockItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-background">
                        <span className="font-medium text-sm">{item.name}</span>
                        <span className="text-xs text-destructive font-semibold">Only {item.quantity} left</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            {/* Current Time Period Summary Card */}
            {(() => {
              // Get current time period using local time
              const now = new Date();
              const currentHour = now.getHours();
              const currentMinutes = now.getMinutes();
              
              let currentPeriodId = 'other';
              if (currentHour >= 7 && currentHour < 11) currentPeriodId = 'breakfast';
              else if (currentHour >= 11 && currentHour < 15) currentPeriodId = 'lunch';
              else if (currentHour >= 15 && currentHour < 18) currentPeriodId = 'snacks';

              // Calculate order counts by time period based on order creation time
              const getTimePeriod = (dateStr: string) => {
                const hour = new Date(dateStr).getHours();
                if (hour >= 7 && hour < 11) return 'breakfast';
                if (hour >= 11 && hour < 15) return 'lunch';
                if (hour >= 15 && hour < 18) return 'snacks';
                return 'other';
              };

              const periodOrders = {
                breakfast: orders.filter(o => getTimePeriod(o.created_at) === 'breakfast'),
                lunch: orders.filter(o => getTimePeriod(o.created_at) === 'lunch'),
                snacks: orders.filter(o => getTimePeriod(o.created_at) === 'snacks'),
              };

              // Count items per period
              const getItemCounts = (periodOrdersList: typeof orders) => {
                const itemCounts: Record<string, number> = {};
                periodOrdersList.forEach(order => {
                  order.items?.forEach(item => {
                    itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
                  });
                });
                return Object.entries(itemCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5);
              };

              const periodConfigs = [
                { id: 'breakfast', name: 'Breakfast', icon: Sun, color: 'bg-amber-500/10 text-amber-600', time: '7 AM - 11 AM' },
                { id: 'lunch', name: 'Lunch', icon: Utensils, color: 'bg-blue-500/10 text-blue-600', time: '11 AM - 3 PM' },
                { id: 'snacks', name: 'Snacks', icon: Cookie, color: 'bg-purple-500/10 text-purple-600', time: '3 PM - 6 PM' },
              ];

              // Find current period config
              const currentPeriod = periodConfigs.find(p => p.id === currentPeriodId);

              // If outside meal times, show a message with current time for debugging
              if (!currentPeriod) {
                return (
                  <Card className="rounded-2xl card-shadow">
                    <CardContent className="py-8">
                      <p className="text-center text-muted-foreground">
                        Current time: {currentHour}:{currentMinutes.toString().padStart(2, '0')} - Outside meal hours.
                      </p>
                      <p className="text-center text-muted-foreground text-sm mt-2">
                        Orders summary shows during Breakfast (7-11 AM), Lunch (11 AM-3 PM), or Snacks (3-6 PM).
                      </p>
                    </CardContent>
                  </Card>
                );
              }

              const ordersList = periodOrders[currentPeriodId as keyof typeof periodOrders];
              const itemCounts = getItemCounts(ordersList);
              const Icon = currentPeriod.icon;

              return (
                <Card className="rounded-2xl card-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-full ${currentPeriod.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{currentPeriod.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{currentPeriod.time}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-bold text-primary">{ordersList.length}</p>
                        <p className="text-sm text-muted-foreground">orders</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {itemCounts.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top Items</p>
                        {itemCounts.map(([name, count]) => (
                          <div key={name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                            <span className="font-medium">{name}</span>
                            <span className="font-bold text-primary">{count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No orders yet for this period</p>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Orders List - Grouped by Time Period */}
            <Card className="rounded-2xl card-shadow">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-lg">All Orders</CardTitle>
                <Input
                  placeholder="Search by last 4 digits..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full sm:w-48 h-9 rounded-full"
                />
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : orders.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No orders yet</p>
                ) : (
                  (() => {
                    // Helper to get time period from order
                    const getOrderTimePeriod = (dateStr: string) => {
                      const hour = new Date(dateStr).getHours();
                      if (hour >= 7 && hour < 11) return 'breakfast';
                      if (hour >= 11 && hour < 15) return 'lunch';
                      if (hour >= 15 && hour < 18) return 'snacks';
                      if (hour >= 18 && hour < 22) return 'dinner';
                      return 'other';
                    };

                    // Get current time period
                    const currentHour = new Date().getHours();
                    let currentPeriod = 'other';
                    if (currentHour >= 7 && currentHour < 11) currentPeriod = 'breakfast';
                    else if (currentHour >= 11 && currentHour < 15) currentPeriod = 'lunch';
                    else if (currentHour >= 15 && currentHour < 18) currentPeriod = 'snacks';
                    else if (currentHour >= 18 && currentHour < 22) currentPeriod = 'dinner';

                    // Sort: current period first, then completed (past) periods, then future
                    const allPeriods = ['breakfast', 'lunch', 'snacks', 'dinner', 'other'];
                    const currentIndex = allPeriods.indexOf(currentPeriod);
                    
                    // Reorder: current first, then past periods in reverse, then future
                    const periodOrder = [
                      currentPeriod,
                      ...allPeriods.slice(0, currentIndex).reverse(), // past periods (completed)
                      ...allPeriods.slice(currentIndex + 1), // future periods
                    ].filter((v, i, a) => a.indexOf(v) === i); // remove duplicates
                    const periodLabels: Record<string, { name: string; icon: typeof Sun; color: string }> = {
                      breakfast: { name: 'Breakfast', icon: Sun, color: 'bg-amber-500/10 text-amber-600' },
                      lunch: { name: 'Lunch', icon: Utensils, color: 'bg-blue-500/10 text-blue-600' },
                      snacks: { name: 'Snacks', icon: Cookie, color: 'bg-purple-500/10 text-purple-600' },
                      dinner: { name: 'Dinner', icon: Utensils, color: 'bg-orange-500/10 text-orange-600' },
                      other: { name: 'Other', icon: Clock, color: 'bg-gray-500/10 text-gray-600' },
                    };

                    // Time boundaries
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
                    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

                    // Filter orders: show today's orders always, yesterday's only when searched
                    const filteredOrders = orders.filter((order) => {
                      const orderDate = new Date(order.created_at);
                      const orderNum = order.order_number || order.id;
                      const lastFour = orderNum.slice(-4).toLowerCase();
                      const searchTerm = orderSearch.toLowerCase().trim();
                      const matchesSearch = searchTerm && lastFour.includes(searchTerm);

                      // Orders older than 48 hours: only show if searched
                      if (orderDate < fortyEightHoursAgo) {
                        return matchesSearch;
                      }

                      // Orders from yesterday (within 48 hours but not today): only show if searched
                      if (orderDate < todayStart) {
                        return matchesSearch;
                      }

                      // Today's orders: always show, or filter by search if searching
                      if (searchTerm) {
                        return matchesSearch;
                      }
                      return true;
                    });

                    // Group by time period
                    const groupedOrders = filteredOrders.reduce((acc, order) => {
                      const period = getOrderTimePeriod(order.created_at);
                      if (!acc[period]) acc[period] = [];
                      acc[period].push(order);
                      return acc;
                    }, {} as Record<string, typeof orders>);

                    return (
                      <div className="space-y-6">
                        {periodOrder.map((period) => {
                          const periodOrders = groupedOrders[period];
                          if (!periodOrders || periodOrders.length === 0) return null;
                          
                          const periodConfig = periodLabels[period];
                          const PeriodIcon = periodConfig.icon;
                          const isCurrent = period === currentPeriod;
                          const periodIndex = allPeriods.indexOf(period);
                          const isCompleted = periodIndex < currentIndex && period !== 'other';

                          // Render order card helper
                          const renderOrderCard = (order: typeof periodOrders[0]) => (
                            <div
                              key={order.id}
                              className="p-4 rounded-2xl bg-muted/50"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-primary text-sm sm:text-base">
                                      #{order.order_number || order.id.slice(-8).toUpperCase()}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        order.status === "collected"
                                          ? "bg-green-500/10 text-green-600"
                                          : order.status === "failed" || order.status === "expired"
                                            ? "bg-destructive/10 text-destructive"
                                            : order.status === "confirmed"
                                              ? "bg-blue-500/10 text-blue-600"
                                              : "bg-amber-500/10 text-amber-600"
                                      }`}
                                    >
                                      {order.status === 'confirmed' ? 'Approved' : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    <span className="text-sm font-medium">
                                      {order.user_name || "Guest"}
                                    </span>
                                    <span className="text-muted-foreground">•</span>
                                    <span className="text-sm font-bold text-primary">
                                      ₹{order.total}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {new Date(order.created_at).toLocaleDateString("en-IN", {
                                      day: "2-digit",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Order Items */}
                              {order.items && order.items.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border/50">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Items</p>
                                  <div className="flex flex-wrap gap-2">
                                    {order.items.map((item, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background text-xs font-medium border border-border/50"
                                      >
                                        <span className="text-foreground">{item.name}</span>
                                        <span className="text-muted-foreground">×{item.quantity}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Mark Token Used Button - for confirmed orders that haven't been scanned */}
                              {order.status === 'confirmed' && !order.is_used && (
                                <div className="mt-3 pt-3 border-t border-border/50">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full gap-2 text-green-600 border-green-600/30 hover:bg-green-500/10"
                                    onClick={() => {
                                      markTokenUsed.mutate(order.id, {
                                        onSuccess: () => {
                                          toast.success(`Token #${order.order_number?.slice(-4) || order.id.slice(-4)} marked as used`);
                                        },
                                        onError: () => {
                                          toast.error('Failed to mark token as used');
                                        },
                                      });
                                    }}
                                    disabled={markTokenUsed.isPending}
                                  >
                                    {markTokenUsed.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4" />
                                    )}
                                    Mark Token Used
                                  </Button>
                                </div>
                              )}
                            </div>
                          );

                          // For non-current periods, use Collapsible (collapsed by default)
                          if (!isCurrent) {
                            const isFuture = periodIndex > currentIndex && period !== 'other';
                            return (
                              <Collapsible key={period} defaultOpen={false} className="space-y-3">
                                <CollapsibleTrigger className="w-full group">
                                  <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                                    <div className={`p-1.5 rounded-full ${periodConfig.color}`}>
                                      <PeriodIcon className="h-4 w-4" />
                                    </div>
                                    <span className="font-semibold">{periodConfig.name}</span>
                                    {isCompleted && (
                                      <span className="text-xs font-medium bg-muted-foreground/20 text-muted-foreground px-2 py-0.5 rounded-full">
                                        Completed
                                      </span>
                                    )}
                                    {isFuture && (
                                      <span className="text-xs font-medium bg-blue-500/20 text-blue-600 px-2 py-0.5 rounded-full">
                                        Upcoming
                                      </span>
                                    )}
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">
                                      {periodOrders.length} orders
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-3">
                                  {periodOrders.slice(0, 10).map(renderOrderCard)}
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          }

                          // For current period, show expanded
                          return (
                            <div key={period} className="space-y-3">
                              {/* Period Header */}
                              <div className="flex items-center gap-2 sticky top-0 py-2 bg-primary/5 px-3 rounded-lg -mx-3">
                                <div className={`p-1.5 rounded-full ${periodConfig.color}`}>
                                  <PeriodIcon className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">{periodConfig.name}</span>
                                <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full animate-pulse">
                                  NOW
                                </span>
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">
                                  {periodOrders.length} orders
                                </span>
                              </div>
                              
                              {/* Period Orders */}
                              {periodOrders.slice(0, 10).map(renderOrderCard)}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Menu Tab */}
          <TabsContent value="menu" className="space-y-4">
            <Card className="rounded-2xl card-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Menu Items</CardTitle>
                <Dialog
                  open={isAddDialogOpen}
                  onOpenChange={(open) => {
                    setIsAddDialogOpen(open);
                    if (!open) resetForm();
                  }}
                >
                  <DialogTrigger asChild>
                    <Button className="rounded-full gap-2">
                      <Plus size={16} />
                      Add Item
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Name *</Label>
                        <Input
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Item name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity (Stock) *</Label>
                        <Input
                          type="number"
                          value={formData.quantity}
                          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                          placeholder="e.g., 150"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Price *</Label>
                          <Input
                            type="number"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Category</Label>
                          <Select
                            value={formData.category}
                            onValueChange={(value) => setFormData({ ...formData, category: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ADMIN_CATEGORIES.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Image</Label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                        />

                        {imagePreview || formData.image ? (
                          <div className="relative">
                            <img
                              src={imagePreview || formData.image}
                              alt="Preview"
                              className="w-full h-32 object-cover rounded-xl border border-border"
                            />
                            <button
                              type="button"
                              onClick={clearImage}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-32 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
                          >
                            {isUploading ? (
                              <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            ) : (
                              <>
                                <Upload className="w-6 h-6 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Click to upload image</span>
                              </>
                            )}
                          </button>
                        )}

                        {!imagePreview && !formData.image && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full text-xs text-primary hover:underline"
                          >
                            or drag and drop
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Available Time Periods</Label>
                        <div className="flex flex-wrap gap-2">
                          {TIME_PERIODS.map((period) => (
                            <button
                              key={period.id}
                              type="button"
                              onClick={() => {
                                const periods = formData.available_time_periods.includes(period.id)
                                  ? formData.available_time_periods.filter((p) => p !== period.id)
                                  : [...formData.available_time_periods, period.id];
                                setFormData({ ...formData, available_time_periods: periods });
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                formData.available_time_periods.includes(period.id)
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              {period.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Available Days</Label>
                        <div className="flex flex-wrap gap-2">
                          {AVAILABLE_DAYS.map((day) => {
                            const isMonSat = day.id === "mon-sat";
                            const isSelected = isMonSat 
                              ? formData.available_days.length === 6 && ["mon", "tue", "wed", "thu", "fri", "sat"].every(d => formData.available_days.includes(d))
                              : formData.available_days.includes(day.id);
                            
                            return (
                              <button
                                key={day.id}
                                type="button"
                                onClick={() => {
                                  if (isMonSat) {
                                    // Toggle all days
                                    if (isSelected) {
                                      setFormData({ ...formData, available_days: [] });
                                    } else {
                                      setFormData({ ...formData, available_days: ["mon", "tue", "wed", "thu", "fri", "sat"] });
                                    }
                                  } else {
                                    // Toggle individual day
                                    const days = formData.available_days.includes(day.id)
                                      ? formData.available_days.filter((d) => d !== day.id)
                                      : [...formData.available_days, day.id];
                                    setFormData({ ...formData, available_days: days });
                                  }
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                  isSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                }`}
                              >
                                {day.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Vegetarian</Label>
                        <Switch
                          checked={formData.is_veg}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_veg: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Popular</Label>
                        <Switch
                          checked={formData.is_popular}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_popular: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Available</Label>
                        <Switch
                          checked={formData.is_available}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_available: checked })}
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={handleSubmit}
                        disabled={createMenuItem.isPending || updateMenuItem.isPending}
                      >
                        {createMenuItem.isPending || updateMenuItem.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : editingItem ? (
                          "Update Item"
                        ) : (
                          "Add Item"
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {menuLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : menuItems.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No menu items yet</p>
                ) : (
                  <div className="space-y-3">
                    {menuItems.map((item) => {
                      const categoryName = ADMIN_CATEGORIES.find((c) => c.id === item.category)?.name || item.category;
                      return (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {item.image && (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover flex-shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm sm:text-base truncate">{item.name}</h3>
                                {item.is_veg && (
                                  <span className="w-4 h-4 rounded border-2 border-green-500 flex items-center justify-center flex-shrink-0">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                  </span>
                                )}
                              </div>
                              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                {categoryName} • ₹{item.price} • Stock: {item.quantity ?? 0}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 justify-end flex-shrink-0">
                            <Switch
                              checked={item.is_available ?? true}
                              onCheckedChange={() => handleToggleAvailability(item.id, item.is_available ?? true)}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full text-xs sm:text-sm"
                              onClick={() => handleEdit(item)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="rounded-full text-destructive hover:bg-destructive hover:text-destructive-foreground h-8 w-8"
                              onClick={() => handleDelete(item.id)}
                            >
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
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
