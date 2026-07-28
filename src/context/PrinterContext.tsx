import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

// 🦅 STRICT TYPESCRIPT: No more `declare const window: any;`
export interface BluetoothDevice {
  name: string;
  address: string;
  id?: string;
  class?: number;
}

interface BluetoothSerialPlugin {
  isEnabled: (success: () => void, failure: () => void) => void;
  enable: (success: () => void, failure: () => void) => void;
  showBluetoothSettings: () => void;
  list: (success: (devices: BluetoothDevice[]) => void, failure: () => void) => void;
  discoverUnpaired: (success: (devices: BluetoothDevice[]) => void, failure: () => void) => void;
  connect: (macAddress: string, success: () => void, failure: () => void) => void;
  disconnect: (success: () => void, failure: () => void) => void;
  isConnected: (success: () => void, failure: () => void) => void;
  write: (data: ArrayBuffer | Uint8Array, success: () => void, failure: (err: unknown) => void) => void;
}

declare global {
  interface Window {
    bluetoothSerial?: BluetoothSerialPlugin;
  }
}

interface OrderData {
  orderNumber: string;
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number; 
  customerName: string;
  createdAt: string;
  promoCode?: string | null;
  discountAmount?: number;
  platformFee?: number;
}

interface PrinterContextType {
  isPrinterConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  isBluetoothEnabled: boolean;
  isScanningBluetooth: boolean;
  pairedDevices: BluetoothDevice[];
  unpairedDevices: BluetoothDevice[];
  isWebMode: boolean;
  
  // 🦅 Local Storage Profile State
  savedMacAddress: string | null;
  
  checkBluetoothStatus: () => void;
  enableBluetooth: () => void;
  openBluetoothSettings: () => void;
  scanForDevices: () => void;
  connectPrinter: (macAddress?: string, silent?: boolean) => Promise<boolean>;
  disconnectPrinter: () => void;
  printTicket: (orderData: OrderData) => Promise<boolean>;
  
  // 🦅 The Profile Save/Clear Engine (80mm Only)
  savePrinterProfile: (macAddress: string) => void;
  clearPrinterProfile: () => void;
}

const PrinterContext = createContext<PrinterContextType | null>(null);

const ESC = 0x1B;
const GS = 0x1D;

// Universal BLE Services for Web/Laptop
const ESCPOS_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb'
];

