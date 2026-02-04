import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useOrdersContext } from '@/context/OrdersContext';
import { useAuth } from '@/context/AuthContext';
import { usePrinter } from '@/context/PrinterContext';
import { LogOut, CheckCircle, XCircle, AlertCircle, RefreshCw, Bluetooth, Volume2, VolumeX, Loader2, Printer } from 'lucide-react';
import jsQR from 'jsqr';

// Audio feedback
const playSuccessSound = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
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

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface OrderDetails {
  id: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
  qrUsed: boolean;
  createdAt: string;
  items: OrderItem[];
}

export default function KioskScanner() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { markOrderCollected, verifyQrCode } = useOrdersContext();
  const { logout } = useAuth();
  const { isPrinterConnected, isConnecting, isPrinting, connectPrinter, printTicket } = usePrinter();
  
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  
  // Results State
  const [showResult, setShowResult] = useState(false);
  const [resultType, setResultType] = useState<'success' | 'invalid' | 'expired' | 'used' | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [printingOrder, setPrintingOrder] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const scannedOrdersRef = useRef<Set<string>>(new Set());
  const resultTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const restartCameraRef = useRef<() => void>(() => {});

  const isOrderExpired = (createdAt: string) => {
    const orderDate = new Date(createdAt);
    const now = new Date();
    return (now.getTime() - orderDate.getTime()) > (5 * 60 * 60 * 1000); // 5 hours
  };

  const stopCamera = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setCameraActive(false);
  }, []);

  const handleScan = useCallback(async (qrData: string) => {
    if (scanning) return;
    setScanning(true);

    try {
      const cleanedTerm = qrData.replace('ORDER-', '').trim();

      // 1. Check Local Session Duplicate
      if (scannedOrdersRef.current.has(cleanedTerm)) {
        setResultType('used');
        setShowResult(true);
        if (soundEnabled) playErrorSound();
        return;
      }

      // 2. Verify with Database
      const foundOrder = await verifyQrCode(cleanedTerm);

      if (!foundOrder) {
        setResultType('invalid');
        setShowResult(true);
        if (soundEnabled) playErrorSound();
        
        toast({
          title: "Order Not Found",
          description: `Code: ${cleanedTerm}`,
          variant: "destructive"
        });
        return;
      }

      // 3. Prepare Order Object
      const order: OrderDetails = {
        id: foundOrder.id,
        orderNumber: foundOrder.qrCode,
        totalAmount: foundOrder.total,
        status: foundOrder.status,
        qrUsed: foundOrder.isUsed,
        createdAt: foundOrder.createdAt.toISOString(),
        items: foundOrder.items.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
      };

      setOrderDetails(order);

      // 4. Validate Logic
      if (isOrderExpired(order.createdAt)) {
        setResultType('expired');
        scannedOrdersRef.current.add(cleanedTerm);
        setShowResult(true);
        if (soundEnabled) playErrorSound();
        return;
      }

      if (order.qrUsed) {
        setResultType('used');
        scannedOrdersRef.current.add(cleanedTerm);
        setShowResult(true);
        if (soundEnabled) playErrorSound();
        return;
      }

      // 5. SUCCESS!
      stopCamera();
      markOrderCollected(foundOrder.id);
      scannedOrdersRef.current.add(cleanedTerm);
      scannedOrdersRef.current.add(foundOrder.id);
      
      setResultType('success');
      setShowResult(true);
      if (soundEnabled) playSuccessSound();

      // Auto Print Logic
      if (isPrinterConnected) {
        setPrintingOrder(true);
        toast({ title: '✓ Verified', description: 'Printing ticket...' });
        
        const printData = {
          orderNumber: order.orderNumber,
          items: order.items,
          totalAmount: order.totalAmount,
          customerName: 'Customer',
          createdAt: order.createdAt,
        };
        
        printTicket(printData).then(() => {
          setPrintingOrder(false);
          // Auto restart after print
          setTimeout(() => restartCameraRef.current(), 1500);
        });
      }

    } catch (err) {
      console.error('Scan Error:', err);
      setCameraError('Scanner crashed. Please restart.');
    } finally {
      // Always allow new scans after processing, unless we stopped camera for success
      if (resultType !== 'success') {
        setScanning(false);
      }
    }
  }, [scanning, verifyQrCode, markOrderCollected, soundEnabled, isPrinterConnected, printTicket, toast, stopCamera, resultType]);

  const handleQRDetected = useCallback((qrData: string) => {
    if (!scanning && !showResult) {
      handleScan(qrData);
    }
  }, [scanning, showResult, handleScan]);

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

      if (code && code.data) {
        handleQRDetected(code.data);
      }
      animationRef.current = requestAnimationFrame(scan);
    };
    animationRef.current = requestAnimationFrame(scan);
  }, [handleQRDetected]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    setShowResult(false);
    setResultType(null);
    setScanning(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      setCameraActive(true);

      setTimeout(async () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          scanQRFromCamera();
        }
      }, 100);
    } catch (err) {
      setCameraError('Camera permission denied.');
    }
  }, [stopCamera, scanQRFromCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const resetAndRestartCamera = useCallback(() => {
    setShowResult(false);
    setResultType(null);
    setScanning(false);
    setPrintingOrder(false);
    startCamera();
  }, [startCamera]);

  useEffect(() => {
    restartCameraRef.current = resetAndRestartCamera;
  }, [resetAndRestartCamera]);

  // Auto-Dismiss Invalid/Expired Overlays
  useEffect(() => {
    if (showResult && resultType !== 'success') {
      const timer = setTimeout(() => {
        setShowResult(false);
        setScanning(false); // Re-enable scanning
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [showResult, resultType]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col overflow-hidden">
      {/* 1. HEADER */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
           <div className={`w-3 h-3 rounded-full ${isPrinterConnected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
           <span className="text-white font-bold text-sm">{isPrinterConnected ? 'PRINTER READY' : 'NO PRINTER'}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSoundEnabled(!soundEnabled)} className="text-white">
            {soundEnabled ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => { stopCamera(); logout(); navigate('/auth'); }} className="text-white">
            <LogOut />
          </Button>
        </div>
      </div>

      {/* 2. CAMERA VIDEO LAYER (Always render if active) */}
      {cameraActive && (
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
      )}
      <canvas ref={canvasRef} className="hidden" />

      {/* 3. SCANNING RETICLE (Only show when searching) */}
      {!showResult && cameraActive && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="relative w-72 h-72 border-2 border-white/30 rounded-lg">
             <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 -mt-1 -ml-1" />
             <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 -mt-1 -mr-1" />
             <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 -mb-1 -ml-1" />
             <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 -mb-1 -mr-1" />
             {scanning && <div className="absolute inset-x-4 h-0.5 bg-green-500/80 top-1/2 animate-pulse" />}
          </div>
          <div className="absolute bottom-20 bg-black/50 text-white px-4 py-2 rounded-full">
            {scanning ? "Processing..." : "Point at QR Code"}
          </div>
        </div>
      )}

      {/* 4. ERROR OVERLAYS (Invalid/Expired/Used) - Z-INDEX 40 */}
      {showResult && resultType !== 'success' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
           <div className={`p-8 rounded-3xl flex flex-col items-center shadow-2xl ${
             resultType === 'expired' ? 'bg-orange-600' : 'bg-red-600'
           }`}>
              <XCircle className="w-16 h-16 text-white mb-4" />
              <h2 className="text-2xl font-bold text-white uppercase">{resultType?.replace('-', ' ')}</h2>
              <p className="text-white/80 mt-2">
                {resultType === 'invalid' && "Order not found in database"}
                {resultType === 'used' && "Order already claimed"}
                {resultType === 'expired' && "Order is too old"}
              </p>
           </div>
        </div>
      )}

      {/* 5. SUCCESS SCREEN - Z-INDEX 50 */}
      {showResult && resultType === 'success' && (
        <div className="absolute inset-0 z-50 bg-green-600 flex flex-col items-center justify-center p-6 animate-in slide-in-from-bottom-10">
           <CheckCircle className="w-24 h-24 text-white mb-6 animate-bounce" />
           <h1 className="text-4xl font-bold text-white">VERIFIED!</h1>
           {orderDetails && (
             <div className="mt-6 text-center text-white">
                <p className="text-2xl font-mono mb-2">#{orderDetails.orderNumber}</p>
                <div className="bg-white/20 p-4 rounded-xl backdrop-blur-md">
                   {orderDetails.items.map((item, i) => (
                     <p key={i} className="text-lg">{item.name} x{item.quantity}</p>
                   ))}
                </div>
             </div>
           )}
           <Button onClick={resetAndRestartCamera} size="lg" className="mt-8 bg-white text-green-700 hover:bg-white/90">
             Scan Next Order
           </Button>
        </div>
      )}

      {/* 6. CAMERA ERROR */}
      {cameraError && (
        <div className="absolute inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center">
           <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
           <p className="text-white mb-6">{cameraError}</p>
           <Button onClick={startCamera} variant="outline" className="text-white border-white">Retry</Button>
        </div>
      )}
    </div>
  );
}