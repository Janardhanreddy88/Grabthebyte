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
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/Logo";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useStockCheck } from "@/hooks/useStockCheck";
import { useAuth } from "@/context/AuthContext";
import { useOrders } from "@/hooks/useOrders";
import { EmptyState } from "@/components/EmptyState";
import { Separator } from "@/components/ui/separator";
import { ImageWithFallback } from "@/components/ImageWithFallback";

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, totalPrice, totalItems, updateQuantity, removeFromCart } = useCart();
  const { user } = useAuth();
  const { createOrder, isCreating } = useOrders();
  const { toast } = useToast();
  const { checkStock } = useStockCheck();

  const [isCheckingStock, setIsCheckingStock] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const lastSubmitRef = useRef<number>(0);
  const SUBMIT_COOLDOWN_MS = 2000;

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="flex-shrink-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/40">
          <div className="flex items-center gap-3 px-4 h-14">
            <button
              onClick={() => navigate("/menu")}
              className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center hover:bg-secondary transition-colors active:scale-95"
            >
              <ArrowLeft size={18} />
            </button>
            <Logo size="sm" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-5">
          <EmptyState
            icon={ShoppingBag}
            title="Your cart is empty"
            description="Add some items from the menu to checkout"
            action={{ label: "Browse Menu", onClick: () => navigate("/menu") }}
          />
        </main>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    if (!user) {
      toast({ title: "Login Required", description: "You must be logged in.", variant: "destructive" });
      navigate("/auth");
      return;
    }
    const now = Date.now();
    if (now - lastSubmitRef.current < SUBMIT_COOLDOWN_MS) return;
    lastSubmitRef.current = now;

    setIsCheckingStock(true);
    setStockError(null);

    try {
      const result = await checkStock(cart);
      if (!result.success) {
        const itemNames = result.unavailableItems.map((i) => i.name).join(", ");
        setStockError(`${itemNames} just sold out.`);
        toast({
          title: "Items Unavailable",
          description: `Sorry! ${itemNames} just sold out.`,
          variant: "destructive",
        });
        result.unavailableItems.forEach((item) => removeFromCart(item.id));
        return;
      }

      const order = await createOrder({ items: cart, total: totalPrice, paymentMethod: "razorpay", customerName: user.fullName, customerEmail: user.email });      
      if (order) { 
        navigate(`/payment?order_id=${order.id}&amount=${totalPrice}`); 
      } else { 
        toast({ title: "Order Failed", description: "Could not create order.", variant: "destructive" }); 
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setIsCheckingStock(false);
    }
  };

  const isLoading = isCheckingStock || isCreating;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center justify-between px-3 h-12 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate("/menu")}
              className="w-9 h-9 rounded-full bg-secondary text-foreground flex items-center justify-center"
            >
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
        <div className="max-w-2xl mx-auto w-full px-4 py-5 pb-36 space-y-5">
          <AnimatePresence>
            {stockError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
                  <AlertCircle size={18} />
                  <p className="text-sm font-medium">{stockError}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Items */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground px-1">
              <ShoppingBag size={15} />
              <h2 className="text-xs font-semibold uppercase tracking-wider">Order Items</h2>
            </div>
            <div className="bg-card rounded-xl shadow-sm border border-border/50 divide-y divide-border/50 overflow-hidden">
              {cart.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 flex gap-3.5"
                >
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0">
                    <ImageWithFallback
                      src={item.image || "/placeholder.svg"}
                      alt={item.name}
                      className="h-full w-full rounded-lg object-cover border border-border/50"
                      fallbackIcon
                      containerClassName="h-16 w-16 sm:h-20 sm:w-20"
                    />
                    <div className="absolute -top-1.5 -right-1.5 h-5 min-w-[1.25rem] px-1 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">
                      x{item.quantity}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-between py-0.5">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2">{item.name}</h3>
                      <span className="font-bold text-sm whitespace-nowrap">₹{item.price * item.quantity}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-muted-foreground">₹{item.price} / item</p>
                      <div className="flex items-center bg-secondary/50 rounded-lg p-0.5 gap-2 border border-border/50">
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 rounded bg-background flex items-center justify-center shadow-sm"
                          disabled={isLoading}
                        >
                          <Minus size={13} />
                        </motion.button>
                        <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 rounded bg-primary text-primary-foreground flex items-center justify-center shadow-sm"
                          disabled={isLoading}
                        >
                          <Plus size={13} />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Bill */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground px-1">
              <Receipt size={15} />
              <h2 className="text-xs font-semibold uppercase tracking-wider">Bill Details</h2>
            </div>
            <div className="bg-card rounded-xl shadow-sm border border-border/50 p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Item Total</span>
                <span className="font-medium">₹{totalPrice}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxes & Charges</span>
                <span className="text-green-600 text-xs font-medium px-2 py-0.5 bg-green-500/10 rounded-full">
                  FREE
                </span>
              </div>
              <Separator className="my-1.5" />
              <div className="flex justify-between items-center">
                <span className="font-bold text-base">To Pay</span>
                <span className="font-bold text-lg text-primary">₹{totalPrice}</span>
              </div>
            </div>
          </section>

          {/* Payment Method */}
          <section>
            <div className="relative">
              <div className="absolute inset-0 bg-primary/5 rounded-xl ring-2 ring-primary pointer-events-none" />
              <div className="relative p-4 flex items-center gap-3 bg-card rounded-xl">
                <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
                  <Receipt className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-sm">Online Payment</h3>
                  <p className="text-xs text-muted-foreground">UPI, Cards, Netbanking</p>
                </div>
                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <CheckCircle2 size={12} className="text-primary-foreground" />
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Sticky Bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-xl border-t border-border/40 z-50">
        <div className="max-w-2xl mx-auto flex gap-4 items-center">
          <div className="flex-1">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total</p>
            <p className="text-2xl font-black text-foreground">₹{totalPrice}</p>
          </div>
          <motion.div className="flex-[1.5]" whileTap={{ scale: 0.98 }}>
            <Button
              className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20"
              onClick={handlePlaceOrder}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  {isCreating ? "Creating Order..." : "Checking..."}
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