// 🛡️ ENTERPRISE FIX: Strict ASCII Sanitization to prevent Emoji/Unicode printer crashes
const sanitizeText = (str: string) => {
  if (!str) return '';
  // Replaces anything outside standard printable English characters with a space
  return str.replace(/[^\x20-\x7E]/g, ' ').trim();
};

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState(false);
  const [isScanningBluetooth, setIsScanningBluetooth] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);
  const [unpairedDevices, setUnpairedDevices] = useState<BluetoothDevice[]>([]);
  const [isWebMode, setIsWebMode] = useState(false);

  const [savedMacAddress, setSavedMacAddress] = useState<string | null>(null);

  const webDeviceRef = useRef<any>(null);
  const webCharRef = useRef<any>(null);

  const intentionalDisconnectRef = useRef(false); 
  const isConnectingRef = useRef(isConnecting);
  const isConnectedRef = useRef(isPrinterConnected);
  
  // 🛡️ ENTERPRISE FIX: Concurrency Mutex Lock
  const isPrintingRef = useRef(false);

  useEffect(() => { isConnectingRef.current = isConnecting; }, [isConnecting]);
  useEffect(() => { isConnectedRef.current = isPrinterConnected; }, [isPrinterConnected]);

  const { toast } = useToast();
  const textEncoder = new TextEncoder();

  useEffect(() => {
    const storedMac = localStorage.getItem('kiosk_printer_mac');
    if (storedMac) setSavedMacAddress(storedMac);

    if (typeof window !== 'undefined' && !window.bluetoothSerial && navigator.bluetooth) {
      setIsWebMode(true);
      setIsBluetoothEnabled(true); 
    }
  }, []);

  const savePrinterProfile = useCallback((macAddress: string) => {
    localStorage.setItem('kiosk_printer_mac', macAddress);
    localStorage.removeItem('kiosk_printer_width'); 
    setSavedMacAddress(macAddress);
    toast({ title: 'Printer Profile Saved', description: 'Locked to 80mm Terminal' }); 
  }, [toast]);

  const clearPrinterProfile = useCallback(() => {
    localStorage.removeItem('kiosk_printer_mac');
    localStorage.removeItem('kiosk_printer_width');
    setSavedMacAddress(null);
    toast({ title: 'Profile Cleared', description: 'Terminal is no longer locked to a printer.' });
  }, [toast]);

  const createESCPOSCommands = useCallback((orderData: OrderData): Uint8Array => {
    const commands: number[] = [];
    
    // 🦅 HARDCODED 80MM MATH (48 Columns)
    const lineWidth = 48;
    const separator = '-'.repeat(lineWidth);
    const campusCode = sanitizeText(orderData.orderNumber.includes('-') ? orderData.orderNumber.split('-')[0].toUpperCase() : 'CAMPUS');

    const formatRow = (rawName: string, qty: string, price: string) => {
      const maxName = 30;
      const maxQty = 5;
      const maxPrice = 11;
      
      const name = sanitizeText(rawName); // Sanitize item name
      const n = name.length > maxName ? name.substring(0, maxName - 1) + "." : name.padEnd(maxName, ' ');
      const q = qty.padStart(maxQty, ' ');
      const p = price.padStart(maxPrice, ' ');
      return `${n} ${q} ${p}\n`; 
    };

    commands.push(ESC, 0x40); 
    commands.push(ESC, 0x61, 0x01); 
    
    // 🦅 HEADER: DOUBLE WIDTH + DOUBLE HEIGHT + BOLD
    commands.push(ESC, 0x45, 0x01); 
    commands.push(GS, 0x21, 0x11); 
    commands.push(...textEncoder.encode(`GrabTheByte\n`));
    commands.push(...textEncoder.encode(`${campusCode} CANTEEN\n`));
    
    commands.push(GS, 0x21, 0x00); 
    commands.push(ESC, 0x45, 0x00); 
    commands.push(...textEncoder.encode(`${separator}\n`));

    // 🦅 ORDER NUMBER: DOUBLE HEIGHT ONLY + BOLD
    commands.push(ESC, 0x61, 0x00); 
    commands.push(ESC, 0x45, 0x01); 
    commands.push(GS, 0x21, 0x10); 
    commands.push(...textEncoder.encode(`Order No: #${sanitizeText(orderData.orderNumber)}\n`));
    
    // 🦅 ADD DATE AND TIME FIX
    commands.push(GS, 0x21, 0x00); 
    commands.push(ESC, 0x45, 0x00); 
    
    const now = new Date();
    const dateString = now.toLocaleDateString('en-IN');
    const timeString = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    commands.push(...textEncoder.encode(`Date: ${dateString}  Time: ${timeString}\n`));
    
    commands.push(...textEncoder.encode(`${separator}\n`));

    // 🦅 ITEM HEADERS: BOLD
    commands.push(ESC, 0x45, 0x01); 
    commands.push(...textEncoder.encode(formatRow('ITEM', 'QTY', 'PRICE')));
    commands.push(ESC, 0x45, 0x00); 
    commands.push(...textEncoder.encode(`${separator}\n`));

    // 🦅 ITEMS LIST: BOLD WITH TOKEN OVERRIDE FIX
    commands.push(ESC, 0x45, 0x01); 
    orderData.items.forEach(item => {
      
      const isToken = item.name.toLowerCase().includes('token');
      
      let displayQty;
      let displayPrice;
      
      if (isToken) {
        // Force Token to print as QTY 1, and use the 'quantity' state as the Rupees amount
        displayQty = 1;
        displayPrice = item.quantity; 
      } else {
        // Standard food items print normally
        displayQty = item.quantity;
        displayPrice = item.price * item.quantity;
      }

      commands.push(...textEncoder.encode(formatRow(item.name, String(displayQty), String(displayPrice))));
    });
    commands.push(ESC, 0x45, 0x00); 
    commands.push(...textEncoder.encode(`${separator}\n`));

    // 🦅 SUBTOTALS/FEES: BOLD
    commands.push(ESC, 0x61, 0x02); 
    commands.push(ESC, 0x45, 0x01); 

    const subtotal = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (orderData.promoCode || orderData.platformFee) {
      commands.push(...textEncoder.encode(`Subtotal: Rs.${subtotal}\n`));
    }

    if (orderData.promoCode) {
      const fee = orderData.platformFee || 0;
      const discount = orderData.discountAmount !== undefined 
        ? orderData.discountAmount 
        : Math.max(0, (subtotal + fee) - orderData.totalAmount);
      
      commands.push(...textEncoder.encode(`Promo (${sanitizeText(orderData.promoCode)}): -Rs.${discount}\n`));
    }

    if (orderData.platformFee) {
      commands.push(...textEncoder.encode(`Platform Fee: +Rs.${orderData.platformFee}\n`));
    }

    const finalToPay = orderData.totalAmount;

    // 🦅 FINAL TOTAL: DOUBLE WIDTH + DOUBLE HEIGHT + BOLD
    commands.push(GS, 0x21, 0x11); 
    commands.push(...textEncoder.encode(`TOTAL: Rs.${finalToPay}\n`));
    
    commands.push(GS, 0x21, 0x00); 
    commands.push(ESC, 0x45, 0x00); 

    commands.push(ESC, 0x61, 0x01); 
    commands.push(...textEncoder.encode(`\n${separator}\n`));
    
    // 🦅 FOOTER: BOLD
    commands.push(ESC, 0x45, 0x01); 
    commands.push(...textEncoder.encode(`Thank you! Enjoy the meal.\n\n\n`)); 
    commands.push(ESC, 0x64, 0x03); 
    commands.push(GS, 0x56, 0x00); 
    
    return new Uint8Array(commands);
  }, []);

  const checkBluetoothStatus = useCallback(() => {
    if (!isWebMode && window.bluetoothSerial) {
      window.bluetoothSerial.isEnabled(
        () => setIsBluetoothEnabled(true), 
        () => setIsBluetoothEnabled(false)
      );
    }
  }, [isWebMode]);

  const enableBluetooth = useCallback(() => {
    if (!isWebMode && window.bluetoothSerial) {
      window.bluetoothSerial.enable(
        () => { setIsBluetoothEnabled(true); toast({ title: 'Bluetooth Enabled' }); scanForDevices(); },
        () => toast({ title: 'Cancelled', variant: 'destructive' })
      );
    }
  }, [isWebMode, toast]);

  const openBluetoothSettings = useCallback(() => {
    if (!isWebMode && window.bluetoothSerial) window.bluetoothSerial.showBluetoothSettings();
  }, [isWebMode]);

  const scanForDevices = useCallback(() => {
    if (isWebMode) { connectPrinter(); return; }
    if (!window.bluetoothSerial) return;
    setIsScanningBluetooth(true);
    setPairedDevices([]); setUnpairedDevices([]);

    window.bluetoothSerial.isEnabled(() => {
      setIsBluetoothEnabled(true);
      window.bluetoothSerial!.list((paired: BluetoothDevice[]) => {
        setPairedDevices(paired);
        window.bluetoothSerial!.discoverUnpaired((unpaired: BluetoothDevice[]) => {
          setUnpairedDevices(unpaired);
          setIsScanningBluetooth(false);
        }, () => setIsScanningBluetooth(false));
      }, () => setIsScanningBluetooth(false));
    }, () => { setIsScanningBluetooth(false); setIsBluetoothEnabled(false); });
  }, [isWebMode]);

  const connectPrinter = useCallback(async (targetMacAddress?: string, silent: boolean = false): Promise<boolean> => {
    intentionalDisconnectRef.current = false; 
    setIsConnecting(true);
    
    const macToDial = targetMacAddress || savedMacAddress;

    if (isWebMode) {
      try {
        console.log("🖥️ [WebBLE] Requesting Bluetooth Device...");
        let device = await (navigator as any).bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ESCPOS_SERVICES }); 

        if (!device?.gatt) throw new Error("GATT missing");
        
        console.log(`🖥️ [WebBLE] Selected Device: ${device.name} (${device.id})`);
        
        device.addEventListener('gattserverdisconnected', () => {
          console.log("🖥️ [WebBLE] Gatt Server Disconnected!");
          setIsPrinterConnected(false); webDeviceRef.current = null; webCharRef.current = null;
        });

        console.log("🖥️ [WebBLE] Connecting to GATT server...");
        const server = await device.gatt.connect();
        
        console.log("🖥️ [WebBLE] Connected! Fetching Primary Services...");
        let validChar = null;
        let fallbackChar = null;
        const services = await server.getPrimaryServices();
        console.log(`🖥️ [WebBLE] Found ${services.length} services.`);

        for (const service of services) {
          console.log(`🖥️ [WebBLE] Checking Service UUID: ${service.uuid}`);
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            console.log(`🖥️ [WebBLE]   -> Found Characteristic: ${char.uuid} | Write: ${char.properties.write} | WriteWoRes: ${char.properties.writeWithoutResponse}`);
            if (char.properties.write || char.properties.writeWithoutResponse) {
              if (char.uuid.includes('2af1') || char.uuid.includes('ff02') || char.uuid.includes('write')) {
                validChar = char;
                console.log(`🖥️ [WebBLE]   ✅ MATCHED ESC/POS PORT: ${validChar.uuid}`);
                break;
              }
              if (!fallbackChar) fallbackChar = char;
            }
          }
          if (validChar) break;
        }

        if (!validChar && fallbackChar) {
          console.log(`🖥️ [WebBLE]   ⚠️ No perfect match found. Using fallback port: ${fallbackChar.uuid}`);
          validChar = fallbackChar; 
        }

        if (!validChar) throw new Error("Could not find a writable printing port on this device.");

        webDeviceRef.current = device;
        webCharRef.current = validChar;
        setIsPrinterConnected(true);
        setIsConnecting(false);
        console.log("🖥️ [WebBLE] SETUP COMPLETE & READY TO PRINT.");
        if (!silent) toast({ title: 'Web Printer Connected!' });
        return true;
      } catch (err: unknown) {
        setIsConnecting(false);
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorName = err instanceof Error ? err.name : '';
        console.error(`🖥️ [WebBLE ERROR] Connection Failed: ${errorName} - ${errorMsg}`);
        if (!silent && errorName !== 'NotFoundError') toast({ title: 'Connection Error', description: errorMsg, variant: 'destructive' });
        return false;
      }
    } else {
      if (!window.bluetoothSerial) { setIsConnecting(false); return false; }

      return new Promise((resolve) => {
        const doConnect = (address: string) => {
          let resolved = false;

          const timeoutId = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              setIsConnecting(false);
              if (!silent) toast({ title: 'Connection Timeout', description: 'Make sure the printer is turned on.', variant: 'destructive' });
              resolve(false);
            }
          }, 10000); 

          const onSuccess = () => {
            if (!resolved) { resolved = true; clearTimeout(timeoutId); setIsPrinterConnected(true); setIsConnecting(false); if (!silent) toast({ title: 'Printer Connected!' }); resolve(true); }
          };
          const onError = () => {
            if (!resolved) { resolved = true; clearTimeout(timeoutId); setIsPrinterConnected(false); setIsConnecting(false); if (!silent) toast({ title: 'Connection Failed', variant: 'destructive' }); resolve(false); }
          };

          window.bluetoothSerial!.connect(address, onSuccess, onError);
        };

        if (macToDial) {
          doConnect(macToDial);
        } else {
          setIsConnecting(false);
          if (!silent) toast({ title: 'No Printer Configured', description: 'Please pair a printer in settings first.', variant: 'default' });
          resolve(false);
        }
      });
    }
  }, [isWebMode, savedMacAddress, toast]);

  const disconnectPrinter = useCallback(() => {
    intentionalDisconnectRef.current = true; 
    setIsPrinterConnected(false); 
    
    if (isWebMode && webDeviceRef.current?.gatt?.connected) {
      console.log("🖥️ [WebBLE] Intentional disconnect triggered.");
      webDeviceRef.current.gatt.disconnect();
      toast({ title: 'Disconnected' });
    } else if (!isWebMode && window.bluetoothSerial) {
      window.bluetoothSerial.disconnect(
        () => toast({ title: 'Disconnected' }),
        () => {} 
      );
    }
  }, [isWebMode, toast]);

  useEffect(() => {
    if (isWebMode || typeof window === 'undefined' || !window.bluetoothSerial) return;

    const watchdog = setInterval(() => {
      // 🛡️ ENTERPRISE FIX: Do not poll connection status while actively printing to prevent buffer jams
      if (isPrintingRef.current) return;

      window.bluetoothSerial!.isConnected(
        () => {
          if (!isConnectedRef.current) setIsPrinterConnected(true);
        },
        () => {
          if (isConnectedRef.current) setIsPrinterConnected(false);
          
          if (!intentionalDisconnectRef.current && !isConnectingRef.current && savedMacAddress) {
            connectPrinter(savedMacAddress, true);
          }
        }
      );
    }, 5000); 

    return () => clearInterval(watchdog);
  }, [isWebMode, connectPrinter, savedMacAddress]);

  const releasePrintLock = () => {
    isPrintingRef.current = false;
    setIsPrinting(false);
  };

  const printTicket = useCallback(async (orderData: OrderData): Promise<boolean> => {
    // 🛡️ ENTERPRISE FIX: Concurrency Lock (Mutex)
    // If a print job is already processing, ignore all other incoming print requests immediately.
    if (isPrintingRef.current) {
      console.warn("🖨️ [Mutex] Print job rejected. Printer is currently busy.");
      return false;
    }

    if (!isWebMode && window.bluetoothSerial) {
      return new Promise((resolve) => {
        window.bluetoothSerial!.isConnected(
          async () => {
            // Lock the printer
            isPrintingRef.current = true;
            setIsPrinting(true);
            
            try {
              const printData = createESCPOSCommands(orderData);
              const buffer = printData.buffer.slice(printData.byteOffset, printData.byteOffset + printData.byteLength) as ArrayBuffer;
              
              // 🦅 ENTERPRISE FIX: 8-Second Timeout Failsafe for Native Android Write
              const writeTimeout = setTimeout(() => {
                releasePrintLock();
                toast({ title: 'Printer Busy/Jammed', description: 'Ensure paper is loaded and try again.', variant: 'destructive' });
                resolve(false);
              }, 8000);

              window.bluetoothSerial!.write(buffer, 
                () => { 
                  clearTimeout(writeTimeout); 
                  releasePrintLock(); 
                  resolve(true); 
                },
                (err: unknown) => { 
                  clearTimeout(writeTimeout); 
                  releasePrintLock(); 
                  toast({ title: 'Print Failed', description: 'Bluetooth connection dropped.', variant: 'destructive' }); 
                  resolve(false); 
                }
              );
            } catch (err) {
              releasePrintLock();
              resolve(false);
            }
          },
          () => {
             setIsPrinterConnected(false);
             toast({ title: 'Printer Asleep', description: 'Waking printer up... try again in 3 seconds.', variant: 'destructive' });
             if (savedMacAddress) connectPrinter(savedMacAddress, true);
             resolve(false);
          }
        );
      });
    } else if (isWebMode) {
      // 🦅 WEB BLE LAPTOP PRINTING ENGINE - THE GOLDILOCKS ZONE
      if (!isPrinterConnected) {
        console.warn("🖥️ [WebBLE] Aborted Print: Printer state says disconnected.");
        return false;
      }
      
      // Lock the printer
      isPrintingRef.current = true;
      setIsPrinting(true);
      
      try {
        const printData = createESCPOSCommands(orderData);
        console.log(`🖨️ [WebBLE] Generated payload. Total size: ${printData.length} bytes`);
        
        if (webCharRef.current) {
          const CHUNK_SIZE = 100; 
          const useWriteWithResponse = webCharRef.current.properties.write;
          console.log(`🖨️ [WebBLE] Output Method: ${useWriteWithResponse ? 'write (with response)' : 'writeWithoutResponse'} | Chunk Size: ${CHUNK_SIZE}`);

          for (let i = 0; i < printData.length; i += CHUNK_SIZE) {
            const chunk = printData.slice(i, i + CHUNK_SIZE);
            console.log(`🖨️ [WebBLE] Writing chunk: bytes ${i} to ${i + chunk.length}...`);
            
            if (useWriteWithResponse) {
              await webCharRef.current.writeValue(chunk); 
            } else {
              await webCharRef.current.writeValueWithoutResponse(chunk);
              await new Promise(r => setTimeout(r, 20)); 
            }
          }
          console.log("🖨️ [WebBLE] 🟢 Print Job Completed Successfully!");
          releasePrintLock();
          return true;
        } else {
           console.error("🖨️ [WebBLE ERROR] webCharRef is null. Lost reference to the printer characteristic!");
           releasePrintLock();
           return false;
        }
      } catch (err) {
        console.error("🖨️ [WebBLE ERROR] Failed during write loop:", err);
        releasePrintLock();
        return false;
      }
    }
    return false;
  }, [isPrinterConnected, isWebMode, createESCPOSCommands, toast, savedMacAddress, connectPrinter]);

