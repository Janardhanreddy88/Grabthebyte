import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAuth } from "@/context/AuthContext";
import { usePrinter } from "@/context/PrinterContext"; // 🌟 INJECTED PRINTER ENGINE
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
  Package, Users, User, Mail, Phone, Building2, BellRing, Printer, BluetoothOff
} from "lucide-react";
import { AdminAnalyticsTab } from "@/components/admin/AdminAnalyticsTab";
import { AdminOrdersTab } from "@/components/admin/AdminOrdersTab";
import { AdminMenuTab } from "@/components/admin/AdminMenuTab";


export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout: pinLogout } = useAdminAuth();
  const { logout: authLogout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // 🌟 PULL IN THE PRINTER CONTEXT
  const { isPrinterConnected, printTicket } = usePrinter();
  
  // 🌟 REFS FOR THE REALTIME LISTENER (Prevents stale closures)
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
  } | null>(null);

  // --- AUDIO HELPER FOR NOTIFICATIONS ---
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
      playTone(880, 0, 0.2); // A5
      playTone(1108.73, 0.15, 0.4); // C#6
    } catch (e) {
      console.log("Audio play failed, browser might be blocking auto-play", e);
    }
  }, []);

  // --- FETCH PROFILE ---
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select(`full_name, email, phone, campus_id, campuses:campus_id (name, code)`)
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (data) {
        const campusData = data.campuses as { name: string; code: string } | null;
        setProfileData({
          full_name: data.full_name, email: data.email, phone: data.phone,
          campus_name: campusData?.name || null, campus_code: campusData?.code || null,
          campus_id: data.campus_id 
        });
      }
    };
    fetchProfile();
  }, []);

  // --- 🌟 SUPABASE REALTIME LISTENER (WITH AUTO-PRINT) 🌟 ---
  useEffect(() => {
    if (!profileData?.campus_id) return;

    console.log("🔔 Listening for new orders for campus:", profileData.campus_id);

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE', 
          schema: 'public',
          table: 'orders',
          filter: `campus_id=eq.${profileData.campus_id}`,
        },
        async (payload) => {
          if (payload.new.status === 'confirmed' && payload.old.status === 'pending') {
            
            // 1. Play the sound & Show the toast
            playNotificationSound();
            toast({
              title: "🔔 New Order Received!",
              description: `Order #${payload.new.order_number} has been paid for.`,
              className: "bg-green-600 text-white border-none",
              duration: 5000,
            });

            // 2. Refresh UI
            queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
            queryClient.invalidateQueries({ queryKey: ["today-analytics"] });

            // 3. 🖨️ AUTO-PRINT THE TICKET!
            if (printerRef.current) {
              console.log("Printer is connected! Fetching items to print auto-token...");
              
              // We must fetch the items because the realtime payload only contains the top-level order row
              const { data: fullOrder } = await supabase
                .from('orders')
                .select('*, order_items(id, name, price, quantity)')
                .eq('id', payload.new.id)
                .single();

              if (fullOrder && fullOrder.order_items) {
                printTicketRef.current({
                  orderNumber: fullOrder.order_number,
                  items: fullOrder.order_items.map((i: any) => ({
                    name: i.name, quantity: i.quantity, price: Number(i.price)
                  })),
                  totalAmount: Number(fullOrder.total),
                  customerName: fullOrder.customer_name || 'Customer',
                  createdAt: fullOrder.created_at
                });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileData?.campus_id, queryClient, toast, playNotificationSound]);

  // Hooks
  const { data: menuItems = [], isLoading: menuLoading } = useAdminMenuItems();
  const { data: orders = [], isLoading: ordersLoading } = useAdminOrders();
  const { data: stats } = useOrderStats();
  const { data: monthlyStats, isLoading: monthlyLoading, selectedMonth: monthlySelectedMonth, setSelectedMonth: monthlySetSelectedMonth, monthOptions: monthlyMonthOptions } = useMonthlyAnalytics();
  const { data: weeklyStats, isLoading: weeklyLoading } = useWeeklyAnalytics();
  const { data: todayStats, isLoading: todayLoading } = useTodayAnalytics();
  const createMenuItem = useCreateMenuItem();
  const updateMenuItem = useUpdateMenuItem();
  const deleteMenuItem = useDeleteMenuItem();
  const markTokenUsed = useMarkTokenUsed();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'AD';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSignOut = async () => {
    pinLogout();
    await authLogout();
    navigate("/auth?logout=true");
  };

  // Low stock items
  const lowStockItems = menuItems
    .filter((item) => (item.quantity ?? 0) <= 10)
    .map((item) => ({
      id: item.id, name: item.name, quantity: item.quantity ?? 0,
      category: ADMIN_CATEGORIES.find((c) => c.id === item.category)?.name || item.category,
    }))
    .sort((a, b) => a.quantity - b.quantity);

  const handleRestockClick = (itemId: string) => {};

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-md border-b border-border safe-top">
        <div className="flex items-center justify-between px-3 lg:px-5 h-13">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            
            {/* Printer Status Indicator for the Dashboard */}
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
            
            {/* 🌟 THE MAGIC FLAG ADDED HERE 🌟 */}
            <Button onClick={() => navigate("/kiosk-scanner", { state: { fromAdmin: true } })} size="sm" className="gap-1.5 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              <QrCode size={15} />
              <span className="hidden sm:inline">🚀 Kiosk</span>
            </Button>

            {/* Profile Popover */}
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
                    <div className="flex items-center gap-2.5 text-sm"><Mail size={14} className="text-muted-foreground shrink-0" /><span className="truncate">{profileData?.email || 'N/A'}</span></div>
                    <div className="flex items-center gap-2.5 text-sm"><Phone size={14} className="text-muted-foreground shrink-0" /><span>{profileData?.phone || 'Not set'}</span></div>
                    <div className="flex items-center gap-2.5 text-sm"><Building2 size={14} className="text-muted-foreground shrink-0" /><span className="truncate">{profileData?.campus_name || 'N/A'} ({profileData?.campus_code || 'N/A'})</span></div>
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
          </TabsList>

          <TabsContent value="analytics">
            <AdminAnalyticsTab
              todayStats={todayStats}
              todayLoading={todayLoading}
              weeklyStats={weeklyStats}
              weeklyLoading={weeklyLoading}
              monthlyStats={monthlyStats}
              monthlyLoading={monthlyLoading}
              monthlySelectedMonth={monthlySelectedMonth}
              monthlySetSelectedMonth={monthlySetSelectedMonth}
              monthlyMonthOptions={monthlyMonthOptions}
              lowStockItems={lowStockItems}
              onRestockClick={handleRestockClick}
            />
          </TabsContent>

          <TabsContent value="orders">
            <AdminOrdersTab
              orders={orders}
              ordersLoading={ordersLoading}
              markTokenUsed={markTokenUsed}
              menuItems={menuItems}
            />
          </TabsContent>

          <TabsContent value="menu">
            <AdminMenuTab
              menuItems={menuItems}
              menuLoading={menuLoading}
              createMenuItem={createMenuItem}
              updateMenuItem={updateMenuItem}
              deleteMenuItem={deleteMenuItem}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}