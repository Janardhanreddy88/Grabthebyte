import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; 
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useOrdersContext } from '@/context/OrdersContext';
import { useAuth } from '@/context/AuthContext';
import { usePrinter, BluetoothDevice } from '@/context/PrinterContext';
import { supabase } from '@/integrations/supabase/client';
import {
  LogOut, CheckCircle, XCircle, AlertCircle, RefreshCw,
  Bluetooth, BluetoothOff, Volume2, VolumeX, Loader2,
  Clock, History, X, Camera, SwitchCamera,
  QrCode, Store, User, Lock, Unlock, SunMedium, Search,
  Settings2, Printer, Trash2
} from 'lucide-react';
import jsQR from 'jsqr';
import { useCampusBouncer } from '@/hooks/useCampusBouncer'; 

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
  interface MediaTrackConstraintSet {
    focusMode?: string;
  }
}

interface SupabaseOrderItem {
  id: string;
  name: string;
  price: number | string;
  quantity: number;
}

const playSuccessSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
  
  const { 
    isPrinterConnected, isConnecting, connectPrinter, disconnectPrinter, printTicket,
    savedMacAddress, savePrinterProfile, clearPrinterProfile,
    isScanningBluetooth, scanForDevices, pairedDevices, unpairedDevices, isWebMode
  } = usePrinter();

  useCampusBouncer();

  const isFromAdmin = location.state?.fromAdmin || false;

  const [activeScreen, setActiveScreen] = useState<'home' | 'scanner'>(isFromAdmin ? 'scanner' : 'home');
  const [profileData, setProfileData] = useState<{
    full_name: string | null;
    campus_name: string | null;
    campus_code: string | null;
  } | null>(null);

  const [showPrinterSetup, setShowPrinterSetup] = useState(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const [isSleeping, setIsSleeping] = useState(false);
  const [showGlareWarning, setShowGlareWarning] = useState(false);

  const [isLocked, setIsLocked] = useState(false);
  const unlockClickCount = useRef(0);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showResult, setShowResult] = useState(false);
  const [resultType, setResultType] = useState<ResultType>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [lastOrderDetails, setLastOrderDetails] = useState<ScannedOrder | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualOrderNumber, setManualOrderNumber] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [scannedHistory, setScannedHistory] = useState<ScannedOrder[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>('');
  const facingModeRef = useRef(facingMode);
  
  const scanningPausedRef = useRef<boolean>(false); 
  const lastProcessTimeRef = useRef<number>(0); 
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); 
  const glareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { facingModeRef.current = facingMode; }, [facingMode]);

  useEffect(() => {
    if (!isLocked) return;
    window.history.pushState(null, '', window.location.href);
    const blockBackButton = () => {
      window.history.pushState(null, '', window.location.href);
      toast({ title: 'Kiosk Locked 🔒', description: 'You must unlock the screen to leave this page.', variant: 'destructive' });
    };
    window.addEventListener('popstate', blockBackButton);
    return () => window.removeEventListener('popstate', blockBackButton);
  }, [isLocked, toast]);

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

  const handleSignOut = async () => {
    if (logout) await logout();
    localStorage.removeItem('campus_code');
    localStorage.removeItem('campus_name');
    localStorage.removeItem('campus_id');
    localStorage.removeItem('selected_campus');
    navigate('/');
  };

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
    if (glareTimerRef.current) clearTimeout(glareTimerRef.current);
    setShowGlareWarning(false);
  }, []);

  const resetTimers = useCallback(() => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    sleepTimerRef.current = setTimeout(() => {
      setIsSleeping(true);
      stopCamera();
    }, 120000); 

    if (glareTimerRef.current) clearTimeout(glareTimerRef.current);
    setShowGlareWarning(false);
    glareTimerRef.current = setTimeout(() => {
      setShowGlareWarning(true); 
    }, 6000);
  }, [stopCamera]);

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
      
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });

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
    setIsSleeping(false); 
    scanningPausedRef.current = false; 
    lastScannedRef.current = ''; 

    const useFacing = mode || facingModeRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: useFacing },
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          advanced: [{ focusMode: "continuous" }],
        },
      });
      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        scanQRFromCamera();
        resetTimers(); 
      }
    } catch (err: unknown) {
      const errorName = err instanceof Error ? err.name : 'Unknown error';
      setCameraError(errorName === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access.'
        : 'Unable to access camera. Check if another app is using it.'
      );
    }
  }, [stopCamera, scanQRFromCamera, resetTimers]);

  const wakeUpScanner = useCallback(() => {
    setIsSleeping(false);
    startCamera();
  }, [startCamera]);

  const switchCamera = useCallback(() => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    startCamera(newMode);
  }, [facingMode, startCamera]);

  useEffect(() => {
    if (activeScreen === 'scanner') { startCamera(); } 
    else {
      stopCamera();
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (glareTimerRef.current) clearTimeout(glareTimerRef.current);
    }
    return () => {
      stopCamera();
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (glareTimerRef.current) clearTimeout(glareTimerRef.current);
    };
  }, [activeScreen, startCamera, stopCamera]);

  const handleUnlockAttempt = () => {
    unlockClickCount.current += 1;
    if (unlockClickCount.current === 1) {
      unlockTimerRef.current = setTimeout(() => { unlockClickCount.current = 0; }, 2000);
    }
    if (unlockClickCount.current >= 3) {
      setIsLocked(false);
      unlockClickCount.current = 0;
      if (unlockTimerRef.current) clearTimeout(unlockTimerRef.current);
      toast({ title: 'Kiosk Unlocked', description: 'Settings are now accessible.' });
    }
  };

  const handleLockScreen = () => {
    setIsLocked(true);
    setShowManualInput(false);
    setShowHistory(false);
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch((e) => console.log(e));
    }
    toast({ title: 'Kiosk Locked', description: 'Tap the lock icon 3 times quickly to unlock.' });
  };

  const handleScan = useCallback(async (qrData: string) => {
    if (scanning) return;
    setScanning(true);
    resetTimers(); 

    try {
      const cleanedToken = qrData.trim();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isCollectionToken = uuidRegex.test(cleanedToken);

      if (isCollectionToken) {
        const result = await verifyByCollectionToken(cleanedToken);
        const { data: orderData } = await supabase.from('orders').select(`*, order_items(id, name, price, quantity)`).eq('collection_token', cleanedToken).maybeSingle();

        const scannedOrder: ScannedOrder = {
          id: orderData?.id || '',
          orderNumber: orderData?.order_number || 'Unknown',
          customerName: orderData?.customer_name || 'Customer',
          total: Number(orderData?.total || 0),
          items: (orderData?.order_items || []).map((i: SupabaseOrderItem) => ({ name: i.name, quantity: i.quantity, price: Number(i.price) })),
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
              promoCode: orderData.promo_code,
              platformFee: orderData.platform_fee,
            });
          }
        } else {
          if (result.message.includes('Already Collected')) setResultType('used');
          else if (result.message.includes('Expired')) setResultType('expired');
          else if (result.message.includes('Payment Not Confirmed')) setResultType('payment_pending');
          else setResultType('invalid');
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
            setResultType('used'); setResultMessage('Already collected.'); if (soundEnabled) playErrorSound();
          } else if (order.status === 'expired') {
            setResultType('expired'); setResultMessage('Order expired.'); if (soundEnabled) playErrorSound();
          } else if (order.status === 'confirmed') {
            const { data: tokenData } = await supabase.from('orders').select('collection_token, promo_code, platform_fee').eq('id', order.id).maybeSingle();
            if (tokenData?.collection_token) {
              const result = await verifyByCollectionToken(tokenData.collection_token);
              const scannedOrder: ScannedOrder = {
                id: order.id, orderNumber: order.qrCode, customerName: order.customerName || 'Customer', total: order.total,
                items: order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })), scannedAt: new Date(), status: result.success ? 'success' : 'failed', message: result.message,
              };
              setLastOrderDetails(scannedOrder);
              setScannedHistory(prev => [scannedOrder, ...prev].slice(0, 50));
              if (result.success) {
                setResultType('success'); setResultMessage('Verified ✓ Printing Token'); if (soundEnabled) playSuccessSound();
                if (isPrinterConnected) {
                  printTicket({ orderNumber: order.qrCode, items: scannedOrder.items, totalAmount: order.total, customerName: scannedOrder.customerName, createdAt: order.createdAt.toISOString(), promoCode: tokenData.promo_code, platformFee: tokenData.platform_fee });
                }
              } else {
                setResultType('invalid'); setResultMessage(result.message); if (soundEnabled) playErrorSound();
              }
            } else {
              setResultType('invalid'); setResultMessage('Missing collection token.'); if (soundEnabled) playErrorSound();
            }
          } else {
            setResultType('payment_pending'); setResultMessage('Payment not confirmed.'); if (soundEnabled) playErrorSound();
          }
          setLastOrderDetails({ id: order.id, orderNumber: order.qrCode, customerName: order.customerName || 'Customer', total: order.total, items: order.items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price })), scannedAt: new Date(), status: 'failed', message: '' });
        }
      }
      setShowResult(true);
    } catch (err) {
      console.error('Scan Error:', err); setResultType('invalid'); setResultMessage('Scanner error. Try again.'); setShowResult(true); if (soundEnabled) playErrorSound();
    } finally {
      setScanning(false);
    }
  }, [scanning, verifyQrCode, verifyByCollectionToken, soundEnabled, isPrinterConnected, printTicket, resetTimers]);

  const handleManualLookup = async () => {
    if (!manualOrderNumber.trim()) return;
    setIsVerifying(true); scanningPausedRef.current = true; 
    await handleScan(manualOrderNumber.trim());
    setIsVerifying(false); setManualOrderNumber('');
  };

 const resetAndRestart = useCallback(() => {
    setShowResult(false); setResultType(null); setResultMessage(''); setLastOrderDetails(null);
    lastScannedRef.current = ''; scanningPausedRef.current = false; 
    resetTimers(); 
  }, [resetTimers]);

  useEffect(() => {
    if (showResult && resultType) {
      const timer = setTimeout(() => { resetAndRestart(); }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showResult, resultType, resetAndRestart]);

  const getResultConfig = () => {
    switch (resultType) {
      case 'success': return { icon: CheckCircle, bg: 'bg-emerald-600', title: 'VERIFIED ✓', color: 'text-white' };
      case 'used': return { icon: XCircle, bg: 'bg-amber-600', title: 'ALREADY COLLECTED', color: 'text-white' };
      case 'expired': return { icon: AlertCircle, bg: 'bg-orange-600', title: 'EXPIRED', color: 'text-white' };
      case 'payment_pending': return { icon: Clock, bg: 'bg-yellow-600', title: 'PAYMENT PENDING', color: 'text-white' };
      case 'invalid': default: return { icon: XCircle, bg: 'bg-red-600', title: 'INVALID', color: 'text-white' };
    }
  };

  const resultConfig = getResultConfig();
  const ResultIcon = resultConfig.icon;

  // 🦅 TABLET/CORDOVA PAIRING
  const handlePairPrinter = async (device: BluetoothDevice) => {
    savePrinterProfile(device.address);
    const success = await connectPrinter(device.address, false);
    if (success) setShowPrinterSetup(false);
  };

  // 🦅 WEB BLE PAIRING (LAPTOP)
  const handleWebPrinterSetup = async () => {
    const success = await connectPrinter(undefined, false);
    if (success) {
      // Web BLE hides the true MAC address, so we save a generic flag to unlock the UI
      savePrinterProfile('WEB_BLE_PRINTER');
      setShowPrinterSetup(false);
    }
  };

  if (activeScreen === 'home') {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-white">
        
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-end">
          <Button variant="ghost" onClick={handleSignOut} className="text-slate-400 hover:text-white hover:bg-red-500/20 rounded-full font-medium transition-all">
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2rem] w-full max-w-md shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <QrCode className="w-12 h-12 text-emerald-400" />
          </div>
          
          <h1 className="text-3xl font-extrabold mb-1 tracking-tight text-white">Kiosk Terminal</h1>
          <p className="text-slate-400 text-sm mb-8">Ready to process orders</p>

          <div className="bg-slate-950/50 rounded-2xl p-5 w-full mb-6 space-y-4 border border-slate-800/50 text-left">
             <div className="flex items-center gap-3">
               <div className="bg-blue-500/20 p-2.5 rounded-xl"><User className="w-5 h-5 text-blue-400" /></div>
               <div>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Terminal Account</p>
                 <p className="font-semibold text-slate-200">{profileData ? profileData.full_name : <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}</p>
               </div>
             </div>
             
             <div className="flex items-center gap-3">
               <div className="bg-emerald-500/20 p-2.5 rounded-xl"><Store className="w-5 h-5 text-emerald-400" /></div>
               <div>
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Linked Canteen</p>
                 <p className="font-bold text-emerald-400">{profileData ? `${profileData.campus_name} (${profileData.campus_code})` : <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}</p>
               </div>
             </div>

             {/* 🦅 NEW: PRINTER STATUS CARD */}
             <div className="pt-4 mt-2 border-t border-slate-800/50">
               <div className="flex justify-between items-center mb-3">
                 <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Printer Status</p>
                 <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-500/10" onClick={() => setShowPrinterSetup(true)}>
                   <Settings2 className="w-3 h-3 mr-1" /> Configure
                 </Button>
               </div>

               {savedMacAddress ? (
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${isPrinterConnected ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                        <Printer className={`w-5 h-5 ${isPrinterConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
                      </div>
                      <div>
                        <p className={`font-bold text-sm ${isPrinterConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {isPrinterConnected ? 'Connected & Ready' : 'Connecting...'}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">80mm | {savedMacAddress.slice(-8)}</p>
                      </div>
                   </div>
                   {!isPrinterConnected && (
                     <Button size="icon" variant="ghost" onClick={() => connectPrinter(savedMacAddress)} disabled={isConnecting} className="text-amber-400 hover:bg-amber-500/10">
                       {isConnecting ? <Loader2 className="w-4 h-4 animate-spin"/> : <RefreshCw className="w-4 h-4"/>}
                     </Button>
                   )}
                 </div>
               ) : (
                 <div className="flex items-center gap-3">
                    <div className="bg-red-500/20 p-2.5 rounded-xl"><Printer className="w-5 h-5 text-red-400" /></div>
                    <div>
                      <p className="font-bold text-sm text-red-400">No Printer Assigned</p>
                      <p className="text-xs text-slate-400">Tap Configure to set up hardware</p>
                    </div>
                 </div>
               )}
             </div>
          </div>

          {/* 🦅 THE SECURITY LOCK: Cannot scan unless printer is physically connected! */}
          <Button 
            onClick={() => setActiveScreen('scanner')}
            disabled={!profileData || !isPrinterConnected}
            className={`w-full rounded-xl h-14 text-lg font-bold transition-all ${
              isPrinterConnected 
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_8px_30px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-95' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Camera className="w-5 h-5 mr-2" /> 
            {isPrinterConnected ? 'Start Scanning' : 'Printer Required'}
          </Button>
        </div>

        {/* 🦅 THE SETUP OVERLAY MODAL */}
        {showPrinterSetup && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-6">
              
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Printer className="w-5 h-5 text-emerald-400" /> Terminal Setup
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowPrinterSetup(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {savedMacAddress ? (
                <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4 flex flex-col gap-4">
                  <div>
                    <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider mb-1">Locked Printer Profile</p>
                    <p className="text-white font-mono text-sm break-all">{savedMacAddress}</p>
                    <p className="text-slate-400 text-sm mt-1">Paper Size: 80mm</p>
                    <p className="text-slate-400 text-sm">Status: {isPrinterConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={() => { disconnectPrinter(); clearPrinterProfile(); }} variant="destructive" className="flex-1 bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-800">
                      <Trash2 className="w-4 h-4 mr-2" /> Forget Device
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="space-y-3">
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">Available Printers</label>
                    
                    {/* 🦅 LAPTOP FIX: Distinguish between WebBLE and Tablet/Cordova scanning */}
                    <Button 
                      onClick={isWebMode ? handleWebPrinterSetup : scanForDevices} 
                      disabled={isScanningBluetooth || isConnecting}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white h-12"
                    >
                      {isScanningBluetooth || isConnecting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Search className="w-5 h-5 mr-2" />}
                      {isScanningBluetooth || isConnecting ? 'Connecting...' : (isWebMode ? 'Select & Connect Printer' : 'Scan Nearby Printers')}
                    </Button>
                  </div>

                  {/* Scanned Devices List (ONLY VISIBLE ON TABLET/CORDOVA) */}
                  {!isWebMode && (pairedDevices.length > 0 || unpairedDevices.length > 0) && (
                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {pairedDevices.map((device, i) => (
                        <div key={`paired-${i}`} className="flex items-center justify-between bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-white text-sm font-medium truncate">{device.name || 'Unknown Device'}</span>
                            <span className="text-slate-500 text-xs font-mono">{device.address}</span>
                          </div>
                          <Button size="sm" onClick={() => handlePairPrinter(device)} className="bg-slate-700 hover:bg-emerald-600 shrink-0 ml-2">
                            <Bluetooth className="w-3 h-3 mr-1" /> Pair
                          </Button>
                        </div>
                      ))}
                      {unpairedDevices.map((device, i) => (
                        <div key={`unpaired-${i}`} className="flex items-center justify-between bg-slate-800/80 p-3 rounded-xl border border-slate-700">
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-slate-300 text-sm font-medium truncate">{device.name || 'Unknown Device'}</span>
                            <span className="text-slate-500 text-xs font-mono">{device.address}</span>
                          </div>
                          <Button size="sm" onClick={() => handlePairPrinter(device)} className="bg-slate-700 hover:bg-emerald-600 shrink-0 ml-2">
                            <Bluetooth className="w-3 h-3 mr-1" /> Pair
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* ─── HEADER BAR ─── */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent transition-all">
        
        {isLocked ? (
          <div className="w-full flex justify-end">
            <Button variant="ghost" size="icon" onClick={handleUnlockAttempt} className="text-white/30 hover:text-white/60 bg-black/20 rounded-full mt-2">
              <Lock className="w-5 h-5" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <button
                onClick={() => isPrinterConnected ? disconnectPrinter() : connectPrinter(savedMacAddress || undefined)}
                disabled={isConnecting || !savedMacAddress}
                className={`flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-3 py-1.5 border active:scale-95 transition-transform ${
                  !savedMacAddress ? 'border-red-500/50 opacity-50' : 'border-white/20'
                }`}
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : isPrinterConnected ? (
                  <Bluetooth className="w-4 h-4 text-green-400" />
                ) : (
                  <BluetoothOff className="w-4 h-4 text-yellow-400" />
                )}
                <span className="text-white text-xs font-medium">
                  {!savedMacAddress ? 'No Printer' : isConnecting ? 'Connecting...' : isPrinterConnected ? 'Ready' : 'Disconnected'}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1 z-50 transition-opacity duration-300">
              <Button variant="ghost" size="icon" onClick={switchCamera} className="text-white hover:bg-white/10"><SwitchCamera className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setShowHistory(!showHistory)} className="text-white hover:bg-white/10 relative">
                <History className="w-5 h-5" />
                {scannedHistory.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{scannedHistory.length}</span>
                )}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLockScreen} className="text-emerald-400 hover:bg-white/10"><Unlock className="w-5 h-5" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setSoundEnabled(!soundEnabled)} className="text-white hover:bg-white/10">
                {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => { stopCamera(); if (isFromAdmin) { navigate(-1); } else { setActiveScreen('home'); } }} className="text-white hover:bg-slate-700/50 bg-black/20 rounded-full ml-2 border border-white/10">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </>
        )}
      </div>

      {showManualInput && !isLocked && (
        <div className="absolute top-20 left-0 right-0 z-40 px-4 py-3 bg-black/80 backdrop-blur-lg border-b border-white/10 animate-fade-in">
          <div className="flex gap-2 max-w-md mx-auto">
            <Input placeholder="Enter order number (e.g. RCDC-0042)" value={manualOrderNumber} onChange={(e) => setManualOrderNumber(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()} className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-emerald-500" autoFocus />
            <Button onClick={handleManualLookup} disabled={isVerifying || !manualOrderNumber.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0">
              {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      )}

      {isSleeping && (
        <div className="absolute inset-0 z-40 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer animate-in fade-in duration-300" onClick={wakeUpScanner}>
          <div className="w-32 h-32 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)] animate-[pulse_3s_ease-in-out_infinite]">
            <Camera className="w-12 h-12 text-emerald-400 opacity-80" />
          </div>
          <h2 className="text-4xl font-black text-white mb-3 tracking-widest text-center">TAP TO WAKE</h2>
          <p className="text-emerald-400/80 font-medium uppercase tracking-widest text-sm text-center">Camera sleeping to save battery</p>
        </div>
      )}

      <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover ${!cameraActive || isSleeping ? 'opacity-0' : ''}`} muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {!showResult && cameraActive && !isSleeping && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-72 h-72 z-10">
            <div className="absolute top-0 left-0 w-10 h-10 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-10 h-10 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-lg" />
            <div className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-[scan_2s_ease-in-out_infinite]" style={{ top: '50%' }} />
            
            {showGlareWarning && !scanning && (
              <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-72 bg-amber-500/90 backdrop-blur-md text-white px-3 py-2 rounded-xl text-xs font-bold border border-amber-400 shadow-xl flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
                <SunMedium className="w-6 h-6 shrink-0" /><p>Lower the screen brightness for better scanning.</p>
              </div>
            )}
          </div>
          <div className="absolute bottom-24 z-10">
            <div className="bg-black/60 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-sm font-medium border border-white/10">
              {scanning ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</span> : <span className="flex items-center gap-2"><Camera className="w-4 h-4" /> Point at QR Code</span>}
            </div>
          </div>
        </div>
      )}

      {showResult && resultType && !isSleeping && (
        <div className="absolute bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-200">
          <div className={`${resultConfig.bg} px-5 py-4 flex items-center gap-3`}>
            <ResultIcon className="w-8 h-8 text-white shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">{resultConfig.title}</p>
              {lastOrderDetails && resultType === 'success' ? (
                <p className="text-white/80 text-xs truncate">#{lastOrderDetails.orderNumber} · ₹{lastOrderDetails.total.toFixed(0)} · {lastOrderDetails.customerName}</p>
              ) : <p className="text-white/80 text-xs truncate">{resultMessage}</p>}
            </div>
            {lastOrderDetails && resultType === 'success' && <span className="text-white/60 text-[10px] shrink-0">Auto-closing...</span>}
          </div>
        </div>
      )}

      {cameraError && !isSleeping && (
        <div className="absolute inset-0 z-50 bg-gray-950 flex flex-col items-center justify-center p-6">
          <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
          <h2 className="text-white text-lg font-semibold mb-2">Camera Error</h2>
          <p className="text-white/60 text-center mb-6 max-w-sm">{cameraError}</p>
          <div className="flex gap-3">
            <Button onClick={() => startCamera()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <RefreshCw className="w-4 h-4 mr-2" /> Retry Camera
            </Button>
          </div>
        </div>
      )}

      {showHistory && !isLocked && (
        <div className="absolute top-0 right-0 bottom-0 z-50 w-80 bg-gray-950/95 backdrop-blur-xl border-l border-white/10 flex flex-col animate-slide-in-right">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h3 className="text-white font-semibold flex items-center gap-2"><History className="w-4 h-4" /> Scan History</h3>
            <Button variant="ghost" size="icon" onClick={() => setShowHistory(false)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {scannedHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-white/40"><History className="w-8 h-8 mb-2 opacity-50" /><p className="text-sm">No scans yet</p></div>
            ) : (
              scannedHistory.map((order, i) => (
                <div key={`${order.id}-${i}`} className={`rounded-xl p-3 border ${order.status === 'success' ? 'bg-emerald-900/30 border-emerald-500/30' : 'bg-red-900/20 border-red-500/20'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-mono text-sm font-bold">#{order.orderNumber}</span>
                    {order.status === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                  </div>
                  <p className="text-white/50 text-xs">{order.customerName}</p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-white/70 text-xs">₹{order.total.toFixed(0)}</span>
                    <span className="text-white/40 text-[10px]">{order.scannedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}