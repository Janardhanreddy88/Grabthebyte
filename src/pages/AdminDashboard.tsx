import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAuth } from "@/context/AuthContext";
import { usePrinter } from "@/context/PrinterContext"; 
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils"; 
import { format } from "date-fns"; 
import {
  useAdminMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useAdminOrders,
  useOrderStats,
  useMarkTokenUsed,
} from "@/hooks/useAdminData";
import { useMonthlyAnalytics } from "@/hooks/useMonthlyAnalytics";
import { useWeeklyAnalytics } from "@/hooks/useWeeklyAnalytics";
import { useTodayAnalytics } from "@/hooks/useTodayAnalytics";
import {
  LogOut, QrCode, LayoutDashboard, UtensilsCrossed, TrendingUp,
  Package, Users, User, Mail, Phone, Building2, BellRing, Printer, 
  BluetoothOff, Settings, Landmark, ShieldCheck, Edit, Lock, Info, CalendarClock, CheckCircle2,
  CalendarDays, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, CornerDownRight, Wallet, RefreshCw, Receipt, Loader2, Calendar as CalendarIcon
} from "lucide-react";
import { AdminAnalyticsTab } from "@/components/admin/AdminAnalyticsTab";
import { AdminOrdersTab } from "@/components/admin/AdminOrdersTab";
import { AdminMenuTab } from "@/components/admin/AdminMenuTab";
import { useCampusBouncer } from '@/hooks/useCampusBouncer'; 
import { Badge } from "@/components/ui/badge"; 

