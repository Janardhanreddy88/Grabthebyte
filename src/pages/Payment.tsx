import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, CheckCircle2, RefreshCw, ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";

type PaymentState = "loading" | "initiating" | "processing" | "verifying" | "success" | "failed" | "error";

// Helper to inject Razorpay script dynamically
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function Payment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { clearCart } = useCart();

  const orderId = searchParams.get("order_id");
  const amount = searchParams.get("amount");

  const [paymentState, setPaymentState] = useState<PaymentState>("loading");
  const [orderNumber, setOrderNumber] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const paymentInitiated = useRef(false);

  // 4. VERIFY THE PAYMENT (Calls Edge Function we will build in Phase 4)
  const handlePaymentSuccess = async (response: any) => {
    setPaymentState("verifying");
    try {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: {
          orderId: orderId,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
        },
      });

      if (error || !data?.success) {
        throw new Error("Payment verification failed on server");
      }

      setPaymentState("success");
      clearCart();
      toast({ title: "Payment Successful!", className: "bg-green-600 text-white border-none" });
      setTimeout(() => navigate(`/order-success?order_id=${orderId}`), 2000);
    } catch (err) {
      console.error(err);
      setPaymentState("error");
      setErrorMessage("Payment was charged, but verification failed. Contact support.");
    }
  };

  // INITIATE POPUP PAYMENT
  const initiatePayment = useCallback(async () => {
    if (!orderId || !amount || !user || paymentInitiated.current) return;
    paymentInitiated.current = true;
    setPaymentState("initiating");

    try {
      // 1. Load Razorpay Script
      const res = await loadRazorpayScript();
      if (!res) throw new Error("Razorpay SDK failed to load. Are you online?");

      // 2. Get order details from DB
      const { data: order } = await supabase
        .from("orders")
        .select("order_number, customer_name, customer_email")
        .eq("id", orderId)
        .single();
      if (!order) throw new Error("Order not found");
      setOrderNumber(order.order_number);

      // 3. Ask Backend to generate Razorpay Order ID
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          orderId,
          amount: parseFloat(amount),
          customerName: order.customer_name || user.fullName,
          customerEmail: order.customer_email || user.email,
          customerPhone: user.phone || "9999999999",
        },
      });

      if (error || !data?.razorpayOrderId) throw new Error(data?.error || "Failed to create Razorpay session");

      // 4. TRIGGER THE RAZORPAY POPUP MODAL
      setPaymentState("processing");

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: Math.round(parseFloat(amount) * 100),
        currency: "INR",
        name: "GrabTheByte",
        description: `Order #${order.order_number}`,
        image: "/pwa-192x192.png", // Your red PWA icon!
        order_id: data.razorpayOrderId,
        handler: function (response: any) {
          handlePaymentSuccess(response);
        },
        prefill: {
          name: order.customer_name || user.fullName,
          email: order.customer_email || user.email,
          contact: user.phone || "9999999999",
        },
        theme: {
          color: "#E50914", // GrabTheByte Red
        },
        modal: {
          ondismiss: function () {
            setPaymentState("failed");
            setErrorMessage("Payment window was closed.");
            paymentInitiated.current = false;
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setPaymentState("failed");
        setErrorMessage(response.error.description || "Payment failed.");
        paymentInitiated.current = false;
      });
      rzp.open();
    } catch (err) {
      setPaymentState("error");
      setErrorMessage(err instanceof Error ? err.message : "Payment initiation failed");
      paymentInitiated.current = false;
    }
  }, [orderId, amount, user, navigate, toast]);

  useEffect(() => {
    if (orderId && amount && user && paymentState === "loading") {
      initiatePayment();
    }
  }, [orderId, amount, user, paymentState, initiatePayment]);

  const handleRetry = () => {
    paymentInitiated.current = false;
    setPaymentState("loading");
  };

  const StateIcon = ({ bg, children }: { bg: string; children: React.ReactNode }) => (
    <div className={`w-14 h-14 ${bg} rounded-full flex items-center justify-center mx-auto mb-4`}>{children}</div>
  );

  const renderContent = () => {
    switch (paymentState) {
      case "loading":
      case "initiating":
        return (
          <div className="text-center py-8">
            <StateIcon bg="bg-primary/10">
              <Loader2 className="w-7 h-7 text-primary animate-spin" />
            </StateIcon>
            <h2 className="text-base font-bold mb-1">Preparing Payment</h2>
            <p className="text-xs text-muted-foreground">Setting up secure payment...</p>
          </div>
        );
      case "processing":
        return (
          <div className="text-center py-8">
            <StateIcon bg="bg-blue-500/10">
              <CreditCard className="w-7 h-7 text-blue-600" />
            </StateIcon>
            <h2 className="text-base font-bold mb-1">Complete Your Payment</h2>
            <p className="text-xs text-muted-foreground mb-3">If payment window didn't open:</p>
            <Button size="sm" onClick={handleRetry} className="gap-1.5 text-xs">
              <RefreshCw size={12} /> Open Payment
            </Button>
          </div>
        );
      case "verifying":
        return (
          <div className="text-center py-8">
            <StateIcon bg="bg-yellow-500/10">
              <Loader2 className="w-7 h-7 text-yellow-600 animate-spin" />
            </StateIcon>
            <h2 className="text-base font-bold mb-1">Verifying Payment</h2>
            <p className="text-xs text-muted-foreground">Please wait...</p>
          </div>
        );
      case "success":
        return (
          <div className="text-center py-8">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
              <StateIcon bg="bg-green-500/10">
                <CheckCircle2 className="w-7 h-7 text-green-600" />
              </StateIcon>
            </motion.div>
            <h2 className="text-base font-bold mb-1 text-green-600">Payment Successful!</h2>
            <p className="text-xs text-muted-foreground mb-2">Order #{orderNumber} confirmed</p>
            <p className="text-[10px] text-muted-foreground">Redirecting...</p>
          </div>
        );
      case "failed":
        return (
          <div className="text-center py-8">
            <StateIcon bg="bg-orange-500/10">
              <AlertCircle className="w-7 h-7 text-orange-600" />
            </StateIcon>
            <h2 className="text-base font-bold mb-1 text-orange-600">Payment Incomplete</h2>
            <p className="text-xs text-muted-foreground mb-4">{errorMessage}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => navigate("/my-orders")} className="text-xs">
                View Orders
              </Button>
              <Button size="sm" onClick={handleRetry} className="gap-1.5 text-xs bg-orange-600 hover:bg-orange-700">
                <RefreshCw size={12} /> Try Again
              </Button>
            </div>
          </div>
        );
      case "error":
        return (
          <div className="text-center py-8">
            <StateIcon bg="bg-destructive/10">
              <AlertCircle className="w-7 h-7 text-destructive" />
            </StateIcon>
            <h2 className="text-base font-bold mb-1 text-destructive">Something Went Wrong</h2>
            <p className="text-xs text-muted-foreground mb-4">{errorMessage}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => navigate("/menu")} className="text-xs">
                Back to Menu
              </Button>
              <Button size="sm" onClick={handleRetry} className="gap-1.5 text-xs">
                <RefreshCw size={12} /> Retry
              </Button>
            </div>
          </div>
        );
    }
  };

  if (!orderId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-card rounded-2xl border border-border p-6 text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h2 className="text-sm font-bold mb-1">Invalid Payment Link</h2>
          <p className="text-xs text-muted-foreground mb-3">No order information found</p>
          <Button size="sm" onClick={() => navigate("/menu")} className="text-xs">
            Go to Menu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 max-w-lg mx-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => navigate("/my-orders")}
            disabled={paymentState === "initiating" || paymentState === "verifying"}
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-sm font-bold">Payment</h1>
            {orderNumber && <p className="text-[10px] text-muted-foreground">Order #{orderNumber}</p>}
          </div>
        </div>
      </header>
      <main className="p-4 max-w-lg mx-auto">
        <div className="bg-card rounded-2xl border border-border shadow-sm">
          {amount && (
            <div className="text-center p-4 pb-3 border-b border-border">
              <p className="text-[10px] text-muted-foreground mb-0.5">Amount to Pay</p>
              <p className="text-3xl font-black text-primary">₹{amount}</p>
            </div>
          )}
          <div className="p-4">{renderContent()}</div>
        </div>
      </main>
    </div>
  );
}
