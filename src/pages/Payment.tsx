import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, RefreshCw, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Capacitor } from '@capacitor/core';

declare global {
  interface Window {
    Razorpay: any;
    RazorpayCheckout: any;
  }
}

type PaymentState = 'loading' | 'initiating' | 'processing' | 'verifying';

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

  const orderId = searchParams.get('order_id');
  const amount = searchParams.get('amount');

  const [paymentState, setPaymentState] = useState<PaymentState>("loading");
  const [orderNumber, setOrderNumber] = useState("");
  const paymentInitiated = useRef(false);
  const isSuccessRef = useRef(false); // Tracks if payment succeeded to prevent dismiss redirect errors

  const extractErrorMessage = (errorResponse: any) => {
    if (typeof errorResponse === 'string') return errorResponse;
    if (errorResponse?.error?.description) return errorResponse.error.description;
    if (errorResponse?.description) return errorResponse.description;
    if (errorResponse?.message) return errorResponse.message;
    return 'Payment process was interrupted or failed.';
  };

  const initiatePayment = useCallback(async () => {
    if (!orderId || !amount || !user || paymentInitiated.current) return;
    paymentInitiated.current = true;
    setPaymentState('initiating');

    try {
      const { data: order } = await supabase.from('orders').select('order_number, customer_name, customer_email, customer_phone').eq('id', orderId).maybeSingle();
      if (!order) throw new Error('Order not found');
      setOrderNumber(order.order_number);

      const { data: profile } = await supabase.from('profiles').select('phone').eq('user_id', user.id).maybeSingle();

      const rawPhoneNumber = order?.customer_phone || profile?.phone || user?.phone || (user as any)?.user_metadata?.phone || ""; 
      let cleanPhone = String(rawPhoneNumber).replace(/\D/g, ''); 
      if (cleanPhone.length > 10 && cleanPhone.startsWith('91')) cleanPhone = cleanPhone.substring(2);

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { orderId, amount: parseFloat(amount), customerName: order.customer_name || user.fullName, customerEmail: order.customer_email || user.email, customerPhone: cleanPhone }
      });

      if (error || !data?.razorpayOrderId) throw new Error(data?.error || 'Failed to create Razorpay session');
      
      const currentRzpOrderId = data.razorpayOrderId;
      const currentKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;

      setPaymentState('processing');

      const processSuccess = async (response: any) => {
        isSuccessRef.current = true;
        let paymentId = typeof response === 'string' ? response : (response.razorpay_payment_id || response.payment_id || "");
        let signature = typeof response === 'object' ? (response.razorpay_signature || response.signature || "") : "";

        setPaymentState('verifying');
        try {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
            body: { orderId, razorpay_payment_id: paymentId, razorpay_order_id: currentRzpOrderId, razorpay_signature: signature, razorpay_key_id: currentKeyId }
          });

          let isSuccess = false;
          if (verifyData && typeof verifyData === 'object' && verifyData.success) isSuccess = true;
          else if (typeof verifyData === 'string') { try { isSuccess = JSON.parse(verifyData).success; } catch (e) {} }

          if (verifyError || !isSuccess) throw new Error('Payment verification failed on server');

          // 🟢 SUCCESS ROUTING
          clearCart();
          toast({ title: "Payment Successful!", className: "bg-green-600 text-white border-none" });
          navigate(`/order/${orderId}`, { replace: true });

        } catch (err) {
          toast({ title: "Verification Failed", description: "Payment charged but not verified. Contact support.", variant: "destructive" });
          navigate(`/order/${orderId}`, { replace: true });
        }
      };

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID, 
        amount: Math.round(parseFloat(amount) * 100), 
        currency: "INR",
        name: "GrabTheByte", 
        description: `Order #${order.order_number}`,
        image: "/pwa-192x192.png", 
        order_id: currentRzpOrderId, 
        prefill: { name: order.customer_name || user.fullName || "Customer", email: order.customer_email || user.email || "", contact: cleanPhone },
        theme: { color: "#E50914" }
      };

      if (Capacitor.isNativePlatform()) {
        window.RazorpayCheckout.open(
          options,
          (paymentResponse: any) => processSuccess(paymentResponse),
          (errorResponse: any) => {
            // 🔴 NATIVE FAIL ROUTING
            paymentInitiated.current = false;
            toast({ title: "Payment Failed", description: extractErrorMessage(errorResponse), variant: "destructive" });
            navigate(`/order/${orderId}`, { replace: true });
          }
        );
      } else {
        const res = await loadRazorpayScript();
        if (!res) throw new Error("Razorpay SDK failed to load.");

        const webOptions = {
          ...options,
          handler: function (response: any) { processSuccess(response); },
          modal: {
            ondismiss: function() {
              if (!isSuccessRef.current) {
                // 🔴 WEB DISMISS ROUTING
                paymentInitiated.current = false;
                toast({ title: "Payment Cancelled", description: "You closed the payment window.", variant: "destructive" });
                navigate(`/order/${orderId}`, { replace: true });
              }
            }
          }
        };

        const rzp = new window.Razorpay(webOptions);
        rzp.on('payment.failed', function (response: any) { console.warn("Payment attempt failed inside modal."); });
        rzp.open();
      }

    } catch (err) {
      toast({ title: "Initiation Failed", description: err instanceof Error ? err.message : 'Payment initiation failed', variant: "destructive" });
      navigate(`/order/${orderId}`, { replace: true });
    }
  }, [orderId, amount, user, navigate, toast, clearCart]);

  useEffect(() => {
    if (orderId && amount && user && paymentState === 'loading') {
      initiatePayment();
    }
  }, [orderId, amount, user, paymentState, initiatePayment]);

  const handleRetry = () => { paymentInitiated.current = false; setPaymentState('loading'); };

  if (!orderId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-card rounded-2xl border border-border p-8 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Invalid Payment Link</h2>
          <Button onClick={() => navigate("/menu", { replace: true })} className="w-full h-11 rounded-xl mt-4">Return to Menu</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border/40 px-4 py-3 safe-top">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-secondary/50" onClick={() => navigate("/menu", { replace: true })} disabled={paymentState === "initiating" || paymentState === "verifying"}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-base font-bold leading-tight">Secure Checkout</h1>
            <h2 className="text-xs text-muted-foreground font-medium">Order #{orderNumber}</h2>
          </div>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col items-center p-4 max-w-lg mx-auto w-full pt-6">
        <div className="w-full bg-card rounded-[24px] border border-border shadow-sm overflow-hidden">
          {amount && (
            <div className="text-center p-6 bg-secondary/30 border-b border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Amount to Pay</p>
              <p className="text-4xl font-black text-foreground tracking-tight">₹{amount}</p>
            </div>
          )}
          
          <div className="p-2">
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full"></div>
              </motion.div>
              <h2 className="text-xl font-bold mb-2">
                {paymentState === "verifying" ? "Verifying Payment" : "Processing"}
              </h2>
              <p className="text-sm text-muted-foreground max-w-[250px]">
                {paymentState === "verifying" ? "Please wait while we confirm your transaction securely." : "Please do not close this window or press the back button."}
              </p>
              {paymentState === "processing" && (
                <Button variant="ghost" size="sm" onClick={handleRetry} className="mt-6 gap-2 text-muted-foreground">
                  <RefreshCw size={14} /> Re-open Payment
                </Button>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-8 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
          <CheckCircle2 size={14} className="text-green-600" /> 100% Secure & Encrypted Payments
        </div>
      </main>
    </div>
  );
}