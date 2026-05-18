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
  write: (data: Uint8Array, success: () => void, failure: (err: unknown) => void) => void;
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

// Universal BLE Services for Web/Laptop (Including common Chinese printer UUIDs)
const ESCPOS_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb'
];

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState(false);
  const [isScanningBluetooth, setIsScanningBluetooth] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);
  const [unpairedDevices, setUnpairedDevices] = useState<BluetoothDevice[]>([]);
  const [isWebMode, setIsWebMode] = useState(false);

  // 🦅 Local Profile State
  const [savedMacAddress, setSavedMacAddress] = useState<string | null>(null);

  // Using unknown type assertion for Web Bluetooth API compatibility 
  const webDeviceRef = useRef<any>(null);
  const webCharRef = useRef<any>(null);

  const intentionalDisconnectRef = useRef(false); 
  const isConnectingRef = useRef(isConnecting);
  const isConnectedRef = useRef(isPrinterConnected);

  useEffect(() => { isConnectingRef.current = isConnecting; }, [isConnecting]);
  useEffect(() => { isConnectedRef.current = isPrinterConnected; }, [isPrinterConnected]);

  const { toast } = useToast();
  const textEncoder = new TextEncoder();

  // 🦅 Load Profile from Local Storage on Boot
  useEffect(() => {
    const storedMac = localStorage.getItem('kiosk_printer_mac');
    if (storedMac) setSavedMacAddress(storedMac);

    if (typeof window !== 'undefined' && !window.bluetoothSerial && navigator.bluetooth) {
      setIsWebMode(true);
      setIsBluetoothEnabled(true); 
    }
  }, []);

  // 🦅 Save & Clear Profile Functions
  const savePrinterProfile = useCallback((macAddress: string) => {
    localStorage.setItem('kiosk_printer_mac', macAddress);
    localStorage.removeItem('kiosk_printer_width'); // Clean up old 58mm data just in case
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

    const campusCode = orderData.orderNumber.includes('-') ? orderData.orderNumber.split('-')[0].toUpperCase() : 'CAMPUS';

    const formatRow = (name: string, qty: string, price: string) => {
      // 80mm Math: 30 chars for Name, 5 for Qty, 11 for Price (with 2 spaces between = 48)
      const maxName = 30;
      const maxQty = 5;
      const maxPrice = 11;

      const n = name.length > maxName ? name.substring(0, maxName - 1) + "." : name.padEnd(maxName, ' ');
      const q = qty.padStart(maxQty, ' ');
      const p = price.padStart(maxPrice, ' ');

      return `${n} ${q} ${p}\n`; 
    };

    commands.push(ESC, 0x40); 
    commands.push(ESC, 0x61, 0x01); 
    commands.push(ESC, 0x45, 0x01); 
    commands.push(GS, 0x21, 0x11); 
    commands.push(...textEncoder.encode(`GrabTheByte\n`));
    commands.push(GS, 0x21, 0x01); 
    commands.push(...textEncoder.encode(`${campusCode} CANTEEN\n`));
    commands.push(GS, 0x21, 0x00); 
    commands.push(ESC, 0x45, 0x00); 
    commands.push(...textEncoder.encode(`${separator}\n`));

    commands.push(ESC, 0x61, 0x00); 
    commands.push(ESC, 0x45, 0x01); 
    commands.push(...textEncoder.encode(`Order No: #${orderData.orderNumber}\n`));
    commands.push(ESC, 0x45, 0x00); 
    commands.push(...textEncoder.encode(`${separator}\n`));

    commands.push(ESC, 0x45, 0x01); 
    commands.push(...textEncoder.encode(formatRow('ITEM', 'QTY', 'PRICE')));
    commands.push(ESC, 0x45, 0x00); 
    commands.push(...textEncoder.encode(`${separator}\n`));

    orderData.items.forEach(item => {
      commands.push(...textEncoder.encode(formatRow(item.name, String(item.quantity), String(item.price * item.quantity))));
    });
    commands.push(...textEncoder.encode(`${separator}\n`));

    commands.push(ESC, 0x61, 0x02); 

    const subtotal = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (orderData.promoCode || orderData.platformFee) {
      commands.push(...textEncoder.encode(`Subtotal: Rs.${subtotal}\n`));
    }

    if (orderData.promoCode) {
      const fee = orderData.platformFee || 0;
      const discount = orderData.discountAmount !== undefined 
        ? orderData.discountAmount 
        : Math.max(0, (subtotal + fee) - orderData.totalAmount);
      
      commands.push(...textEncoder.encode(`Promo (${orderData.promoCode}): -Rs.${discount}\n`));
    }

    if (orderData.platformFee) {
      commands.push(...textEncoder.encode(`Platform Fee: +Rs.${orderData.platformFee}\n`));
    }

    const finalToPay = orderData.totalAmount;

    commands.push(ESC, 0x45, 0x01); 
    commands.push(GS, 0x21, 0x11); 
    commands.push(...textEncoder.encode(`TOTAL: Rs.${finalToPay}\n`));
    commands.push(GS, 0x21, 0x00); 
    commands.push(ESC, 0x45, 0x00);

    commands.push(ESC, 0x61, 0x01); 
    commands.push(...textEncoder.encode(`\n${separator}\n`));
    commands.push(ESC, 0x45, 0x01); 
    
    commands.push(...textEncoder.encode(`Thank you! Enjoy the meal.\n\n`)); 
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
        let device;
        device = await (navigator as any).bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ESCPOS_SERVICES }); 

        if (!device?.gatt) throw new Error("GATT missing");
        
        device.addEventListener('gattserverdisconnected', () => {
          setIsPrinterConnected(false); webDeviceRef.current = null; webCharRef.current = null;
        });

        const server = await device.gatt.connect();
        
        let validChar = null;
        let fallbackChar = null;
        const services = await server.getPrimaryServices();

        for (const service of services) {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              if (char.uuid.includes('2af1') || char.uuid.includes('ff02') || char.uuid.includes('write')) {
                validChar = char;
                break;
              }
              if (!fallbackChar) fallbackChar = char;
            }
          }
          if (validChar) break;
        }

        if (!validChar && fallbackChar) {
          validChar = fallbackChar; 
        }

        if (!validChar) throw new Error("Could not find a printing port on this device.");

        webDeviceRef.current = device;
        webCharRef.current = validChar;
        setIsPrinterConnected(true);
        setIsConnecting(false);
        if (!silent) toast({ title: 'Web Printer Connected!' });
        return true;
      } catch (err: unknown) {
        setIsConnecting(false);
        const errorMsg = err instanceof Error ? err.message : String(err);
        const errorName = err instanceof Error ? err.name : '';
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

          const initiateConnection = () => {
            window.bluetoothSerial!.connect(address, onSuccess, onError);
          };

          // 🦅 CORDOVA RAW CONNECTION (Kept exactly as you provided)
          window.bluetoothSerial!.disconnect(
            () => setTimeout(initiateConnection, 500), 
            () => setTimeout(initiateConnection, 500)
          );
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

  const printTicket = useCallback(async (orderData: OrderData): Promise<boolean> => {
    if (!isPrinterConnected) {
      toast({ title: 'Print Failed', description: 'Printer is not connected.', variant: 'destructive' });
      return false;
    }
    
    setIsPrinting(true);
    
    try {
      const printData = createESCPOSCommands(orderData);

      if (isWebMode && webCharRef.current) {
        const CHUNK_SIZE = 20; 
        const useWriteWithResponse = webCharRef.current.properties.write;

        for (let i = 0; i < printData.length; i += CHUNK_SIZE) {
          const chunk = printData.slice(i, i + CHUNK_SIZE);
          
          if (useWriteWithResponse) {
            await webCharRef.current.writeValue(chunk); 
          } else {
            await webCharRef.current.writeValueWithoutResponse(chunk);
            await new Promise(r => setTimeout(r, 40)); 
          }
        }
        setIsPrinting(false);
        return true;
      } else if (!isWebMode && window.bluetoothSerial) {
        return new Promise((resolve) => {
          window.bluetoothSerial!.write(printData, 
            () => { setIsPrinting(false); resolve(true); },
            (err: unknown) => { 
              setIsPrinting(false); 
              toast({ title: 'Bluetooth Print Failed', description: String(err), variant: 'destructive' }); 
              resolve(false); 
            }
          );
        });
      }
    } catch (err: unknown) {
      console.error("Print Command Error:", err);
      toast({ title: 'Data Format Error', description: 'Could not generate receipt data.', variant: 'destructive' });
    }

    setIsPrinting(false);
    return false;
  }, [isPrinterConnected, isWebMode, createESCPOSCommands, toast]);

  useEffect(() => {
    if (!isWebMode) {
      checkBluetoothStatus();
      if (window.bluetoothSerial && savedMacAddress) {
        window.bluetoothSerial.isEnabled(() => connectPrinter(savedMacAddress, true), () => {});
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