import { ReactNode, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Wallet, 
  Building2, 
  Settings, 
  LogOut,
  Menu,
  X,
  ChevronDown,
  Bell,
  
  Users,
  History,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSuperAdmin } from '@/context/SuperAdminContext';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/Logo';

interface SuperAdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/super-admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/super-admin/orders', icon: ShoppingBag, label: 'Orders' },
  { path: '/super-admin/settlements', icon: Wallet, label: 'Settlements' },
  { path: '/super-admin/campuses', icon: Building2, label: 'Campuses' },
  { path: '/super-admin/users', icon: Users, label: 'Users' },
  
  { path: '/super-admin/analytics', icon: BarChart3, label: 'Analytics' },
  { path: '/super-admin/audit-logs', icon: History, label: 'Audit Logs' },
  { path: '/super-admin/settings', icon: Settings, label: 'Settings' },
];

export function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { filters, setFilters, campuses, pendingCount, platformSettings } = useSuperAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  const isActive = (path: string) => {
    if (path === '/super-admin') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-out lg:transform-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Logo size="sm" showText={false} />
              <div>
                <span className="font-semibold text-foreground">GrabTheByte</span>
                <span className="text-xs text-muted-foreground ml-1">Super Admin</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Mode indicator */}
          <div className="px-4 py-3 border-b border-border">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
              platformSettings?.manual_verification_enabled 
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-green-500/10 text-green-600 dark:text-green-400"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-full animate-pulse",
                platformSettings?.manual_verification_enabled 
                  ? "bg-amber-500"
                  : "bg-green-500"
              )} />
              {platformSettings?.manual_verification_enabled 
                ? "Manual Verification Mode"
                : "Automated Gateway Mode"
              }
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive(item.path)
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1">{item.label}</span>
              </Link>
            ))}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 px-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {user?.email?.charAt(0).toUpperCase() || 'SA'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                    <p className="text-xs text-muted-foreground">Super Admin</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 lg:h-16 bg-card border-b border-border flex items-center justify-between px-3 lg:px-6 sticky top-0 z-30 safe-top">
          <div className="flex items-center gap-2 lg:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden h-9 w-9"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Global Campus Filter */}
            <Select
              value={filters.campusId || 'all'}
              onValueChange={(value) => setFilters(prev => ({ 
                ...prev, 
                campusId: value === 'all' ? null : value,
              }))}
            >
              <SelectTrigger className="w-[140px] sm:w-[200px] h-9 text-xs sm:text-sm">
                <SelectValue placeholder="All Campuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campuses</SelectItem>
                {campuses.map((campus) => (
                  <SelectItem key={campus.id} value={campus.id}>
                    {campus.name} ({campus.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-auto pb-6">
          {children}
        </main>
      </div>
    </div>
  );
}
