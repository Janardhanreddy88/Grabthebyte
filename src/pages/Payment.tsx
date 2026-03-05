import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle2, RefreshCw, ArrowLeft, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

declare global {
  interface Window {
    Cashfree?: (config: { mode: string }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget?: string;
      }) => Promise<{ error?: { message: string }; paymentDetails?: unknown }>;
    };
  }
}

type PaymentState = 'loading' | 'initiating' | 'processing' | 'verifying' | 'success' | 'failed' | 'error';

export default function Payment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const orderId = searchParams.get('order_id');
  const amount = searchParams.get('amount');
  const cfOrderIdParam = searchParams.get('cf_order_id');
  const isRedirect = searchParams.get('redirect') === 'true';

  const [paymentState, setPaymentState] = useState<PaymentState>('loading');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [sdkReady, setSdkReady] = useState(false);
  
  const paymentInitiated = useRef(false);
  const verificationAttempts = useRef(0);
  const maxVerificationAttempts = 5;

  // Load Cashfree SDK
  useEffect(() => {
    const loadSdk = () => {
      if (document.getElementById('cashfree-sdk')) {
        if (window.Cashfree) {
          setSdkReady(true);
        }
        return;
      }

      const script = document.createElement('script');
      script.id = 'cashfree-sdk';
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      script.onload = () => setSdkReady(true);
      script.onerror = () => {
        setPaymentState('error');
        setErrorMessage('Payment SDK failed to load. Please refresh the page.');
      };
      document.head.appendChild(script);
    };

    loadSdk();
  }, []);

  // Verify payment status
  const verifyPayment = useCallback(async () => {
    if (!orderId) return;

    try {
      setPaymentState('verifying');
      
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { orderId, cfOrderId: cfOrderIdParam }
      });

      if (error) {
        setPaymentState('error');
        setErrorMessage('Could not verify payment status');
        return;
      }

      if (data.status === 'completed') {
        setPaymentState('success');
        setOrderNumber(data.orderNumber);
        setTimeout(() => {
          navigate(`/order-success?orderId=${orderId}`);
        }, 2000);
      } else if (data.status === 'failed') {
        setPaymentState('failed');
        setErrorMessage('Payment was not completed. Please try again.');
      } else {
        verificationAttempts.current += 1;
        if (verificationAttempts.current < maxVerificationAttempts) {
          setTimeout(() => verifyPayment(), 2000);
        } else {
          setPaymentState('failed');
          setErrorMessage('Payment verification timed out. If you completed the payment, check My Orders shortly.');
        }
      }
    } catch {
      setPaymentState('error');
      setErrorMessage('Could not verify payment');
    }
  }, [orderId, cfOrderIdParam, navigate]);

  // If redirected from Cashfree, verify payment
  useEffect(() => {
    if (isRedirect && orderId) {
      verifyPayment();
    }
  }, [isRedirect, orderId, verifyPayment]);

  // Initiate payment
  const initiatePayment = useCallback(async () => {
    if (!orderId || !amount || !user || paymentInitiated.current) return;

    paymentInitiated.current = true;
    setPaymentState('initiating');

    try {
      const { data: order } = await supabase
        .from('orders')
        .select('order_number, customer_name, customer_email')
        .eq('id', orderId)
        .single();

      if (!order) throw new Error('Order not found');

      setOrderNumber(order.order_number);

      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: {
          orderId,
          amount: parseFloat(amount),
          customerName: order.customer_name || user.fullName,
          customerEmail: order.customer_email || user.email,
          customerPhone: user.phone || '9999999999',
        }
      });

      if (error || !data?.sessionId) {
        throw new Error(data?.error || 'Failed to create payment session');
      }

      let attempts = 0;
      while (!window.Cashfree && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.Cashfree) throw new Error('Payment SDK failed to load');

      setPaymentState('processing');

      const cashfree = window.Cashfree({ mode: 'production' });
      const result = await cashfree.checkout({
        paymentSessionId: data.sessionId,
        redirectTarget: '_self',
      });

      if (result.error) {
        setPaymentState('failed');
        setErrorMessage(result.error.message || 'Payment failed');
      }
    } catch (err) {
      setPaymentState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Payment initiation failed');
      paymentInitiated.current = false;
    }
  }, [orderId, amount, user]);

  // Start payment if not redirect
  useEffect(() => {
    if (!isRedirect && orderId && amount && user && paymentState === 'loading') {
      initiatePayment();
    }
  }, [isRedirect, orderId, amount, user, paymentState, initiatePayment]);

  // Handle retry
  const handleRetry = () => {
    paymentInitiated.current = false;
    verificationAttempts.current = 0;
    setPaymentState('loading');
    initiatePayment();
  };

  // Render based on state
  const renderContent = () => {
    switch (paymentState) {
      case 'loading':
      case 'initiating':
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
            <h2 className="text-xl font-bold mb-2">Preparing Payment</h2>
            <p className="text-muted-foreground">Setting up secure payment...</p>
          </div>
        );

      case 'processing':
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CreditCard className="w-10 h-10 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Complete Your Payment</h2>
            <p className="text-muted-foreground mb-4">
              If the payment window didn't open, click below
            </p>
            <Button onClick={handleRetry} className="gap-2">
              <RefreshCw size={16} /> Open Payment
            </Button>
          </div>
        );

      case 'verifying':
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-10 h-10 text-yellow-600 animate-spin" />
            </div>
            <h2 className="text-xl font-bold mb-2">Verifying Payment</h2>
            <p className="text-muted-foreground">Please wait while we confirm your payment...</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </motion.div>
            <h2 className="text-xl font-bold mb-2 text-green-600">Payment Successful!</h2>
            <p className="text-muted-foreground mb-4">
              Order #{orderNumber} confirmed
            </p>
            <p className="text-sm text-muted-foreground">Redirecting to your order...</p>
          </div>
        );

      case 'failed':
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-orange-600" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-orange-600">Payment Incomplete</h2>
            <p className="text-muted-foreground mb-6">{errorMessage}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate('/my-orders')}>
                View Orders
              </Button>
              <Button onClick={handleRetry} className="gap-2 bg-orange-600 hover:bg-orange-700">
                <RefreshCw size={16} /> Try Again
              </Button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-destructive">Something Went Wrong</h2>
            <p className="text-muted-foreground mb-6">{errorMessage}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => navigate('/menu')}>
                Back to Menu
              </Button>
              <Button onClick={handleRetry} className="gap-2">
                <RefreshCw size={16} /> Retry
              </Button>
            </div>
          </div>
        );
    }
  };

  // No order ID
  if (!orderId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">Invalid Payment Link</h2>
            <p className="text-muted-foreground mb-4">No order information found</p>
            <Button onClick={() => navigate('/menu')}>Go to Menu</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/my-orders')}
            disabled={paymentState === 'initiating' || paymentState === 'verifying'}
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Payment</h1>
            {orderNumber && (
              <p className="text-xs text-muted-foreground">Order #{orderNumber}</p>
            )}
          </div>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <Card className="border-border shadow-lg">
          <CardContent className="p-6">
            {amount && (
              <div className="text-center mb-6 pb-6 border-b border-border">
                <p className="text-sm text-muted-foreground mb-1">Amount to Pay</p>
                <p className="text-4xl font-black text-primary">₹{amount}</p>
              </div>
            )}
            {renderContent()}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}