// 🛡️ THE URL GATEKEEPER BOOT SCRIPT (Browser-Testable Version)
  useEffect(() => {
    // 1. Check the route FIRST so we can see it in the Chrome Console!
    const isKioskRoute = window.location.href.toLowerCase().includes('kiosk');
    
    if (isKioskRoute) {
      console.log("🟢 GATEKEEPER: Kiosk route detected! Authorized for hardware check.");
    } else {
      console.log("🔴 GATEKEEPER: Not on Kiosk route. Skipping Bluetooth entirely.");
    }

    // 2. Now run the native Android hardware checks
    if (!isWebMode) {
      checkBluetoothStatus();
      
      if (window.bluetoothSerial && savedMacAddress) {
        if (isKioskRoute) {
          window.bluetoothSerial.isEnabled(
            () => {
              console.log("Hardware awake. Connecting to Kiosk Printer...");
              connectPrinter(savedMacAddress, true);
            }, 
            () => {
              console.warn("Kiosk Bluetooth is disabled. Bypassing connection to prevent crash.");
            }
          );
        }
      }
    }
  }, [isWebMode, connectPrinter, checkBluetoothStatus, savedMacAddress]);
  return (
    <PrinterContext.Provider value={{ 
      isPrinterConnected, isConnecting, isPrinting, isBluetoothEnabled, isScanningBluetooth, 
      pairedDevices, unpairedDevices, isWebMode, savedMacAddress,
      checkBluetoothStatus, enableBluetooth, openBluetoothSettings, scanForDevices, 
      connectPrinter, disconnectPrinter, printTicket, savePrinterProfile, clearPrinterProfile 
    }}>
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (!context) throw new Error('usePrinter must be used within a PrinterProvider');
  return context;
}