import {
  ArrowLeft,
  ShoppingBag,
  Loader2,
  AlertCircle,
  Receipt,
  CheckCircle2,
  Minus,
  Plus,
  ArrowRight,
  WifiOff,
  AlertOctagon,
  Tag,
  X,
  Trash2 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/Logo";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { PullToRefresh } from "@/components/PullToRefresh";
import { useToast } from "@/hooks/use-toast";
import { useStockCheck } from "@/hooks/useStockCheck";
import { useAuth } from "@/context/AuthContext";
import { useOrders } from "@/hooks/useOrders";
import { useCampus } from "@/context/CampusContext"; 
import { EmptyState } from "@/components/EmptyState";
import { Separator } from "@/components/ui/separator";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, totalPrice, totalItems, updateQuantity, removeFromCart } = useCart();
  
  const { user, isAnonymous } = useAuth(); 
  
  const { campus } = useCampus(); 
  const { createOrder, isCreating } = useOrders();
  const { toast } = useToast();
  const { checkStock } = useStockCheck();

  const [isCheckingStock, setIsCheckingStock] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [ordersPaused, setOrdersPaused] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  
  const [isProcessing, setIsProcessing] = useState(false);

  // PROMO CODE STATE VARIABLES
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(null);
  const [promoMessage, setPromoMessage] = useState({ text: "", type: "" });
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);

  // 🦅 THE NEW BULLETPROOF 3% PRICING LOGIC
  const discountedFoodCost = Math.max(0, totalPrice - appliedDiscount);
  // Calculates exactly 3% of the food cost and rounds to 2 decimals
  const totalHandlingFee = cart.length === 0 ? 0 : Number((discountedFoodCost * 0.03).toFixed(2));
  const finalAmountToPay = cart.length === 0 ? 0 : Number((discountedFoodCost + totalHandlingFee).toFixed(2));

  useEffect(() => {
    if (appliedPromoCode) {
      removePromo();
      toast({ title: "Cart Updated", description: "Promo code removed because your cart changed." });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalItems]); 

  useEffect(() => {
    const checkPauseOnLoad = async () => {
      const { data } = await supabase
        .from('platform_settings')
        .select('orders_paused, orders_paused_reason')
        .single();
      if (data) {
        setOrdersPaused(data.orders_paused ?? false);
        setPauseReason(data.orders_paused_reason ?? '');
      }
    };
    checkPauseOnLoad();
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleApplyPromo = async () => {
    if (!promoCodeInput.trim() || !user) return;
    setIsCheckingPromo(true);
    setPromoMessage({ text: "Checking...", type: "loading" });

    try {
      const { data: offer, error } = await (supabase as any)
        .from("offers")
        .select("*")
        .eq("promo_code", promoCodeInput.toUpperCase().trim())
        .eq("is_active", true)
        .single();

      if (error || !offer) {
        setPromoMessage({ text: "Invalid or expired promo code.", type: "error" });
        setAppliedDiscount(0);
        setAppliedPromoCode(null);
        return;
      }

      // 🦅 UPGRADED MULTI-USER TARGETING CHECK
      // If the array exists and has length > 0, we must check if the user is in it.
      if (offer.target_user_ids && offer.target_user_ids.length > 0) {
        if (!offer.target_user_ids.includes(user.id)) {
          setPromoMessage({ text: "This promo code is exclusive to specific students.", type: "error" });
          setAppliedDiscount(0);
          setAppliedPromoCode(null);
          return;
        }
      }

      // Anti-Fraud Usage Limit Check
      const { data: pastOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', user.id)
        .eq('promo_code', offer.promo_code)
        .not('status', 'in', '("failed","cancelled","expired","rejected","refunded")');

      const maxUsesAllowed = offer.max_uses_per_user || 1;

      if (pastOrders && pastOrders.length >= maxUsesAllowed) {
        setPromoMessage({ 
          text: `You have reached the maximum limit (${maxUsesAllowed} uses) for this code.`, 
          type: "error" 
        });
        setAppliedDiscount(0);
        setAppliedPromoCode(null);
        return;
      }

      // Check specific item target
      if (offer.target_item_id) {
        const hasTargetItem = cart.some(item => item.id === offer.target_item_id);
        if (!hasTargetItem) {
          setPromoMessage({ text: "This promo code requires a specific item in your cart.", type: "error" });
          setAppliedDiscount(0);
          setAppliedPromoCode(null);
          return;
        }
      }

      // Check min order value
      if (totalPrice < offer.min_order_value) {
        setPromoMessage({ text: `Add ₹${offer.min_order_value - totalPrice} more to unlock!`, type: "error" });
        setAppliedDiscount(0);
        setAppliedPromoCode(null);
        return;
      }

      // Calculate Discount Base
      let discountBase = totalPrice;
      if (offer.target_item_id) {
        const targetItem = cart.find(item => item.id === offer.target_item_id);
        if (targetItem) {
           discountBase = targetItem.price * targetItem.quantity;
        }
      }

      // Calculate Final Discount Amount
      let finalDiscountAmount = 0;
      if (offer.discount_type === "fixed") {
        finalDiscountAmount = offer.discount_value;
      } else if (offer.discount_type === "percentage") {
        finalDiscountAmount = discountBase * (offer.discount_value / 100);
        if (offer.max_discount_amount !== null && finalDiscountAmount > offer.max_discount_amount) {
          finalDiscountAmount = offer.max_discount_amount;
        }
      }

      if (finalDiscountAmount > discountBase) finalDiscountAmount = discountBase;

      setAppliedDiscount(finalDiscountAmount);
      setAppliedPromoCode(offer.promo_code);
      setPromoMessage({ text: `Awesome! ₹${finalDiscountAmount.toFixed(2)} saved.`, type: "success" });
    } catch (error) {
      setPromoMessage({ text: "Something went wrong.", type: "error" });
    } finally {
      setIsCheckingPromo(false);
    }
  };

  const removePromo = () => {
    setAppliedDiscount(0);
    setAppliedPromoCode(null);
    setPromoCodeInput("");
    setPromoMessage({ text: "", type: "" });
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex-shrink-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/40 safe-top">
          <div className="flex items-center gap-3 px-4 h-14">
            <button onClick={() => navigate("/menu")} className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors active:scale-95">
              <ArrowLeft size={18} />
            </button>
            <Logo size="sm" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-5">
          <EmptyState icon={ShoppingBag} title="Your cart is empty" description="Add some items from the menu to checkout" action={{ label: "Browse Menu", onClick: () => navigate("/menu") }} />
        </main>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    if (isOffline) {
      toast({ title: "No Connection", description: "Internet required to place order.", variant: "destructive" });
      setIsProcessing(false);
      return;
    }

    if (!user) {
      toast({ title: "Login Required", description: "You must be logged in.", variant: "destructive" });
      navigate("/auth");
      setIsProcessing(false);
      return;
    }

    setIsCheckingStock(true);
    setStockError(null);

    try {
      const { data: currentSettings } = await supabase.from('platform_settings').select('orders_paused, orders_paused_reason').single();
        
      if (currentSettings?.orders_paused) {
        setOrdersPaused(true);
        setPauseReason(currentSettings.orders_paused_reason ?? '');
        toast({ title: "Orders Paused", description: currentSettings.orders_paused_reason || "Kitchen is overwhelmed. Try again shortly.", variant: "destructive" });
        setIsProcessing(false);
        setIsCheckingStock(false);
        return;
      }

      const result = await checkStock(cart);
      
      if (!result.success) {
        let errorMessage = "";
        if (result.soldOutItems && result.soldOutItems.length > 0) {
          const soldOutNames = result.soldOutItems.map((i) => i.name).join(", ");
          errorMessage += `${soldOutNames} completely sold out. `;
          result.soldOutItems.forEach((item) => removeFromCart(item.id));
        }
        if (result.adjustedItems && result.adjustedItems.length > 0) {
          const adjustedNames = result.adjustedItems.map((adj) => `${adj.item.name} (Only ${adj.availableStock} left)`).join(", ");
          errorMessage += `Adjusted quantities for: ${adjustedNames}. `;
          result.adjustedItems.forEach((adj) => updateQuantity(adj.item.id, adj.availableStock));
        }
        setStockError("Cart updated due to stock changes. Please review and try again.");
        toast({ title: "Cart Updated", description: errorMessage.trim(), variant: "destructive" });
        setIsProcessing(false);
        return; 
      }

      // STRICT GUEST CHECK: Only inject dummy data if they are a visitor!
      const safePhone = user.phone || (user as any)?.user_metadata?.phone || (isAnonymous ? "0000000000" : "");
      const safeEmail = user.email || (isAnonymous ? "guest@grabthebyte.com" : "");
      const safeName = user.fullName || (isAnonymous ? "Guest Visitor" : "Student");

      const order = await createOrder({ 
        items: cart, 
        total: finalAmountToPay, 
        paymentMethod: "razorpay", 
        customerName: safeName, 
        customerEmail: safeEmail,
        customerPhone: safePhone,
        promoCode: appliedPromoCode,
        platformFee: totalHandlingFee 
      });

      if (order) { 
        navigate(`/payment?order_id=${order.id}&amount=${finalAmountToPay}`, {
          state: { customerName: safeName, customerEmail: safeEmail, customerPhone: safePhone }
        });
      } else { 
        toast({ title: "Order Failed", description: "Could not create order.", variant: "destructive" }); 
        setIsProcessing(false);
      }
    } catch (error: any) {
      toast({ title: "Offer Rejected", description: error.message || "Something went wrong.", variant: "destructive" });
      setIsProcessing(false);
    } finally {
      setIsCheckingStock(false);
    }
  };

  const isLoading = isCheckingStock || isCreating || isProcessing || isCheckingPromo;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40 safe-top">
        <div className="flex items-center justify-between px-3 h-12 max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => navigate("/menu")} className="w-9 h-9 rounded-full bg-secondary text-foreground flex items-center justify-center">
              <ArrowLeft size={16} />
            </motion.button>
            <span className="font-bold text-base">Checkout</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/10">
            <ShoppingBag size={14} />
            <span className="font-bold text-xs">{totalItems}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <PullToRefresh onRefresh={async () => window.location.reload()}>
        <div className="max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto w-full px-3 py-4 pb-32 space-y-4">
          
          {ordersPaused && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
              <AlertOctagon size={20} className="shrink-0" />
              <div>
                <p className="font-bold text-sm">Kitchen is currently overwhelmed</p>
                <p className="text-xs opacity-80">{pauseReason || 'Pausing orders temporarily. Please try again in a few minutes.'}</p>
              </div>
            </div>
          )}

          <AnimatePresence>
            {stockError && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
                  <AlertCircle size={18} />
                  <p className="text-sm font-medium">{stockError}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Items List */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground px-1">
              <ShoppingBag size={15} />
              <h2 className="text-xs font-semibold uppercase tracking-wider">Order Items</h2>
            </div>
            <div className="bg-card rounded-xl shadow-sm border border-border/50 divide-y divide-border/50 overflow-hidden">
              {cart.map((item) => {
                const isToken = item.category === 'token' || item.name.toLowerCase().includes('token');

                return (
                  <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 flex gap-3.5">
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                      <ImageWithFallback src={item.image || "/placeholder.svg"} alt={item.name} className="h-full w-full rounded-lg object-cover border border-border/50" fallbackIcon containerClassName="h-16 w-16 sm:h-20 sm:w-20" />
                      <div className="absolute -top-1.5 -right-1.5 h-5 min-w-[1.25rem] px-1 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                        x{item.quantity}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-0.5">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-semibold text-sm leading-tight line-clamp-2">{item.name}</h3>
                        <span className="font-bold text-sm whitespace-nowrap">₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          {isToken ? "Custom Amount" : `₹${item.price.toFixed(2)} / item`}
                        </p>
                        
                        <div className="flex items-center gap-2">
                          <motion.button 
                            whileTap={{ scale: 0.9 }} 
                            onClick={() => removeFromCart(item.id)} 
                            className="w-7 h-7 rounded bg-red-100 text-red-600 flex items-center justify-center shadow-sm"
                            disabled={isLoading}
                          >
                            <Trash2 size={13} strokeWidth={2.5} />
                          </motion.button>
                          
                          <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 gap-2 border border-border/50">
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 rounded bg-background flex items-center justify-center shadow-sm" disabled={isLoading}>
                              <Minus size={13} />
                            </motion.button>
                            <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                            <motion.button whileTap={{ scale: 0.9 }} onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 rounded bg-primary text-primary-foreground flex items-center justify-center shadow-sm" disabled={isLoading}>
                              <Plus size={13} />
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* PROMO CODE SECTION */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground px-1">
              <Tag size={15} />
              <h2 className="text-xs font-semibold uppercase tracking-wider">Offers & Benefits</h2>
            </div>
            <div className="bg-card rounded-xl shadow-sm border border-border/50 p-3">
              {!appliedPromoCode ? (
                <div className="flex gap-2">
                  <Input placeholder="Enter promo code" value={promoCodeInput} onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())} className="uppercase placeholder:normal-case font-semibold" disabled={isCheckingPromo} />
                  <Button variant="secondary" onClick={handleApplyPromo} disabled={!promoCodeInput || isCheckingPromo}>
                    {isCheckingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 text-green-700 px-3 py-2.5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Tag size={16} />
                    <div>
                      <p className="font-bold text-sm uppercase">{appliedPromoCode}</p>
                      <p className="text-xs font-medium">Code applied successfully</p>
                    </div>
                  </div>
                  <button onClick={removePromo} className="p-1 hover:bg-green-100 rounded-md transition-colors">
                    <X size={16} />
                  </button>
                </div>
              )}
              {promoMessage.text && !appliedPromoCode && (
                <p className={`text-xs font-medium mt-2 px-1 ${promoMessage.type === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {promoMessage.text}
                </p>
              )}
            </div>
          </section>

          {/* Bill Summary */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground px-1">
              <Receipt size={15} />
              <h2 className="text-xs font-semibold uppercase tracking-wider">Bill Details</h2>
            </div>
            <div className="bg-card rounded-xl shadow-sm border border-border/50 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Item Total</span>
                <span className="font-medium">₹{totalPrice.toFixed(2)}</span>
              </div>
              
              {appliedDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span>Item Discount ({appliedPromoCode})</span>
                  <span>- ₹{appliedDiscount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-sm items-center">
                <span className="text-muted-foreground">Platform & Handling Fee</span>
                <span className="text-primary text-xs font-bold px-2 py-0.5 bg-primary/10 rounded-full">
                  + ₹{totalHandlingFee.toFixed(2)}
                </span>
              </div>
              <Separator className="my-1.5" />
              <div className="flex justify-between items-center">
                <span className="font-bold text-base">To Pay</span>
                <span className="font-bold text-lg text-primary">₹{finalAmountToPay.toFixed(2)}</span>
              </div>
            </div>
          </section>

          {/* Payment Method */}
          <section>
            <div className="relative p-4 flex items-center gap-3 bg-card rounded-xl border border-primary/20 bg-primary/5">
              <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
                <Receipt className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-sm">Online Payment</h3>
                <p className="text-xs text-muted-foreground">UPI, Cards, Netbanking</p>
              </div>
              <CheckCircle2 size={16} className="text-primary" />
            </div>
          </section>
        </div>
        </PullToRefresh>
      </main>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/40 z-50 safe-bottom">
        <div className="max-w-2xl md:max-w-4xl lg:max-w-6xl mx-auto flex gap-4 items-center">
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total</p>
            <p className="text-xl font-black text-foreground">₹{finalAmountToPay.toFixed(2)}</p>
          </div>
          <motion.div className="flex-[1.5]" whileTap={!isOffline && !ordersPaused ? { scale: 0.98 } : {}}>
            <Button
              className={`w-full h-10 rounded-xl text-sm font-bold shadow-lg ${(isOffline || ordersPaused) ? 'bg-muted text-muted-foreground' : 'shadow-primary/20'}`}
              onClick={handlePlaceOrder}
              disabled={isLoading || isOffline || ordersPaused}
            >
              {ordersPaused ? (
                <span className="flex items-center gap-2">
                  <AlertOctagon size={16} /> Orders Paused
                </span>
              ) : isOffline ? (
                <span className="flex items-center gap-2">
                  <WifiOff size={16} /> Offline: Connect to Pay
                </span>
              ) : isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  {isCreating ? "Ordering..." : "Processing..."}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Proceed to Pay <ArrowRight size={16} />
                </span>
              )}
            </Button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}