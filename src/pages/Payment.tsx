import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle2, RefreshCw, ArrowLeft, CreditCard, XCircle, ChevronRight, Home, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { Capacitor } from '@capacitor/core';

// 🚨 Tell TypeScript that these Razorpay objects exist on the window!
declare global {
  interface Window {
    Razorpay: any;
    RazorpayCheckout: any;
  }
}

type PaymentState = 'loading' | 'initiating' | 'processing' | 'verifying' | 'success' | 'failed' | 'error';

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
  const [errorMessage, setErrorMessage] = useState("");
  const paymentInitiated = useRef(false);

  // 🔥 Helper to safely extract exact error messages (Bank failures, User cancellations, etc.)
  const extractErrorMessage = (errorResponse: any) => {
    if (typeof errorResponse === 'string') return errorResponse;
    if (errorResponse?.error?.description) return errorResponse.error.description;
    if (errorResponse?.description) return errorResponse.description;
    if (errorResponse?.message) return errorResponse.message;
    return 'Payment process was interrupted or failed.';
  };

  // INITIATE DUAL-ENGINE PAYMENT
  const initiatePayment = useCallback(async () => {
    if (!orderId || !amount || !user || paymentInitiated.current) return;
    paymentInitiated.current = true;
    setPaymentState('initiating');

    try {
      const { data: order } = await supabase
        .from('orders')
        .select('order_number, customer_name, customer_email, customer_phone')
        .eq('id', orderId)
        .single();
        
      if (!order) throw new Error('Order not found');
      setOrderNumber(order.order_number);

      const realPhoneNumber = order.customer_phone || user.phone || "";

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          orderId,
          amount: parseFloat(amount),
          customerName: order.customer_name || user.fullName,
          customerEmail: order.customer_email || user.email,
          customerPhone: realPhoneNumber 
        }
      });

      if (error || !data?.razorpayOrderId) throw new Error(data?.error || 'Failed to create Razorpay session');
      
      const currentRzpOrderId = data.razorpayOrderId;
      const currentKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;

      setPaymentState('processing');

      const processSuccess = async (response: any) => {
        let paymentId = "";
        let signature = "";

        if (typeof response === 'string') {
          paymentId = response;
        } else if (typeof response === 'object' && response !== null) {
          paymentId = response.razorpay_payment_id || response.payment_id || "";
          signature = response.razorpay_signature || response.signature || "";
        }

        setPaymentState('verifying');
        try {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-payment', {
            body: {
              orderId: orderId,
              razorpay_payment_id: paymentId,
              razorpay_order_id: currentRzpOrderId, 
              razorpay_signature: signature, 
              razorpay_key_id: currentKeyId 
            }
          });

          let isSuccess = false;
          if (verifyData && typeof verifyData === 'object' && verifyData.success) {
            isSuccess = true;
          } else if (typeof verifyData === 'string') {
            try { isSuccess = JSON.parse(verifyData).success; } catch (e) {}
          }

          if (verifyError || !isSuccess) {
            throw new Error('Payment verification failed on server');
          }

          setPaymentState('success');
          clearCart();
          // 🔥 DELETED THE AUTO-REDIRECT! The user stays on this screen now.
          toast({ title: "Payment Successful!", className: "bg-green-600 text-white border-none" });

        } catch (err) {
          console.error(err);
          setPaymentState('error');
          setErrorMessage('Payment was charged, but verification failed. Contact support.');
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
        prefill: {
          name: order.customer_name || user.fullName,
          email: order.customer_email || user.email,
          contact: realPhoneNumber 
        },
        theme: {
          color: "#E50914" 
        }
      };

      if (Capacitor.isNativePlatform()) {
        console.log("📱 Triggering Native Razorpay SDK...");
        window.RazorpayCheckout.open(
          options,
          (paymentResponse: any) => processSuccess(paymentResponse),
          (errorResponse: any) => {
            setPaymentState('failed');
            setErrorMessage(extractErrorMessage(errorResponse));
            paymentInitiated.current = false;
          }
        );
      } else {
        console.log("💻 Triggering Web Razorpay SDK...");
        const res = await loadRazorpayScript();
        if (!res) throw new Error("Razorpay SDK failed to load. Are you online?");

        const webOptions = {
          ...options,
          handler: function (response: any) { processSuccess(response); },
          modal: {
            ondismiss: function() {
              setPaymentState('failed');
              setErrorMessage('Payment window was closed.');
              paymentInitiated.current = false;
            }
          }
        };

        const rzp = new window.Razorpay(webOptions);
        rzp.on('payment.failed', function (response: any) {
          setPaymentState('failed');
          setErrorMessage(extractErrorMessage(response));
          paymentInitiated.current = false;
        });
        rzp.open();
      }

    } catch (err) {
      setPaymentState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Payment initiation failed');
      paymentInitiated.current = false;
    }
  }, [orderId, amount, user, navigate, toast]);

  useEffect(() => {
    if (orderId && amount && user && paymentState === 'loading') {
      initiatePayment();
    }
  }, [orderId, amount, user, paymentState, initiatePayment]);

  const handleRetry = () => { paymentInitiated.current = false; setPaymentState('loading'); };

  // 🚀 UPGRADED PREMIUM UI COMPONENTS WITH QR CODE & BUTTONS
  const renderContent = () => {
    switch (paymentState) {
      case "loading":
      case "initiating":
      case "processing":
      case "verifying":
        return (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="relative w-20 h-20 mb-6"
            >
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full"></div>
            </motion.div>
            <h2 className="text-xl font-bold mb-2">
              {paymentState === "verifying" ? "Verifying Payment" : "Processing"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-[250px]">
              {paymentState === "verifying" 
                ? "Please wait while we confirm your transaction securely." 
                : "Please do not close this window or press the back button."}
            </p>
            {paymentState === "processing" && (
              <Button variant="ghost" size="sm" onClick={handleRetry} className="mt-6 gap-2 text-muted-foreground">
                <RefreshCw size={14} /> Re-open Payment
              </Button>
            )}
          </div>
        );

      case "success":
        return (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-4 relative"
            >
              <motion.div 
                initial={{ scale: 0 }} 
                animate={{ scale: 1 }} 
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30"
              >
                <CheckCircle2 className="w-7 h-7 text-white" strokeWidth={3} />
              </motion.div>
            </motion.div>
            
            <h2 className="text-2xl font-extrabold text-foreground mb-1">Payment Successful!</h2>
            
            <div className="bg-secondary/50 rounded-lg px-4 py-2 mb-4 border border-border/50">
              <p className="text-sm font-medium text-muted-foreground">Order ID: <span className="text-foreground font-bold">#{orderNumber}</span></p>
            </div>

            {/* 🔥 LIVE QR CODE GENERATOR INCORPORATED HERE */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white p-3.5 rounded-2xl shadow-sm border border-border/80 mb-3 inline-block"
            >
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${orderId}`} 
                alt="Order QR Code" 
                className="w-36 h-36"
              />
            </motion.div>
            
            <p className="text-xs font-medium text-muted-foreground mb-8 max-w-[220px]">
              Show this QR code at the canteen counter to collect your order.
            </p>

            {/* 🔥 NEW ACTION BUTTONS */}
            <div className="w-full flex flex-col gap-3">
              <Button 
                onClick={() => navigate("/my-orders")} 
                className="w-full h-12 rounded-xl text-base font-bold shadow-md shadow-primary/20"
              >
                <Receipt size={18} className="mr-2" /> View Order Details
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/menu")} 
                className="w-full h-12 rounded-xl text-base font-semibold border-border/80 hover:bg-secondary/50"
              >
                <Home size={18} className="mr-2 text-muted-foreground" /> Back to Home
              </Button>
            </div>
          </div>
        );

      case "failed":
      case "error":
        return (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-5"
            >
              <div className="w-14 h-14 bg-destructive rounded-full flex items-center justify-center shadow-lg shadow-destructive/30">
                <XCircle className="w-7 h-7 text-white" strokeWidth={2.5} />
              </div>
            </motion.div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {paymentState === "error" ? "Something went wrong" : "Payment Incomplete"}
            </h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-[260px] leading-relaxed">
              {errorMessage}
            </p>
            
            <div className="w-full flex flex-col gap-3">
              <Button 
                onClick={handleRetry} 
                className="w-full h-12 rounded-xl text-base font-bold shadow-md shadow-primary/20"
              >
                <RefreshCw size={18} className="mr-2" /> Try Payment Again
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/my-orders")} 
                className="w-full h-12 rounded-xl text-base font-semibold border-border/80 hover:bg-secondary/50"
              >
                View My Orders <ChevronRight size={18} className="ml-1 text-muted-foreground" />
              </Button>
            </div>
          </div>
        );
    }
  };

  if (!orderId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-card rounded-2xl border border-border p-8 text-center shadow-sm">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Invalid Payment Link</h2>
          <p className="text-sm text-muted-foreground mb-6">We couldn't find the details for this order.</p>
          <Button onClick={() => navigate("/menu")} className="w-full h-11 rounded-xl">
            Return to Menu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border/40 px-4 py-3 safe-top">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-secondary/50"
            onClick={() => navigate("/menu")}
            disabled={paymentState === "initiating" || paymentState === "verifying"}
          >
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
          {amount && paymentState !== "success" && (
            <div className="text-center p-6 bg-secondary/30 border-b border-border/50">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Amount to Pay</p>
              <p className="text-4xl font-black text-foreground tracking-tight">₹{amount}</p>
            </div>
          )}
          <div className="p-2">{renderContent()}</div>
        </div>
        
        {paymentState !== "success" && (
          <div className="mt-8 flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground">
            <CheckCircle2 size={14} className="text-green-600" /> 100% Secure & Encrypted Payments
          </div>
        )}
      </main>
    </div>
  );
}