// 🦅 THE GOLDEN FORMULA
const getTrueCanteenRevenue = (o: any) => {
  const rawTotal = Number(o.total) || 0;
  const platFee = Number(o.platform_fee) || 0;
  const discAmt = Number(o.discount_amount) || 0;
  const sponsor = o.discount_sponsor;
  
  let baseEarnings = rawTotal - platFee;
  if (sponsor === 'platform') {
    baseEarnings += discAmt;
  }
  return Math.max(0, baseEarnings);
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout: pinLogout } = useAdminAuth();
  const { logout: authLogout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  useCampusBouncer();
  
  const { isPrinterConnected, printTicket } = usePrinter();
  
  const printerRef = useRef(isPrinterConnected);
  const printTicketRef = useRef(printTicket);

  useEffect(() => {
    printerRef.current = isPrinterConnected;
    printTicketRef.current = printTicket;
  }, [isPrinterConnected, printTicket]);

  const [profileData, setProfileData] = useState<{
    full_name: string | null;
    email: string | null;
    phone: string | null;
    campus_name: string | null;
    campus_code: string | null;
    campus_id: string | null;
    razorpay_account_id: string | null;
    upi_id: string | null;
    bank_account_name: string | null;
    bank_account_number: string | null;
    bank_ifsc: string | null;
  } | null>(null);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSettlementInfoOpen, setIsSettlementInfoOpen] = useState(false); 
  const [showHolidayExample, setShowHolidayExample] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const [activeSettingsTab, setActiveSettingsTab] = useState<'profile' | 'settlements' | 'payments'>('profile');
  
  const [settlements, setSettlements] = useState<any[]>([]);
  
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  
  const [paymentDateFilter, setPaymentDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
  });

  const playNotificationSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime + startTime);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime + startTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + startTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startTime + duration);
        oscillator.start(audioCtx.currentTime + startTime);
        oscillator.stop(audioCtx.currentTime + startTime + duration);
      };
      playTone(880, 0, 0.2); 
      playTone(1108.73, 0.15, 0.4); 
    } catch (e) {
      console.log("Audio play failed", e);
    }
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select(`full_name, email, phone, campus_id, campuses:campus_id (name, code, razorpay_account_id, upi_id, bank_account_name, bank_account_number, bank_ifsc)`)
        .eq('user_id', session.user.id)
        .maybeSingle();
        
      if (data) {
        const campusData = data.campuses as any;
        setProfileData({
          full_name: data.full_name, 
          email: data.email, 
          phone: data.phone,
          campus_name: campusData?.name || null, 
          campus_code: campusData?.code || null,
          campus_id: data.campus_id,
          razorpay_account_id: campusData?.razorpay_account_id || null,
          upi_id: campusData?.upi_id || null,
          bank_account_name: campusData?.bank_account_name || null,
          bank_account_number: campusData?.bank_account_number || null,
          bank_ifsc: campusData?.bank_ifsc || null,
        });
      }
    };
    fetchProfile();
  }, []);

  const fetchPaymentsList = useCallback(async () => {
    if (!profileData?.campus_id) return;
    setIsLoadingPayments(true);
    try {
      let query = supabase
        .from('orders')
        // 🦅 THE FIX: We added platform_fee, discount_amount, and discount_sponsor!
        .select('id, order_number, total, platform_fee, discount_amount, discount_sponsor, payment_status, status, notes, rejection_reason, created_at, customer_name, customer_phone, customer_email, razorpay_payment_id')
        .eq('campus_id', profileData.campus_id)
        .order('created_at', { ascending: false });

      if (paymentDateFilter) {
        const [year, month, day] = paymentDateFilter.split('-').map(Number);
        const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
        const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
        query = query.gte('created_at', startDate.toISOString())
                     .lte('created_at', endDate.toISOString());
      } else {
        query = query.limit(50);
      }
        
      const { data, error } = await query;

      if (error) throw error;
      if (data) {
        setPaymentsList(data);
      }
    } catch (err) {
      console.error("Error fetching payments:", err);
    } finally {
      setIsLoadingPayments(false);
    }
  }, [profileData?.campus_id, paymentDateFilter]);

  useEffect(() => {
    if (activeSettingsTab === 'payments') {
      fetchPaymentsList();
    }
  }, [activeSettingsTab, fetchPaymentsList]);

  useEffect(() => {
    if (!profileData?.campus_id) return;
    
    const fetchSettlements = async () => {
      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .eq('campus_id', profileData.campus_id)
        .order('settled_at', { ascending: false })
        .limit(10); 
        
      if (data) {
        setSettlements(data);
      }
    };
    
    fetchSettlements();

    const settlementChannel = supabase
      .channel('realtime-settlements')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'settlements', 
          filter: `campus_id=eq.${profileData.campus_id}` 
        },
        async (payload) => {
          playNotificationSound();
          toast({
            title: "💰 Settlement Processed!",
            description: `A payout of ₹${Number(payload.new.amount).toFixed(2)} has been deposited to your bank account.`,
            className: "bg-emerald-600 text-white border-none shadow-lg",
            duration: 8000,
          });
          fetchSettlements();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(settlementChannel); };
  }, [profileData?.campus_id, toast, playNotificationSound]);

  const handleOpenEdit = () => {
    setEditForm({
      full_name: profileData?.full_name || '',
      phone: profileData?.phone || '',
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    setIsUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error("Authentication error");

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          phone: editForm.phone,
        })
        .eq('user_id', session.user.id);

      if (profileError) throw profileError;

      if (profileData?.campus_id) {
        const { error: campusError } = await supabase
          .from('campuses')
          .update({
            owner_name: editForm.full_name,
            owner_phone: editForm.phone,
          } as any)
          .eq('id', profileData.campus_id);

        if (campusError) {
          console.error("Failed to sync with Campus directory:", campusError);
        }
      }

      setProfileData(prev => prev ? {
        ...prev,
        full_name: editForm.full_name,
        phone: editForm.phone,
      } : null);

      toast({
        title: "Profile Updated",
        description: "Your details have been saved and synced across the platform.",
        className: "bg-green-600 text-white border-none",
      });
      setIsEditDialogOpen(false);

    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (!profileData?.campus_id) return;

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `campus_id=eq.${profileData.campus_id}` },
        async (payload) => {
          if (payload.new.status === 'confirmed' && payload.old.status === 'pending') {
            playNotificationSound();
            toast({
              title: "🔔 New Order Received!",
              description: `Order #${payload.new.order_number} has been paid for.`,
              className: "bg-green-600 text-white border-none",
              duration: 5000,
            });

            queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
            queryClient.invalidateQueries({ queryKey: ["today-analytics"] });
            
            if (activeSettingsTab === 'payments') {
               const todayStr = format(new Date(), 'yyyy-MM-dd');
               if (paymentDateFilter === todayStr) fetchPaymentsList();
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profileData?.campus_id, queryClient, toast, playNotificationSound, activeSettingsTab, fetchPaymentsList, paymentDateFilter]);

  const { data: menuItems = [], isLoading: menuLoading } = useAdminMenuItems();
  const { data: orders = [], isLoading: ordersLoading } = useAdminOrders();
  const { data: stats } = useOrderStats();
  const { data: monthlyStats, isLoading: monthlyLoading, selectedMonth: monthlySelectedMonth, setSelectedMonth: monthlySetSelectedMonth, monthOptions: monthlyMonthOptions } = useMonthlyAnalytics();
  const { data: weeklyStats, isLoading: weeklyLoading } = useWeeklyAnalytics();
  const { data: todayStats, isLoading: todayLoading, selectedDate: todaySelectedDate, setSelectedDate: todaySetSelectedDate } = useTodayAnalytics();
  const createMenuItem = useCreateMenuItem();
  const updateMenuItem = useUpdateMenuItem();
  const deleteMenuItem = useDeleteMenuItem();
  const markTokenUsed = useMarkTokenUsed();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'AD';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSignOut = async () => {
    if (pinLogout) pinLogout();
    if (authLogout) await authLogout();
    await supabase.auth.signOut();
    
    localStorage.removeItem('campus_code');
    localStorage.removeItem('campus_name');
    localStorage.removeItem('campus_id');
    localStorage.removeItem('selected_campus');
    
    navigate("/"); 
  };

  const lowStockItems = menuItems
    .filter((item) => (item.quantity ?? 0) <= 10)
    .map((item) => ({
      id: item.id, name: item.name, quantity: item.quantity ?? 0,
      category: item.category || 'other',
    }))
    .sort((a, b) => a.quantity - b.quantity);

  const handleRestockClick = (itemId: string) => {};

  const formatSettlementDates = (settledDateStr: string) => {
    if (!settledDateStr) return { depositDate: 'Pending', salesDate: 'N/A' };
    const settledDate = new Date(settledDateStr);
    const depositDate = settledDate.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    const salesDateObj = new Date(settledDate);
    salesDateObj.setDate(salesDateObj.getDate() - 2);
    const salesDate = salesDateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    return { depositDate, salesDate };
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border safe-top">
        <div className="flex items-center justify-between px-3 lg:px-5 h-13">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            
            {isPrinterConnected ? (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/15 text-emerald-600 border border-emerald-500/20 rounded-lg text-xs font-bold mr-1">
                <Printer size={14} /> Printer Ready
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-500/15 text-orange-600 border border-orange-500/20 rounded-lg text-xs font-bold mr-1">
                <BluetoothOff size={14} /> No Printer
              </div>
            )}

            <Button onClick={() => navigate("/menu")} variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs font-semibold border-border/60">
              <Users size={15} />
              <span className="hidden sm:inline">Student View</span>
            </Button>
            
            <Button onClick={() => navigate("/kiosk-scanner", { state: { fromAdmin: true } })} size="sm" className="gap-1.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              <QrCode size={15} />
              <span className="hidden sm:inline">🚀 Kiosk</span>
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <button className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xs hover:opacity-90 transition-opacity">
                  {getInitials(profileData?.full_name)}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0">
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                      {getInitials(profileData?.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{profileData?.full_name || 'Admin'}</p>
                      <p className="text-xs text-muted-foreground">Administrator</p>
                    </div>
                  </div>
                  <Separator className="mb-3" />
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5 text-sm">
                      <Mail size={14} className="text-muted-foreground shrink-0" />
                      <span className="truncate">{profileData?.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <Phone size={14} className="text-muted-foreground shrink-0" />
                      <span>{profileData?.phone || 'Not set'}</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <Building2 size={14} className="text-muted-foreground shrink-0" />
                      <span className="truncate">{profileData?.campus_name || 'N/A'} ({profileData?.campus_code || 'N/A'})</span>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="p-2">
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 h-10 text-sm" onClick={handleSignOut}>
                    <LogOut size={15} /> Sign Out
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>

      <main className="p-3 lg:p-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">Manage your canteen</p>
          </div>
        </div>

        <Tabs defaultValue="analytics" className="space-y-4">
          <TabsList className="bg-muted rounded-full p-0.5 h-auto flex-wrap justify-start">
            <TabsTrigger value="analytics" className="gap-1.5 rounded-full px-4 py-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <TrendingUp size={15} className="hidden sm:block" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-1.5 rounded-full px-4 py-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Package size={15} className="hidden sm:block" /> Orders
            </TabsTrigger>
            <TabsTrigger value="menu" className="gap-1.5 rounded-full px-4 py-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <UtensilsCrossed size={15} className="hidden sm:block" /> Menu
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 rounded-full px-4 py-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Settings size={15} className="hidden sm:block" /> Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <AdminAnalyticsTab
              todayStats={todayStats} todayLoading={todayLoading} todaySelectedDate={todaySelectedDate} todaySetSelectedDate={todaySetSelectedDate}
              weeklyStats={weeklyStats} weeklyLoading={weeklyLoading} monthlyStats={monthlyStats} monthlyLoading={monthlyLoading}
              monthlySelectedMonth={monthlySelectedMonth} monthlySetSelectedMonth={monthlySetSelectedMonth} monthlyMonthOptions={monthlyMonthOptions}
              lowStockItems={lowStockItems} onRestockClick={handleRestockClick}
            />
          </TabsContent>

          <TabsContent value="orders">
            <AdminOrdersTab
              orders={orders} ordersLoading={ordersLoading} markTokenUsed={markTokenUsed} menuItems={menuItems}
            />
          </TabsContent>

          <TabsContent value="menu">
            <AdminMenuTab
              menuItems={menuItems} menuLoading={menuLoading} createMenuItem={createMenuItem} updateMenuItem={updateMenuItem} deleteMenuItem={deleteMenuItem}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="flex flex-col lg:flex-row gap-6">
              
              <div className="w-full lg:w-64 shrink-0 space-y-2">
                <Button 
                  variant={activeSettingsTab === 'profile' ? "default" : "ghost"} 
                  className={cn("w-full justify-start gap-3 h-11", activeSettingsTab === 'profile' ? "shadow-sm font-bold bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50")}
                  onClick={() => setActiveSettingsTab('profile')}
                >
                  <User size={18} /> Profile & Banking
                </Button>
                <Button 
                  variant={activeSettingsTab === 'settlements' ? "default" : "ghost"} 
                  className={cn("w-full justify-start gap-3 h-11", activeSettingsTab === 'settlements' ? "shadow-sm font-bold bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50")}
                  onClick={() => setActiveSettingsTab('settlements')}
                >
                  <Landmark size={18} /> Settlements
                </Button>
                <Button 
                  variant={activeSettingsTab === 'payments' ? "default" : "ghost"} 
                  className={cn("w-full justify-start gap-3 h-11", activeSettingsTab === 'payments' ? "shadow-sm font-bold bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50")}
                  onClick={() => setActiveSettingsTab('payments')}
                >
                  <Wallet size={18} /> Payments
                </Button>
              </div>

              <div className="flex-1 min-w-0">
                
                {activeSettingsTab === 'profile' && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                      <div>
                        <h2 className="text-xl font-bold">Profile Details</h2>
                        <p className="text-sm text-muted-foreground">Manage your account and banking info</p>
                      </div>
                      <Button onClick={handleOpenEdit} size="sm" className="gap-2 bg-primary text-primary-foreground shrink-0">
                        <Edit size={16} /> Edit Profile
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <Card className="border shadow-sm">
                        <CardHeader className="bg-muted/30 pb-4">
                          <CardTitle className="text-lg flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Personal Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                          <div className="grid gap-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name</p>
                            <p className="font-semibold text-sm">{profileData?.full_name || 'Not provided'}</p>
                          </div>
                          <div className="grid gap-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Address</p>
                            <p className="font-semibold text-sm">{profileData?.email || 'Not provided'}</p>
                          </div>
                          <div className="grid gap-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone Number</p>
                            <p className="font-semibold text-sm">{profileData?.phone || 'Not provided'}</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border shadow-sm">
                        <CardHeader className="bg-muted/30 pb-4">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Landmark className="w-5 h-5 text-emerald-600" /> Bank & Campus
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                          
                          <div className="grid gap-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Campus Branch</p>
                            <p className="font-semibold text-sm">{profileData?.campus_name || 'Not assigned'} ({profileData?.campus_code})</p>
                            {profileData?.campus_id && (
                              <p className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded w-fit mt-1 border border-border/50 select-all">
                                ID: {profileData.campus_id}
                              </p>
                            )}
                          </div>
                          
                          <Separator />
                          
                          <div className="grid gap-1">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                              Razorpay Linked Account <Lock size={10} className="text-muted-foreground" />
                            </p>
                            {profileData?.razorpay_account_id ? (
                              <div className="flex items-center gap-2 mt-1">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <p className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                  {profileData.razorpay_account_id}
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="flex h-2 w-2 rounded-full bg-red-500"></span>
                                <p className="text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded border border-red-100">Bank Account Not Linked</p>
                              </div>
                            )}
                          </div>

                          {profileData?.bank_account_number && (
                            <div className="bg-muted/30 p-3 rounded-lg space-y-2 mt-2 border border-border/50 relative">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Traditional Bank Info</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <p className="text-muted-foreground text-[10px] uppercase">Account Name</p>
                                  <p className="font-medium truncate">{profileData.bank_account_name || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-[10px] uppercase">IFSC Code</p>
                                  <p className="font-medium">{profileData.bank_ifsc || 'N/A'}</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-muted-foreground text-[10px] uppercase">Account Number</p>
                                  <p className="font-mono font-medium">{profileData.bank_account_number}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {activeSettingsTab === 'settlements' && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                      <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                          <Landmark className="h-6 w-6 text-emerald-600" /> 
                          Bank Payouts
                        </h2>
                        <p className="text-sm text-muted-foreground">Track money deposited to your bank</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setIsSettlementInfoOpen(true);
                          setShowHolidayExample(false); 
                        }}
                        className="gap-2 text-blue-700 border-blue-200 hover:bg-blue-50 bg-blue-50/50 shrink-0 shadow-sm"
                      >
                        <CalendarDays className="h-4 w-4" /> My Settlement Cycle
                      </Button>
                    </div>

                    <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                      <div className="grid grid-cols-3 bg-muted/50 p-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
                        <div className="col-span-2">Payout Details</div>
                        <div className="text-right">Amount</div>
                      </div>
                      
                      <div className="divide-y divide-border">
                        {settlements.length === 0 ? (
                          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                            <CalendarClock className="h-12 w-12 text-muted-foreground/30 mb-4" />
                            <p className="font-semibold text-base text-foreground">No payouts recorded yet.</p>
                            <p className="text-sm mt-1">Your settlements will appear here automatically once processed by Razorpay.</p>
                          </div>
                        ) : (
                          settlements.map((settlement) => {
                            const dates = formatSettlementDates(settlement.settled_at);
                            
                            return (
                              <div key={settlement.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                <div>
                                  <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    Bank Deposit: {dates.depositDate}
                                  </h4>
                                  
                                  <p className="text-xs text-blue-800/80 bg-blue-50/50 border border-blue-100 px-2 py-1 rounded-md flex items-center gap-1.5 mt-1.5 w-fit">
                                    <CalendarClock size={12} className="opacity-70 text-blue-600" />
                                    <span>Sales from: <strong className="text-blue-900">{dates.salesDate}</strong></span>
                                  </p>
                                  
                                  <p className="text-[10px] text-muted-foreground mt-2 font-mono uppercase bg-muted px-2 py-0.5 rounded-md inline-block">
                                    Ref: {settlement.utr_number || 'Processing'}
                                  </p>
                                </div>
                                
                                <div className="text-right">
                                  <p className="text-xl font-black text-emerald-600 tracking-tight">
                                    ₹{Number(settlement.amount).toFixed(2)}
                                  </p>
                                  <p className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full inline-block mt-1">
                                    {settlement.status}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW 3: SEPARATED PAYMENTS & ORDERS LEDGER 🔥 */}
                {activeSettingsTab === 'payments' && (
                  <div className="space-y-4 animate-in fade-in duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                      <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                          <Receipt className="h-6 w-6 text-primary" /> 
                          Payments Ledger
                        </h2>
                        <p className="text-sm text-muted-foreground">Real-time breakdown of all student transactions</p>
                      </div>
                      
                      <div className="flex items-center gap-2 self-start sm:self-auto bg-muted/30 p-1 rounded-lg border">
                        <div className="relative">
                          <Input 
                            type="date" 
                            value={paymentDateFilter}
                            onChange={(e) => setPaymentDateFilter(e.target.value)}
                            className="h-8 text-xs font-semibold border-none shadow-none bg-transparent w-[120px] focus-visible:ring-0"
                          />
                        </div>
                        <Button variant="secondary" size="sm" onClick={fetchPaymentsList} className="gap-1.5 shadow-sm h-7 px-3 text-xs" disabled={isLoadingPayments}>
                          <RefreshCw size={12} className={isLoadingPayments ? "animate-spin" : ""} /> 
                          <span className="hidden sm:inline">Refresh</span>
                        </Button>
                      </div>
                    </div>
                    
                    <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                      <div className="grid grid-cols-5 md:grid-cols-7 items-center bg-muted/50 p-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b">
                        <div className="col-span-2">Transaction Details</div>
                        <div className="hidden md:block col-span-2">Customer Info</div>
                        <div className="text-center">Payment</div>
                        <div className="text-center">Order</div>
                        <div className="text-right">Net Earning</div>
                      </div>
                      
                      <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                        {isLoadingPayments ? (
                          <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        ) : paymentsList.length === 0 ? (
                          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center">
                            <CalendarIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                            <p className="font-semibold text-base text-foreground">No payments on this date.</p>
                            <p className="text-sm mt-1">Try selecting a different day from the calendar above.</p>
                          </div>
                        ) : (
                          paymentsList.map((payment) => {
                            const rawPaymentStatus = (payment.payment_status || 'pending').toLowerCase();
                            const rawOrderStatus = (payment.status || 'pending').toLowerCase();

                            const isPaymentSuccess = ['completed', 'paid', 'success', 'captured'].includes(rawPaymentStatus);
                            const isPaymentFailed = ['failed', 'rejected', 'refunded'].includes(rawPaymentStatus);
                            
                            const isOrderFailedOrCancelled = ['cancelled', 'rejected', 'failed', 'expired'].includes(rawOrderStatus);
                            
                            const isCancelled = isPaymentFailed || isOrderFailedOrCancelled;

                            return (
                              <div key={payment.id} className="p-3 grid grid-cols-5 md:grid-cols-7 items-center hover:bg-muted/30 transition-colors text-sm">
                                <div className="col-span-2">
                                  <div className="flex flex-col gap-1">
                                    <p className={cn("font-bold", isCancelled ? "text-muted-foreground" : "text-foreground")}>
                                      #{payment.order_number}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                      <Clock size={10} /> {format(new Date(payment.created_at), 'MMM d, h:mm a')}
                                    </p>
                                    {payment.razorpay_payment_id && (
                                      <p className="text-[9px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded w-fit border border-border/50 max-w-[140px] truncate" title={payment.razorpay_payment_id}>
                                        PID: {payment.razorpay_payment_id}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                
                                <div className={cn("hidden md:block col-span-2 pr-2", isCancelled ? "text-muted-foreground/50" : "text-foreground")}>
                                   <div className="flex items-center gap-2">
                                     <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[11px] font-bold shrink-0">
                                       {(payment.customer_name || 'G')[0].toUpperCase()}
                                     </div>
                                     <div className="flex flex-col">
                                       <span className="font-medium text-xs truncate max-w-[150px]">{payment.customer_name || 'Guest User'}</span>
                                       {payment.customer_email ? (
                                         <span className="text-[10px] text-muted-foreground truncate max-w-[160px]" title={payment.customer_email}>{payment.customer_email}</span>
                                       ) : payment.customer_phone ? (
                                         <span className="text-[10px] text-muted-foreground">{payment.customer_phone}</span>
                                       ) : (
                                         <span className="text-[9px] text-muted-foreground uppercase tracking-wider">No contact info</span>
                                       )}
                                     </div>
                                   </div>
                                </div>

                                <div className="text-center flex justify-center">
                                  <Badge className={cn(
                                    "border-none text-[9px] px-1.5 capitalize",
                                    isPaymentSuccess ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                                    rawPaymentStatus === 'refunded' ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                                    isPaymentFailed ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                    "bg-orange-100 text-orange-700 hover:bg-orange-100"
                                  )}>
                                    {rawPaymentStatus}
                                  </Badge>
                                </div>

                                <div className="text-center flex justify-center">
                                  <span className={cn(
                                    "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm border",
                                    ['completed', 'delivered'].includes(rawOrderStatus) ? "bg-green-50 text-green-600 border-green-200" :
                                    rawOrderStatus === 'preparing' ? "bg-blue-50 text-blue-600 border-blue-200" :
                                    rawOrderStatus === 'ready' ? "bg-indigo-50 text-indigo-600 border-indigo-200" :
                                    isOrderFailedOrCancelled ? "bg-red-50 text-red-600 border-red-200 opacity-70" :
                                    "bg-orange-50 text-orange-600 border-orange-200"
                                  )}>
                                    {rawOrderStatus}
                                  </span>
                                </div>

                                {/* 🦅 THE FIX: The UI now maps the correct net earning per order! */}
                                <div className={cn("text-right font-black text-base", isCancelled ? "text-muted-foreground line-through opacity-50" : "text-foreground")}>
                                  ₹{getTrueCanteenRevenue(payment).toFixed(2)}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <Dialog open={isSettlementInfoOpen} onOpenChange={setIsSettlementInfoOpen}>
              <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden">
                <div className="px-6 pt-6 pb-6">
                  <DialogHeader>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <span className="text-sm font-semibold text-foreground">Settlement Schedule</span>
                    </div>
                    <DialogTitle className="sr-only">Settlement Schedule Info</DialogTitle>
                  </DialogHeader>
                  
                  <div className="flex border-b mb-6 mt-4">
                    <div className="pb-2 border-b-2 border-foreground px-1">
                      <span className="text-sm font-semibold">2 day settlement (T+2)</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 mb-8">
                    <div className="bg-emerald-500 text-white rounded-md p-1.5 shrink-0 mt-0.5">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">Payments received reach your bank account in 2 working days</h3>
                    </div>
                  </div>

                  <div className="relative flex justify-between items-start mb-10 px-2">
                    <div className="absolute top-4 left-14 right-14 h-[2px] bg-border border-dashed border-t-2 z-0"></div>

                    <div className="relative z-10 flex flex-col items-center w-1/3">
                      <div className="bg-background border border-emerald-500 text-emerald-600 rounded-full px-3 py-1.5 flex items-center gap-1.5 mb-3">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs font-semibold">DAY 0</span>
                      </div>
                      <p className="text-xs text-center text-muted-foreground px-2">Payment received from students</p>
                    </div>

                    <div className="relative z-10 flex flex-col items-center w-1/3">
                      <div className="bg-background border border-border rounded-full px-3 py-1.5 flex items-center gap-1.5 mb-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">DAY 1</span>
                      </div>
                    </div>

                    <div className="relative z-10 flex flex-col items-center w-1/3">
                      <div className="bg-background border border-emerald-500 text-emerald-600 rounded-full px-3 py-1.5 flex items-center gap-1.5 mb-3">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs font-semibold">DAY 2</span>
                      </div>
                      <p className="text-xs text-center text-muted-foreground px-2">Money transferred to your bank before 9 pm</p>
                    </div>
                  </div>

                  <div className="bg-amber-900/5 rounded-lg border border-amber-900/10 transition-all duration-300">
                    <div 
                      className="flex items-center gap-3 p-4 cursor-pointer hover:bg-amber-900/10 rounded-lg transition-colors"
                      onClick={() => setShowHolidayExample(!showHolidayExample)}
                    >
                      <div className="bg-amber-700 text-white rounded-md p-1.5 shrink-0">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-medium text-foreground flex-1">
                        Pay outs on bank holidays and weekends will be processed on the next working day.
                      </p>
                      <div className="flex items-center text-sm font-semibold text-blue-600 hover:underline whitespace-nowrap select-none">
                        View example {showHolidayExample ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                      </div>
                    </div>

                    {showHolidayExample && (
                      <div className="px-2 pb-6 pt-2 animate-in slide-in-from-top-2">
                        <div className="relative flex justify-between items-start px-2 mt-4">
                          <div className="absolute top-4 left-10 right-10 h-[2px] bg-amber-900/20 border-dashed border-t-2 z-0"></div>

                          <div className="relative z-10 flex flex-col items-center w-1/4">
                            <div className="bg-[#fef9f1] border border-emerald-500 text-emerald-600 rounded-full px-2 py-1 flex items-center gap-1 mb-2">
                              <CheckCircle className="h-3 w-3" />
                              <span className="text-[10px] font-semibold">DAY 0</span>
                            </div>
                            <p className="text-[10px] text-center text-muted-foreground leading-tight">Payment received from students</p>
                          </div>

                          <div className="relative z-10 flex flex-col items-center w-1/4">
                            <div className="bg-[#fef9f1] border border-border rounded-full px-2 py-1 flex items-center gap-1 mb-2 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span className="text-[10px] font-semibold">DAY 1</span>
                            </div>
                          </div>

                          <div className="relative z-10 flex flex-col items-center w-1/4">
                            <div className="bg-amber-600 border border-amber-600 text-white rounded-full px-2 py-1 flex items-center gap-1 mb-2 shadow-sm">
                              <CornerDownRight className="h-3 w-3" />
                              <span className="text-[10px] font-semibold tracking-wide">SKIPPED</span>
                            </div>
                            <p className="text-[10px] text-center text-muted-foreground leading-tight">If non-working day (bank holiday)</p>
                          </div>

                          <div className="relative z-10 flex flex-col items-center w-1/4">
                            <div className="bg-[#fef9f1] border border-emerald-500 text-emerald-600 rounded-full px-2 py-1 flex items-center gap-1 mb-2">
                              <CheckCircle className="h-3 w-3" />
                              <span className="text-[10px] font-semibold">DAY 2</span>
                            </div>
                            <p className="text-[10px] text-center text-muted-foreground leading-tight">Money transferred to your bank before 9 pm</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Edit Profile Details</DialogTitle>
                  <DialogDescription>Update your personal contact information.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input 
                      id="name" 
                      value={editForm.full_name} 
                      onChange={(e) => setEditForm({...editForm, full_name: e.target.value})} 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input 
                      id="phone" 
                      type="tel"
                      value={editForm.phone} 
                      onChange={(e) => setEditForm({...editForm, phone: e.target.value})} 
                      placeholder="e.g. +91 9876543210"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isUpdating}>Cancel</Button>
                  <Button onClick={handleSaveProfile} disabled={isUpdating}>
                    {isUpdating ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          </TabsContent>
        </Tabs>

      </main>
    </div>
  );
}