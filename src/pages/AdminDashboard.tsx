import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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
  Package, Users, User, Mail, Phone, Building2,
} from "lucide-react";
import { AdminAnalyticsTab } from "@/components/admin/AdminAnalyticsTab";
import { AdminOrdersTab } from "@/components/admin/AdminOrdersTab";
import { AdminMenuTab } from "@/components/admin/AdminMenuTab";

const ADMIN_CATEGORIES = [
  { id: "breakfast", name: "Breakfast" },
  { id: "lunch", name: "Lunch" },
  { id: "snacks", name: "Snacks" },
] as const;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout: pinLogout } = useAdminAuth();
  const { logout: authLogout } = useAuth();
  const [profileData, setProfileData] = useState<{
    full_name: string | null;
    email: string | null;
    phone: string | null;
    campus_name: string | null;
    campus_code: string | null;
  } | null>(null);

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
        });
      }
    };
    fetchProfile();
  }, []);

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

  const handleRestockClick = (itemId: string) => {
    // This triggers the menu tab - but since MenuTab manages its own dialog, 
    // we just navigate there. For now, toast a hint.
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

          <TabsContent value="analytics">
            <AdminAnalyticsTab
              todayStats={todayStats}
              todayLoading={todayLoading}
              weeklyStats={weeklyStats}
              weeklyLoading={weeklyLoading}
              monthlyStats={monthlyStats}
              monthlyLoading={monthlyLoading}
              lowStockItems={lowStockItems}
              onRestockClick={handleRestockClick}
            />
          </TabsContent>

          <TabsContent value="orders">
            <AdminOrdersTab
              orders={orders}
              ordersLoading={ordersLoading}
              markTokenUsed={markTokenUsed}
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
