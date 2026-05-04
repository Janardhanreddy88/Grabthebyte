import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
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

type PaymentState = 'loading' | 'initiating' | 'processing' | 'verifying' | 'error';

const ensureRazorpayScript = (): Promise<boolean> => {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      if ((existing as HTMLScriptElement).getAttribute('data-loaded')) resolve(!!window.Razorpay);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const { clearCart } = useCart();

  const orderId = searchParams.get('order_id');
  const amount = searchParams.get('amount');
  const navState = location.state as { customerName?: string; customerEmail?: string; customerPhone?: string } | null;

  const [paymentState, setPaymentState] = useState<PaymentState>("loading");
  const [orderNumber, setOrderNumber] = useState("");
  const paymentInitiated = useRef(false);
  const isSuccessRef = useRef(false);

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
      const customerName = navState?.customerName || user.fullName || "Customer";
      const customerEmail = navState?.customerEmail || user.email || "";
      
      let rawPhone = navState?.customerPhone;
      
      if (!rawPhone || rawPhone === 'null' || rawPhone === 'undefined') {
        const { data: profile } = await supabase
          .from('profiles') 
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(); 

        rawPhone = profile?.phone || user.phone || (user as any)?.user_metadata?.phone || "";
      }

      let cleanPhone = String(rawPhone || '').replace(/\D/g, '');
      if (cleanPhone.length > 10 && cleanPhone.startsWith('91')) cleanPhone = cleanPhone.substring(2);

      if (!cleanPhone || cleanPhone.length < 10) {
        toast({ 
          title: "Phone Number Required", 
          description: "Please update your profile with a valid phone number to checkout securely.", 
          variant: "destructive" 
        });
        
        paymentInitiated.current = false;
        setPaymentState('error'); 
        
        setTimeout(() => navigate(-1), 2500); 
        return; 
      }

      const [paymentResult, scriptLoaded, orderData] = await Promise.all([
        supabase.functions.invoke('create-payment', {
          body: { orderId, amount: parseFloat(amount), customerName, customerEmail, customerPhone: cleanPhone }
        }),
        Capacitor.isNativePlatform() ? Promise.resolve(true) : ensureRazorpayScript(),
        supabase.from('orders').select('order_number').eq('id', orderId).maybeSingle(),
      ]);

      if (orderData.data?.order_number) setOrderNumber(orderData.data.order_number);

      if (paymentResult.error) throw new Error(paymentResult.error?.message || 'Failed to create payment session.');
      if (!paymentResult.data?.razorpayOrderId) throw new Error(paymentResult.data?.error || 'Razorpay session could not be created.');
      if (!Capacitor.isNativePlatform() && !scriptLoaded) throw new Error("Payment gateway failed to load.");

      const currentRzpOrderId = paymentResult.data.razorpayOrderId;
      const currentKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;
      const displayOrderNumber = orderData.data?.order_number || '';

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

          // 🚨 THE TITANIUM LOCK GUARD (NEW) 🚨
          // We explicitly check if the backend sent back an error (like Race Condition blocked)
          const responseError = verifyError || (verifyData && verifyData.error);
          
          if (responseError) {
            console.error("Verification Blocked by Backend:", responseError);
            
            toast({ 
              title: "Session Expired ⏱️", 
              description: "Your checkout window timed out. If money was deducted, it will be auto-refunded by your bank in 3-5 days.", 
              variant: "destructive",
              duration: 6000 // Give them time to read the auto-refund part
            });
            
            // Redirect them safely back to the menu to try again, NOT the order page!
            navigate('/menu', { replace: true });
            return; // 🛑 Stop executing!
          }

          // If no error, proceed to success check
          let isSuccess = false;
          if (verifyData && typeof verifyData === 'object' && verifyData.success) isSuccess = true;
          else if (typeof verifyData === 'string') { try { isSuccess = JSON.parse(verifyData).success; } catch (e) {} }

          if (!isSuccess) throw new Error('Payment verification failed on server');

          clearCart();
          toast({ title: "Payment Successful!", className: "bg-green-600 text-white border-none" });
          navigate(`/order/${orderId}`, { replace: true });

        } catch (err) {
          console.error("Verification execution error:", err);
          toast({ title: "Verification Failed", description: "Payment charged but not verified. Contact support.", variant: "destructive" });
          navigate(`/order/${orderId}`, { replace: true });
        }
      };

      const options = {
        key: currentKeyId,
        amount: Math.round(parseFloat(amount) * 100),
        currency: "INR",
        name: "GrabTheByte",
        description: `Order #${displayOrderNumber}`,
        image: "/pwa-192x192.png",
        order_id: currentRzpOrderId,
        prefill: { name: customerName, email: customerEmail, contact: cleanPhone },
        theme: { color: "#EA580C" }
      };

      if (Capacitor.isNativePlatform()) {
        window.RazorpayCheckout.open(
          options,
          (paymentResponse: any) => processSuccess(paymentResponse),
          (errorResponse: any) => {
            paymentInitiated.current = false;
            toast({ title: "Payment Failed", description: extractErrorMessage(errorResponse), variant: "destructive" });
            navigate(`/order/${orderId}`, { replace: true });
          }
        );
      } else {
        const webOptions = {
          ...options,
          handler: function (response: any) { processSuccess(response); },
          modal: {
            ondismiss: function() {
              if (!isSuccessRef.current) {
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
      toast({ title: "Payment Failed", description: err instanceof Error ? err.message : 'Payment initiation failed. Please try again.', variant: "destructive" });
      navigate(`/order/${orderId}`, { replace: true });
    }
  }, [orderId, amount, user, navState, navigate, toast, clearCart]);

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
              
              {paymentState === "error" ? (
                 <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
              ) : (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }} className="relative w-20 h-20 mb-6">
                  <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full"></div>
                </motion.div>
              )}

              <h2 className="text-xl font-bold mb-2">
                {paymentState === "verifying" ? "Verifying Payment" : 
                 paymentState === "error" ? "Profile Incomplete" : "Processing"}
              </h2>
              
              <p className="text-sm text-muted-foreground max-w-[250px]">
                {paymentState === "verifying" ? "Please wait while we confirm your transaction securely." : 
                 paymentState === "error" ? "Redirecting you back to complete your profile..." : 
                 "Please do not close this window or press the back button."}
              </p>
              
              {(paymentState === "processing" || paymentState === "error") && (
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