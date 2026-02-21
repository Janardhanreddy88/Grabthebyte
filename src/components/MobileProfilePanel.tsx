import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { X, ChevronRight, LogOut, KeyRound, HelpCircle, Package, Clock, Pencil, Loader2, FileText, Shield, RefreshCcw } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Order {
  id: string;
  order_number: string;
  created_at: string;
  total: number;
  status: string;
  items: string[];
}

interface MobileProfilePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut?: () => void;
}

export function MobileProfilePanel({ 
  isOpen, 
  onClose, 
  onSignOut 
}: MobileProfilePanelProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  
  // Get user data from auth context
  const userName = authUser?.fullName || 'Guest User';
  const userEmail = authUser?.email || 'guest@example.com';

  // Real orders from database
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch orders when panel opens
  useEffect(() => {
    if (isOpen && authUser?.id) {
      fetchOrders();
    }
  }, [isOpen, authUser?.id]);

  // Real-time subscription for order updates
  useEffect(() => {
    if (!authUser?.id) return;

    const channel = supabase
      .channel('order-status-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${authUser.id}`
        },
        (payload) => {
          // Update the order in state when status changes
          setOrders(prevOrders => 
            prevOrders.map(order => 
              order.id === payload.new.id 
                ? { ...order, status: payload.new.status }
                : order
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUser?.id]);

  const fetchOrders = async () => {
    if (!authUser?.id) return;
    
    setIsLoading(true);
    try {
      // Fetch orders with their items
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, created_at, total, status')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersError) throw ordersError;

      // Fetch order items for each order
      const ordersWithItems = await Promise.all(
        (ordersData || []).map(async (order) => {
          const { data: itemsData } = await supabase
            .from('order_items')
            .select('name')
            .eq('order_id', order.id);
          
          return {
            ...order,
            items: itemsData?.map(item => item.name) || []
          };
        })
      );

      setOrders(ordersWithItems);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get display status based on order status
  const getStatusDisplay = (order: Order) => {
    switch (order.status) {
      case 'confirmed':
        return { label: 'Confirmed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
      case 'collected':
        return { label: 'Collected', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' };
      case 'cancelled':
        return { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' };
      case 'pending':
      default:
        return { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' };
    }
  };

  // Dialog states
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  
  // Form states
  const [passwordForm, setPasswordForm] = useState({ old: '', new: '', confirm: '' });

  // Get initials from name
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (passwordForm.new !== passwordForm.confirm) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (passwordForm.new.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    
    setIsChangingPassword(true);
    try {
      // Verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: passwordForm.old,
      });
      
      if (signInError) {
        toast({ title: "Error", description: "Current password is incorrect.", variant: "destructive" });
        return;
      }
      
      // Update to new password
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new });
      
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      
      setChangePasswordOpen(false);
      setPasswordForm({ old: '', new: '', confirm: '' });
      toast({ title: "Password Updated!", description: "Your password has been changed successfully." });
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        return;
      }
      
      toast({ title: "Reset Link Sent!", description: `Password reset link sent to ${userEmail}` });
    } catch {
      toast({ title: "Error", description: "Failed to send reset link.", variant: "destructive" });
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="left" className="w-[85%] max-w-md p-0 flex flex-col overflow-hidden">
          <SheetHeader className="p-4 text-left shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-xl">My Account</SheetTitle>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </SheetHeader>
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <Separator />
            
            {/* User Header - Clickable to edit profile */}
            <button 
              onClick={() => {
                onClose();
                navigate('/profile');
              }}
              className="w-full p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold shrink-0">
                {getInitials(userName)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">{userName}</h3>
                <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
              </div>
              <Pencil size={18} className="text-muted-foreground shrink-0" />
            </button>
            
            <Separator />
            
            {/* Order History Section */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package size={18} className="text-muted-foreground" />
                  <h4 className="font-semibold text-sm text-muted-foreground">MY ORDERS</h4>
                </div>
                <button 
                  onClick={() => {
                    onClose();
                    navigate('/my-orders');
                  }}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  View All
                </button>
              </div>
              
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : orders.length > 0 ? (
                <div className="space-y-3">
                  {orders.slice(0, 2).map((order) => {
                    const statusDisplay = getStatusDisplay(order);
                    return (
                      <div 
                        key={order.id} 
                        className="bg-muted/50 rounded-xl p-3 border border-border"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-muted-foreground">{order.order_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full transition-all duration-300 ${statusDisplay.color}`}>
                            {statusDisplay.label}
                          </span>
                        </div>
                        <p className="font-medium text-sm">{order.items.join(', ') || 'No items'}</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock size={12} />
                            <span>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          </div>
                          <span className="font-bold text-primary">₹{order.total}</span>
                        </div>
                      </div>
                    );
                  })}
                  
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => {
                      onClose();
                      navigate('/my-orders');
                    }}
                  >
                    <Package size={16} />
                    View All Orders
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                    <Package className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm">No orders yet</p>
                </div>
              )}
            </div>
            
            <Separator />
            
            {/* Security Section */}
            <div className="p-4">
              <h4 className="font-semibold text-sm text-muted-foreground mb-3">SECURITY</h4>
              
              <button 
                onClick={() => setChangePasswordOpen(true)}
                className="w-full flex items-center justify-between py-3 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <KeyRound size={18} className="text-muted-foreground" />
                  <span>Change Password</span>
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </button>
              
              <button 
                onClick={handleForgotPassword}
                className="text-sm text-primary hover:underline mt-2"
              >
                Forgot Password?
              </button>
            </div>
            
            <Separator />
            
            {/* Support Section */}
            <div className="p-4">
              <h4 className="font-semibold text-sm text-muted-foreground mb-3">SUPPORT</h4>
            
              {/* --- UPDATED LINK TO SUPPORT PAGE --- */}
              <Link 
                to="/support"
                onClick={onClose}
                className="w-full flex items-center justify-between py-3 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <HelpCircle size={18} className="text-muted-foreground" />
                  <span>Help & Support</span>
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </Link>
            </div>
            
            <Separator />
            
            {/* Policies Section */}
            <div className="p-4">
              <h4 className="font-semibold text-sm text-muted-foreground mb-3">POLICIES</h4>
              
              <Link 
                to="/terms"
                onClick={onClose}
                className="w-full flex items-center justify-between py-3 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-muted-foreground" />
                  <span>Terms & Conditions</span>
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </Link>
              
              <Link 
                to="/privacy"
                onClick={onClose}
                className="w-full flex items-center justify-between py-3 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield size={18} className="text-muted-foreground" />
                  <span>Privacy Policy</span>
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </Link>
              
              <Link 
                to="/refund-policy"
                onClick={onClose}
                className="w-full flex items-center justify-between py-3 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <RefreshCcw size={18} className="text-muted-foreground" />
                  <span>Refund & Cancellation</span>
                </div>
                <ChevronRight size={18} className="text-muted-foreground" />
              </Link>
            </div>
            
            {/* Copyright Footer */}
            <div className="p-4 pt-2">
              <p className="text-xs text-muted-foreground text-center">
                © {new Date().getFullYear()} BiteOS Tech. All rights reserved.
              </p>
            </div>
          </div>
          
          {/* Sign Out Button */}
          <div className="p-4 border-t border-border bg-card shrink-0">
            <Button 
              variant="outline" 
              className="w-full h-12 rounded-xl gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              onClick={onSignOut}
            >
              <LogOut size={18} />
              Sign Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="old-password">Current Password</Label>
              <Input
                id="old-password"
                type="password"
                value={passwordForm.old}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, old: e.target.value }))}
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordForm.new}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePasswordOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Updating...</> : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}