import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; 
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
  Search, Clock, History, X, Camera, SwitchCamera,
  QrCode, Store, User 
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
  const location = useLocation(); 
  const { toast } = useToast();
  const { verifyQrCode, verifyByCollectionToken } = useOrdersContext();
  const { logout } = useAuth();
  const { isPrinterConnected, isConnecting, connectPrinter, disconnectPrinter, printTicket } = usePrinter();

  const isFromAdmin = location.state?.fromAdmin || false;

  const [activeScreen, setActiveScreen] = useState<'home' | 'scanner'>(isFromAdmin ? 'scanner' : 'home');
  const [profileData, setProfileData] = useState<{
    full_name: string | null;
    campus_name: string | null;
    campus_code: string | null;
  } | null>(null);

  // Camera State
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

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
  const facingModeRef = useRef(facingMode);
  
  const scanningPausedRef = useRef<boolean>(false); 
  const lastProcessTimeRef = useRef<number>(0); 

  // 🌟 Auto-Connect Tracker 🌟
  const hasAttemptedAutoConnect = useRef<boolean>(false);

  useEffect(() => { facingModeRef.current = facingMode; }, [facingMode]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select(`full_name, campuses:campus_id (name, code)`)
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (data) {
        const campusData = data.campuses as { name: string; code: string } | null;
        setProfileData({
          full_name: data.full_name,
          campus_name: campusData?.name || 'Unknown Campus',
          campus_code: campusData?.code || 'N/A',
        });
      }
    };
    fetchProfile();
  }, []);

  // 🌟 AGGRESSIVE AUTO-CONNECT TRIGGER 🌟
  useEffect(() => {
    if (activeScreen === 'home') {
      hasAttemptedAutoConnect.current = false;
    } else if (activeScreen === 'scanner' && !isPrinterConnected && !hasAttemptedAutoConnect.current) {
      hasAttemptedAutoConnect.current = true;
      connectPrinter(undefined, true); 
    }
  }, [activeScreen, isPrinterConnected, connectPrinter]);

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

      if (scanningPausedRef.current) {
        animationRef.current = requestAnimationFrame(scan);
        return;
      }

      const now = Date.now();
      if (now - lastProcessTimeRef.current < 150) {
        animationRef.current = requestAnimationFrame(scan);
        return;
      }
      lastProcessTimeRef.current = now;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });

      if (code?.data && code.data !== lastScannedRef.current) {
        lastScannedRef.current = code.data;
        scanningPausedRef.current = true;
        handleScan(code.data);
      }
      animationRef.current = requestAnimationFrame(scan);
    };
    animationRef.current = requestAnimationFrame(scan);
  }, []);

  const startCamera = useCallback(async (mode?: 'user' | 'environment') => {
    stopCamera();
    setCameraError(null);
    setShowResult(false);
    setResultType(null);
    setScanning(false);
    scanningPausedRef.current = false; 
    lastScannedRef.current = ''; 

    const useFacing = mode || facingModeRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: useFacing },
          width: { ideal: 640 }, 
          height: { ideal: 480 },
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

  const switchCamera = useCallback(() => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    startCamera(newMode);
  }, [facingMode, startCamera]);

  useEffect(() => {
    if (activeScreen === 'scanner') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeScreen, startCamera, stopCamera]);

  // ─── Core Scan Logic ───
  const handleScan = useCallback(async (qrData: string) => {
    if (scanning) return;
    setScanning(true);

    try {
      const cleanedToken = qrData.trim();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isCollectionToken = uuidRegex.test(cleanedToken);

      if (isCollectionToken) {
        const result = await verifyByCollectionToken(cleanedToken);

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
          setResultMessage('Verified ✓ Printing Token');
          if (soundEnabled) playSuccessSound();

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
        const order = await verifyQrCode(cleanedToken);

        if (!order) {
          setResultType('invalid');
          setResultMessage('Order not found.');
          if (soundEnabled) playErrorSound();
          setLastOrderDetails(null);
        } else {
          if (order.status === 'collected' || order.isUsed) {
            setResultType('used');
            setResultMessage('Already collected.');
            if (soundEnabled) playErrorSound();
          } else if (order.status === 'expired') {
            setResultType('expired');
            setResultMessage('Order expired.');
            if (soundEnabled) playErrorSound();
          } else if (order.status === 'confirmed') {
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
                setResultMessage('Verified ✓ Printing Token');
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
              setResultMessage('Missing collection token.');
              if (soundEnabled) playErrorSound();
            }
          } else {
            setResultType('payment_pending');
            setResultMessage('Payment not confirmed.');
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
      setResultMessage('Scanner error. Try again.');
      setShowResult(true);
      if (soundEnabled) playErrorSound();
    } finally {
      setScanning(false);
    }
  }, [scanning, verifyQrCode, verifyByCollectionToken, soundEnabled, isPrinterConnected, printTicket]);

  const handleManualLookup = async () => {
    if (!manualOrderNumber.trim()) return;
    setIsVerifying(true);
    scanningPausedRef.current = true; 
    await handleScan(manualOrderNumber.trim());
    setIsVerifying(false);
    setManualOrderNumber('');
  };

  const resetAndRestart = useCallback(() => {
    setShowResult(false);
    setResultType(null);
    setResultMessage('');
    setLastOrderDetails(null);
    lastScannedRef.current = '';
    scanCooldownRef.current = false;
    scanningPausedRef.current = false; 
  }, []);

  useEffect(() => {
    if (showResult && resultType) {
      const timer = setTimeout(() => {
        resetAndRestart();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showResult, resultType, resetAndRestart]);

  const getResultConfig = () => {
    switch (resultType) {
      case 'success':
        return { icon: CheckCircle, bg: 'bg-emerald-600', title: 'VERIFIED ✓', color: 'text-white' };
      case 'used':
        return { icon: XCircle, bg: 'bg-amber-600', title: 'ALREADY COLLECTED', color: 'text-white' };
      case 'expired':
        return { icon: AlertCircle, bg: 'bg-orange-600', title: 'EXPIRED', color: 'text-white' };
      case 'payment_pending':
        return { icon: Clock, bg: 'bg-yellow-600', title: 'PAYMENT PENDING', color: 'text-white' };
      case 'invalid':
      default:
        return { icon: XCircle, bg: 'bg-red-600', title: 'INVALID', color: 'text-white' };
    }
  };

  const resultConfig = getResultConfig();
  const ResultIcon = resultConfig.icon;

  if (activeScreen === 'home') {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-end">
          <Button 
            variant="ghost" 
            onClick={() => { logout(); navigate('/auth'); }} 
            className="text-slate-400 hover:text-white hover:bg-red-500/20 rounded-full font-medium transition-all"
          >
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <QrCode className="w-12 h-12 text-emerald-400" />
          </div>
          
          <h1 className="text-3xl font-extrabold mb-1 tracking-tight text-white">Kiosk Terminal</h1>
          <p className="text-slate-400 text-sm mb-8">Ready to process orders</p>

          <div className="bg-slate-950/50 rounded-2xl p-5 w-full mb-8 space-y-4 border border-slate-800/50 text-left">
             <div className="flex items-center gap-3">
               <div className="bg-blue-500/20 p-2.5 rounded-xl">
                 <User className="w-5 h-5 text-blue-400" />
               </div>
               <div>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Terminal Account</p>
                 <p className="font-semibold text-slate-200">
                   {profileData ? profileData.full_name : <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
                 </p>
               </div>
             </div>
             
             <div className="flex items-center gap-3">
               <div className="bg-emerald-500/20 p-2.5 rounded-xl">
                 <Store className="w-5 h-5 text-emerald-400" />
               </div>
               <div>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Linked Canteen</p>
                 <p className="font-bold text-emerald-400">
                   {profileData ? `${profileData.campus_name} (${profileData.campus_code})` : <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
                 </p>
               </div>
             </div>
          </div>

          <Button 
            onClick={() => setActiveScreen('scanner')}
            disabled={!profileData}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-14 text-lg font-bold shadow-[0_8px_30px_rgba(16,185,129,0.3)] transition-all hover:scale-[1.02] active:scale-95"
          >
            <Camera className="w-5 h-5 mr-2" /> Start Scanning
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* ─── HEADER BAR ─── */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent">
        <div className="flex items-center gap-3">
          <button
            onClick={() => isPrinterConnected ? disconnectPrinter() : connectPrinter()}
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

        <div className="flex items-center gap-1 z-50 transition-opacity duration-300">
          <Button
            variant="ghost" size="icon"
            onClick={switchCamera}
            className="text-white hover:bg-white/10"
          >
            <SwitchCamera className="w-5 h-5" />
          </Button>

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

          <Button
            variant="ghost" size="icon"
            onClick={() => setShowManualInput(!showManualInput)}
            className="text-white hover:bg-white/10"
          >
            <Search className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost" size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-white hover:bg-white/10"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              stopCamera();
              if (isFromAdmin) {
                navigate(-1); 
              } else {
                setActiveScreen('home'); 
              }
            }} 
            className="text-white hover:bg-slate-700/50 bg-black/20 rounded-full ml-2 border border-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* ─── MANUAL INPUT BAR ─── */}
      {showManualInput && (
        <div className="absolute top-20 left-0 right-0 z-40 px-4 py-3 bg-black/80 backdrop-blur-lg border-b border-white/10 animate-fade-in">
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
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-72 h-72 z-10">
            <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-lg" />
            <div className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-[scan_2s_ease-in-out_infinite]" 
              style={{ top: '50%' }}
            />
          </div>
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

      {/* ─── COMPACT RESULT BANNER (Success & Error) ─── */}
      {showResult && resultType && (
        <div className="absolute bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-200">
          <div className={`${resultConfig.bg} px-5 py-4 flex items-center gap-3`}>
            <ResultIcon className="w-8 h-8 text-white shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">{resultConfig.title}</p>
              {lastOrderDetails && resultType === 'success' ? (
                <p className="text-white/80 text-xs truncate">
                  #{lastOrderDetails.orderNumber} · ₹{lastOrderDetails.total.toFixed(0)} · {lastOrderDetails.customerName}
                </p>
              ) : (
                <p className="text-white/80 text-xs truncate">{resultMessage}</p>
              )}
            </div>
            {lastOrderDetails && resultType === 'success' && (
              <span className="text-white/60 text-[10px] shrink-0">Auto-closing...</span>
            )}
          </div>
        </div>
      )}

      {/* ─── CAMERA ERROR ─── */}
      {cameraError && (
        <div className="absolute inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
          <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
          <h2 className="text-white text-lg font-semibold mb-2">Camera Error</h2>
          <p className="text-white/60 text-center mb-6 max-w-sm">{cameraError}</p>
          <div className="flex gap-3">
            <Button onClick={() => startCamera()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
                <span>Total: {scannedHistory.length}</span>
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