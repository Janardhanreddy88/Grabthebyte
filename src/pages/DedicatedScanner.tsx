import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useOrdersContext } from '@/context/OrdersContext';
import { useAuth } from '@/context/AuthContext';
import { usePrinter } from '@/context/PrinterContext';
import { supabase } from '@/integrations/supabase/client';
import {
  LogOut, CheckCircle, XCircle, AlertCircle, RefreshCw,
  Bluetooth, BluetoothOff, Volume2, VolumeX, Loader2,
  Printer, Search, Clock, ChevronRight, History, X, Camera
} from 'lucide-react';
import jsQR from 'jsqr';

// ─── Audio Feedback ───
const playSuccessSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) { console.error('Audio error', e); }
};

const playErrorSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) { console.error('Audio error', e); }
};

// ─── Types ───
interface ScannedOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: number;
  items: { name: string; quantity: number; price: number }[];
  scannedAt: Date;
  status: 'success' | 'failed' | 'expired' | 'already_collected';
  message: string;
}

type ResultType = 'success' | 'invalid' | 'expired' | 'used' | 'payment_pending' | null;

export default function KioskScanner() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { verifyQrCode, verifyByCollectionToken } = useOrdersContext();
  const { logout } = useAuth();
  const { isPrinterConnected, isConnecting, isPrinting, connectPrinter, disconnectPrinter, printTicket } = usePrinter();

  // Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // Results State
  const [showResult, setShowResult] = useState(false);
  const [resultType, setResultType] = useState<ResultType>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [lastOrderDetails, setLastOrderDetails] = useState<ScannedOrder | null>(null);

  // UI State
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualOrderNumber, setManualOrderNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [scannedHistory, setScannedHistory] = useState<ScannedOrder[]>([]);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>('');
  const scanCooldownRef = useRef<boolean>(false);

  // ─── Camera Management ───
  const stopCamera = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const scanQRFromCamera = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const scan = () => {
      if (!ctx || !streamRef.current || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationRef.current = requestAnimationFrame(scan);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });

      if (code?.data && !scanCooldownRef.current && code.data !== lastScannedRef.current) {
        lastScannedRef.current = code.data;
        scanCooldownRef.current = true;
        handleScan(code.data);
      }
      animationRef.current = requestAnimationFrame(scan);
    };
    animationRef.current = requestAnimationFrame(scan);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setShowResult(false);
    setResultType(null);
    setScanning(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanQRFromCamera();
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setCameraError(err?.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access.'
        : 'Unable to access camera. Check if another app is using it.'
      );
    }
  }, [stopCamera, scanQRFromCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // ─── Core Scan Logic ───
  const handleScan = useCallback(async (qrData: string) => {
    if (scanning) return;
    setScanning(true);

    try {
      const cleanedToken = qrData.trim();
      

      // Check if it looks like a UUID (collection_token)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isCollectionToken = uuidRegex.test(cleanedToken);

      if (isCollectionToken) {
        // ── Use secure RPC directly with collection_token ──
        const result = await verifyByCollectionToken(cleanedToken);

        // Fetch order details for display
        const { data: orderData } = await supabase
          .from('orders')
          .select(`*, order_items(id, name, price, quantity)`)
          .eq('collection_token', cleanedToken)
          .maybeSingle();

        const scannedOrder: ScannedOrder = {
          id: orderData?.id || '',
          orderNumber: orderData?.order_number || 'Unknown',
          customerName: orderData?.customer_name || 'Customer',
          total: Number(orderData?.total || 0),
          items: (orderData?.order_items || []).map((i: any) => ({
            name: i.name, quantity: i.quantity, price: Number(i.price),
          })),
          scannedAt: new Date(),
          status: result.success ? 'success' : 'failed',
          message: result.message,
        };

        setLastOrderDetails(scannedOrder);
        setScannedHistory(prev => [scannedOrder, ...prev].slice(0, 50));

        if (result.success) {
          setResultType('success');
          setResultMessage('Order Verified! Deliver Food.');
          if (soundEnabled) playSuccessSound();

          // Auto-print
          if (isPrinterConnected && orderData) {
            printTicket({
              orderNumber: orderData.order_number,
              items: scannedOrder.items,
              totalAmount: scannedOrder.total,
              customerName: scannedOrder.customerName,
              createdAt: orderData.created_at,
            });
          }
        } else {
          // Determine specific error type
          if (result.message.includes('Already Collected')) {
            setResultType('used');
          } else if (result.message.includes('Expired')) {
            setResultType('expired');
          } else if (result.message.includes('Payment Not Confirmed')) {
            setResultType('payment_pending');
          } else {
            setResultType('invalid');
          }
          setResultMessage(result.message);
          if (soundEnabled) playErrorSound();
        }
      } else {
        // ── Fallback: Look up by order_number ──
        const order = await verifyQrCode(cleanedToken);

        if (!order) {
          setResultType('invalid');
          setResultMessage('Order not found in database.');
          if (soundEnabled) playErrorSound();
          setLastOrderDetails(null);
        } else {
          // Found order, check status
          if (order.status === 'collected' || order.isUsed) {
            setResultType('used');
            setResultMessage('This order has already been collected.');
            if (soundEnabled) playErrorSound();
          } else if (order.status === 'expired') {
            setResultType('expired');
            setResultMessage('This order has expired (5+ hours old).');
            if (soundEnabled) playErrorSound();
          } else if (order.status === 'confirmed') {
            // Use secure RPC via markOrderCollected
            const { data: tokenData } = await supabase
              .from('orders')
              .select('collection_token')
              .eq('id', order.id)
              .maybeSingle();

            if (tokenData?.collection_token) {
              const result = await verifyByCollectionToken(tokenData.collection_token);

              const scannedOrder: ScannedOrder = {
                id: order.id,
                orderNumber: order.qrCode,
                customerName: order.customerName || 'Customer',
                total: order.total,
                items: order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
                scannedAt: new Date(),
                status: result.success ? 'success' : 'failed',
                message: result.message,
              };

              setLastOrderDetails(scannedOrder);
              setScannedHistory(prev => [scannedOrder, ...prev].slice(0, 50));

              if (result.success) {
                setResultType('success');
                setResultMessage('Order Verified! Deliver Food.');
                if (soundEnabled) playSuccessSound();

                if (isPrinterConnected) {
                  printTicket({
                    orderNumber: order.qrCode,
                    items: scannedOrder.items,
                    totalAmount: order.total,
                    customerName: scannedOrder.customerName,
                    createdAt: order.createdAt.toISOString(),
                  });
                }
              } else {
                setResultType('invalid');
                setResultMessage(result.message);
                if (soundEnabled) playErrorSound();
              }
            } else {
              setResultType('invalid');
              setResultMessage('Order missing collection token.');
              if (soundEnabled) playErrorSound();
            }
          } else {
            setResultType('payment_pending');
            setResultMessage('Payment not yet confirmed for this order.');
            if (soundEnabled) playErrorSound();
          }

          setLastOrderDetails({
            id: order.id,
            orderNumber: order.qrCode,
            customerName: order.customerName || 'Customer',
            total: order.total,
            items: order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })),
            scannedAt: new Date(),
            status: 'failed',
            message: '',
          });
        }
      }

      setShowResult(true);
    } catch (err) {
      console.error('Scan Error:', err);
      setResultType('invalid');
      setResultMessage('Scanner error. Please try again.');
      setShowResult(true);
      if (soundEnabled) playErrorSound();
    } finally {
      setScanning(false);
      // Cooldown before next scan
      setTimeout(() => {
        scanCooldownRef.current = false;
        lastScannedRef.current = '';
      }, 3000);
    }
  }, [scanning, verifyQrCode, verifyByCollectionToken, soundEnabled, isPrinterConnected, printTicket]);

  // ─── Manual Order Lookup ───
  const handleManualLookup = async () => {
    if (!manualOrderNumber.trim()) return;
    setIsVerifying(true);
    await handleScan(manualOrderNumber.trim());
    setIsVerifying(false);
    setManualOrderNumber('');
  };

  // ─── Reset & Restart ───
  const resetAndRestart = useCallback(() => {
    setShowResult(false);
    setResultType(null);
    setResultMessage('');
    setLastOrderDetails(null);
    lastScannedRef.current = '';
    scanCooldownRef.current = false;
    startCamera();
  }, [startCamera]);

  // Auto-dismiss error overlays after 3s
  useEffect(() => {
    if (showResult && resultType && resultType !== 'success') {
      const timer = setTimeout(() => {
        setShowResult(false);
        setResultType(null);
        scanCooldownRef.current = false;
        lastScannedRef.current = '';
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showResult, resultType]);

  // ─── Result Config ───
  const getResultConfig = () => {
    switch (resultType) {
      case 'success':
        return { icon: CheckCircle, bg: 'bg-emerald-600', title: 'VERIFIED ✓', color: 'text-white' };
      case 'used':
        return { icon: XCircle, bg: 'bg-amber-600', title: 'ALREADY COLLECTED', color: 'text-white' };
      case 'expired':
        return { icon: AlertCircle, bg: 'bg-orange-600', title: 'ORDER EXPIRED', color: 'text-white' };
      case 'payment_pending':
        return { icon: Clock, bg: 'bg-yellow-600', title: 'PAYMENT PENDING', color: 'text-white' };
      case 'invalid':
      default:
        return { icon: XCircle, bg: 'bg-red-600', title: 'INVALID', color: 'text-white' };
    }
  };

  const resultConfig = getResultConfig();
  const ResultIcon = resultConfig.icon;

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* ─── HEADER BAR ─── */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
        <div className="flex items-center gap-3">
          {/* Printer Status */}
          <button
            onClick={isPrinterConnected ? disconnectPrinter : connectPrinter}
            disabled={isConnecting}
            className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 active:scale-95 transition-transform"
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : isPrinterConnected ? (
              <Bluetooth className="w-4 h-4 text-green-400" />
            ) : (
              <BluetoothOff className="w-4 h-4 text-yellow-400" />
            )}
            <span className="text-white text-xs font-medium">
              {isConnecting ? 'Connecting...' : isPrinterConnected ? 'Printer Ready' : 'No Printer'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* History Toggle */}
          <Button
            variant="ghost" size="icon"
            onClick={() => setShowHistory(!showHistory)}
            className="text-white hover:bg-white/10 relative"
          >
            <History className="w-5 h-5" />
            {scannedHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {scannedHistory.length}
              </span>
            )}
          </Button>

          {/* Manual Input Toggle */}
          <Button
            variant="ghost" size="icon"
            onClick={() => setShowManualInput(!showManualInput)}
            className="text-white hover:bg-white/10"
          >
            <Search className="w-5 h-5" />
          </Button>

          {/* Sound Toggle */}
          <Button
            variant="ghost" size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-white hover:bg-white/10"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>

          {/* Logout */}
          <Button
            variant="ghost" size="icon"
            onClick={() => { stopCamera(); logout(); navigate('/auth'); }}
            className="text-white hover:bg-red-500/20"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* ─── MANUAL INPUT BAR ─── */}
      {showManualInput && (
        <div className="absolute top-16 left-0 right-0 z-40 px-4 py-3 bg-black/80 backdrop-blur-lg border-b border-white/10 animate-fade-in">
          <div className="flex gap-2 max-w-md mx-auto">
            <Input
              placeholder="Enter order number (e.g. RCDC-0042)"
              value={manualOrderNumber}
              onChange={(e) => setManualOrderNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-emerald-500"
              autoFocus
            />
            <Button
              onClick={handleManualLookup}
              disabled={isVerifying || !manualOrderNumber.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
            >
              {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* ─── CAMERA VIDEO ─── */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover ${!cameraActive ? 'opacity-0' : ''}`}
        muted
        playsInline
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* ─── SCANNING RETICLE ─── */}
      {!showResult && cameraActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          {/* Dim overlay with cutout */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Reticle */}
          <div className="relative w-72 h-72 z-10">
            {/* Corner markers */}
            <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-lg" />

            {/* Scan line animation */}
            <div className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-[scan_2s_ease-in-out_infinite]" 
              style={{ top: '50%' }}
            />
          </div>

          {/* Status Text */}
          <div className="absolute bottom-24 z-10">
            <div className="bg-black/60 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-sm font-medium border border-white/10">
              {scanning ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Point at QR Code
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── ERROR OVERLAYS (Auto-dismiss) ─── */}
      {showResult && resultType && resultType !== 'success' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <div className={`p-8 rounded-3xl flex flex-col items-center shadow-2xl max-w-sm mx-4 ${resultConfig.bg}`}>
            <ResultIcon className="w-20 h-20 text-white mb-4" />
            <h2 className="text-2xl font-bold text-white text-center">{resultConfig.title}</h2>
            <p className="text-white/80 mt-3 text-center text-sm">{resultMessage}</p>
            {lastOrderDetails && (
              <div className="mt-4 bg-white/10 rounded-xl p-3 w-full">
                <p className="text-white/90 text-sm font-mono text-center">#{lastOrderDetails.orderNumber}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── SUCCESS SCREEN ─── */}
      {showResult && resultType === 'success' && (
        <div className="absolute inset-0 z-50 bg-emerald-600 flex flex-col items-center justify-center p-6 animate-in slide-in-from-bottom-10 duration-300">
          <div className="relative">
            <CheckCircle className="w-28 h-28 text-white mb-4" />
            <div className="absolute inset-0 animate-ping">
              <CheckCircle className="w-28 h-28 text-white/30" />
            </div>
          </div>

          <h1 className="text-4xl font-extrabold text-white mt-2 tracking-tight">VERIFIED!</h1>
          <p className="text-white/80 text-sm mt-1">Deliver the food to the customer</p>

          {lastOrderDetails && (
            <div className="mt-6 w-full max-w-sm">
              <div className="bg-white/15 backdrop-blur-md rounded-2xl p-5 border border-white/20">
                <p className="text-2xl font-mono font-bold text-white text-center mb-3">
                  #{lastOrderDetails.orderNumber}
                </p>
                <div className="space-y-2 mb-4">
                  {lastOrderDetails.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-white/90 text-sm">
                      <span>{item.quantity}x {item.name}</span>
                      <span>₹{(item.price * item.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/20 pt-3 flex justify-between text-white font-bold">
                  <span>Total</span>
                  <span>₹{lastOrderDetails.total.toFixed(0)}</span>
                </div>
              </div>

              {/* Print button if printer connected */}
              {isPrinterConnected && (
                <Button
                  onClick={() => {
                    printTicket({
                      orderNumber: lastOrderDetails.orderNumber,
                      items: lastOrderDetails.items,
                      totalAmount: lastOrderDetails.total,
                      customerName: lastOrderDetails.customerName,
                      createdAt: lastOrderDetails.scannedAt.toISOString(),
                    });
                  }}
                  disabled={isPrinting}
                  className="w-full mt-3 bg-white/20 hover:bg-white/30 text-white border border-white/30"
                >
                  {isPrinting ? (
                    <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Printing...</>
                  ) : (
                    <><Printer className="w-4 h-4 mr-2" /> Reprint Ticket</>
                  )}
                </Button>
              )}
            </div>
          )}

          <Button
            onClick={resetAndRestart}
            size="lg"
            className="mt-6 bg-white text-emerald-700 hover:bg-white/90 font-bold px-8 rounded-full shadow-lg"
          >
            <RefreshCw className="w-5 h-5 mr-2" /> Scan Next Order
          </Button>
        </div>
      )}

      {/* ─── CAMERA ERROR ─── */}
      {cameraError && (
        <div className="absolute inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
          <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
          <h2 className="text-white text-lg font-semibold mb-2">Camera Error</h2>
          <p className="text-white/60 text-center mb-6 max-w-sm">{cameraError}</p>
          <div className="flex gap-3">
            <Button onClick={startCamera} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <RefreshCw className="w-4 h-4 mr-2" /> Retry Camera
            </Button>
            <Button
              variant="outline"
              onClick={() => { setCameraError(null); setShowManualInput(true); }}
              className="border-white/20 text-white hover:bg-white/10"
            >
              <Search className="w-4 h-4 mr-2" /> Manual Entry
            </Button>
          </div>
        </div>
      )}

      {/* ─── ORDER HISTORY SIDEBAR ─── */}
      {showHistory && (
        <div className="absolute top-0 right-0 bottom-0 z-50 w-80 bg-gray-950/95 backdrop-blur-xl border-l border-white/10 flex flex-col animate-slide-in-right">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <History className="w-4 h-4" /> Scan History
            </h3>
            <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)} className="text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {scannedHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-white/40">
                <History className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No scans yet</p>
              </div>
            ) : (
              scannedHistory.map((order, i) => (
                <div
                  key={`${order.id}-${i}`}
                  className={`rounded-xl p-3 border ${
                    order.status === 'success'
                      ? 'bg-emerald-900/30 border-emerald-500/30'
                      : 'bg-red-900/20 border-red-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-mono text-sm font-bold">#{order.orderNumber}</span>
                    {order.status === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <p className="text-white/50 text-xs">{order.customerName}</p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-white/70 text-xs">₹{order.total.toFixed(0)}</span>
                    <span className="text-white/40 text-[10px]">
                      {order.scannedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {scannedHistory.length > 0 && (
            <div className="p-3 border-t border-white/10">
              <div className="flex justify-between text-xs text-white/50">
                <span>Total Scanned: {scannedHistory.length}</span>
                <span>Verified: {scannedHistory.filter(o => o.status === 'success').length}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Scan Line Animation ─── */}
      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-60px); opacity: 0.3; }
          50% { transform: translateY(60px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
