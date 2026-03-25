import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCampus } from '@/context/CampusContext';
import { PrinterSettings } from '@/types/campus';

declare const window: any;

export interface BluetoothDevice {
  name: string;
  address: string;
  id?: string;
  class?: number;
}

interface OrderData {
  orderNumber: string;
  items: { name: string; quantity: number; price: number }[];
  totalAmount: number;
  customerName: string;
  createdAt: string;
}

interface PrinterContextType {
  isPrinterConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  isBluetoothEnabled: boolean;
  isScanningBluetooth: boolean;
  pairedDevices: BluetoothDevice[];
  unpairedDevices: BluetoothDevice[];
  printerSettings: PrinterSettings | null;
  isWebMode: boolean; 
  checkBluetoothStatus: () => void;
  enableBluetooth: () => void;
  openBluetoothSettings: () => void;
  scanForDevices: () => void;
  connectPrinter: (macAddress?: string, silent?: boolean) => Promise<boolean>;
  disconnectPrinter: () => void;
  printTicket: (orderData: OrderData) => Promise<boolean>;
}

const PrinterContext = createContext<PrinterContextType | null>(null);

const ESC = 0x1B;
const GS = 0x1D;

const ESCPOS_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb'
];

const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  paper_width: '58mm',
  bluetooth_name_prefix: 'BlueTooth Printer', 
  print_logo: false,
  footer_text: 'Thank you! Enjoy the meal.', 
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

  const webDeviceRef = useRef<any>(null);
  const webCharRef = useRef<any>(null);

  // 🌟 THE MAC ADDRESS VAULT 🌟
  const lastMacAddressRef = useRef<string | null>(null); 
  const intentionalDisconnectRef = useRef(false); 
  const isConnectingRef = useRef(isConnecting);
  const isConnectedRef = useRef(isPrinterConnected);

  useEffect(() => { isConnectingRef.current = isConnecting; }, [isConnecting]);
  useEffect(() => { isConnectedRef.current = isPrinterConnected; }, [isPrinterConnected]);

  const { toast } = useToast();
  const { settings: campusSettings } = useCampus();

  const printerSettings = campusSettings?.printer || DEFAULT_PRINTER_SETTINGS;
  const textEncoder = new TextEncoder();

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.bluetoothSerial && navigator.bluetooth) {
      setIsWebMode(true);
      setIsBluetoothEnabled(true); 
    }
  }, []);

  const createESCPOSCommands = useCallback((orderData: OrderData): Uint8Array => {
    const commands: number[] = [];
    const is80mm = printerSettings.paper_width === '80mm';
    const lineWidth = is80mm ? 48 : 32;
    const separator = '-'.repeat(lineWidth);

    const campusCode = orderData.orderNumber.includes('-') ? orderData.orderNumber.split('-')[0].toUpperCase() : 'CAMPUS';

    const formatRow = (name: string, qty: string, price: string) => {
      const nameLen = is80mm ? 30 : 16;
      const qtyLen = 3;
      const priceLen = is80mm ? 12 : 9;
      const n = name.length > nameLen ? name.substring(0, nameLen - 1) + "." : name.padEnd(nameLen, ' ');
      const q = qty.padStart(qtyLen, ' ');
      const p = price.padStart(priceLen, ' ');
      return `${n} ${q}  ${p}\n`; 
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
    commands.push(ESC, 0x45, 0x01); 
    commands.push(GS, 0x21, 0x11); 
    commands.push(...textEncoder.encode(`TOTAL: Rs.${orderData.totalAmount}\n`));
    commands.push(GS, 0x21, 0x00); 
    commands.push(ESC, 0x45, 0x00); 

    commands.push(ESC, 0x61, 0x01); 
    commands.push(...textEncoder.encode(`\n${separator}\n`));
    commands.push(ESC, 0x45, 0x01); 
    
    commands.push(...textEncoder.encode(`${printerSettings.footer_text}\n\n`)); 
    commands.push(ESC, 0x64, 0x03); 
    commands.push(GS, 0x56, 0x00); 
    
    return new Uint8Array(commands);
  }, [printerSettings]);

  const checkBluetoothStatus = useCallback(() => {
    if (!isWebMode && window.bluetoothSerial) {
      window.bluetoothSerial.isEnabled(() => setIsBluetoothEnabled(true), () => setIsBluetoothEnabled(false));
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
      window.bluetoothSerial.list((paired: BluetoothDevice[]) => {
        setPairedDevices(paired);
        window.bluetoothSerial.discoverUnpaired((unpaired: BluetoothDevice[]) => {
          setUnpairedDevices(unpaired);
          setIsScanningBluetooth(false);
        }, () => setIsScanningBluetooth(false));
      }, () => setIsScanningBluetooth(false));
    }, () => { setIsScanningBluetooth(false); setIsBluetoothEnabled(false); });
  }, [isWebMode]);

  const connectPrinter = useCallback(async (macAddress?: string, silent: boolean = false): Promise<boolean> => {
    intentionalDisconnectRef.current = false; 
    setIsConnecting(true);

    if (isWebMode) {
      try {
        const prefix = printerSettings.bluetooth_name_prefix || 'BlueTooth Printer';
        let device;
        try { device = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: prefix }], optionalServices: ESCPOS_SERVICES }); } 
        catch { device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ESCPOS_SERVICES }); }

        if (!device?.gatt) throw new Error("GATT missing");
        
        device.addEventListener('gattserverdisconnected', () => {
          setIsPrinterConnected(false); webDeviceRef.current = null; webCharRef.current = null;
        });

        const server = await device.gatt.connect();
        let validChar = null;

        const services = await server.getPrimaryServices();
        for (const service of services) {
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) { validChar = char; break; }
          }
          if (validChar) break;
        }

        if (!validChar) throw new Error("Could not find a writable port on this printer.");

        webDeviceRef.current = device;
        webCharRef.current = validChar;
        setIsPrinterConnected(true);
        setIsConnecting(false);
        if (!silent) toast({ title: 'Web Printer Connected!' });
        return true;
      } catch (err: any) {
        setIsConnecting(false);
        if (!silent && err.name !== 'NotFoundError') toast({ title: 'Connection Error', description: err.message, variant: 'destructive' });
        return false;
      }
    } else {
      if (!window.bluetoothSerial) { setIsConnecting(false); return false; }

      return new Promise((resolve) => {
        const doConnect = (address: string) => {
          // 🌟 THE FIX: SAVE THE MAC FOR FUTURE BACKGROUND DIALING 🌟
          lastMacAddressRef.current = address;
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
            window.bluetoothSerial.connect(address, onSuccess, onError);
          };

          window.bluetoothSerial.disconnect(
            () => setTimeout(initiateConnection, 500), 
            () => setTimeout(initiateConnection, 500)
          );
        };

        if (macAddress) {
          doConnect(macAddress);
        } else {
          window.bluetoothSerial.list((devices: BluetoothDevice[]) => {
            const prefix = printerSettings.bluetooth_name_prefix || 'BlueTooth Printer';
            const targetPrinter = devices.find(d => d.name && (d.name.toUpperCase().includes(prefix.toUpperCase()) || d.name.toUpperCase().includes('HOIN') || d.name.toUpperCase().includes('MTP')));
            if (!targetPrinter) { setIsConnecting(false); resolve(false); return; }
            doConnect(targetPrinter.address);
          }, () => { setIsConnecting(false); resolve(false); });
        }
      });
    }
  }, [isWebMode, printerSettings, toast]);

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

  // 🌟 THE MAC-DIALING BACKGROUND WATCHDOG 🌟
  useEffect(() => {
    if (isWebMode || typeof window === 'undefined' || !window.bluetoothSerial) return;

    const watchdog = setInterval(() => {
      window.bluetoothSerial.isConnected(
        () => {
          if (!isConnectedRef.current) setIsPrinterConnected(true);
        },
        () => {
          if (isConnectedRef.current) setIsPrinterConnected(false);
          
          if (!intentionalDisconnectRef.current && !isConnectingRef.current) {
            // 🌟 IF PRINTER TURNED OFF, AGGRESSIVELY DIAL THE EXACT MAC ADDRESS UNTIL IT WAKES UP!
            if (lastMacAddressRef.current) {
              connectPrinter(lastMacAddressRef.current, true);
            } else {
              connectPrinter(undefined, true);
            }
          }
        }
      );
    }, 5000); 

    return () => clearInterval(watchdog);
  }, [isWebMode, connectPrinter]);

  const printTicket = useCallback(async (orderData: OrderData): Promise<boolean> => {
    if (!isPrinterConnected) return false;
    setIsPrinting(true);
    const printData = createESCPOSCommands(orderData);

    if (isWebMode && webCharRef.current) {
      try {
        const CHUNK_SIZE = 20; 
        for (let i = 0; i < printData.length; i += CHUNK_SIZE) {
          const chunk = printData.slice(i, i + CHUNK_SIZE);
          if (webCharRef.current.properties.writeWithoutResponse) {
            await webCharRef.current.writeValueWithoutResponse(chunk);
          } else {
            await webCharRef.current.writeValue(chunk);
          }
          await new Promise(r => setTimeout(r, 75)); 
        }
        setIsPrinting(false);
        return true;
      } catch (err: any) {
        setIsPrinting(false); 
        toast({ title: 'Print Failed', description: 'Communication with printer lost.', variant: 'destructive' }); 
        return false;
      }
    } else if (!isWebMode && window.bluetoothSerial) {
      return new Promise((resolve) => {
        window.bluetoothSerial.write(printData, 
          () => { setIsPrinting(false); resolve(true); },
          (err: any) => { setIsPrinting(false); toast({ title: 'Print Failed', variant: 'destructive' }); resolve(false); }
        );
      });
    }
    setIsPrinting(false);
    return false;
  }, [isPrinterConnected, isWebMode, createESCPOSCommands, toast]);

  useEffect(() => {
    if (!isWebMode) {
      checkBluetoothStatus();
      if (window.bluetoothSerial) window.bluetoothSerial.isEnabled(() => connectPrinter(undefined, true), () => {});
    }
  }, [isWebMode, connectPrinter, checkBluetoothStatus]);

  return (
    <PrinterContext.Provider value={{ isPrinterConnected, isConnecting, isPrinting, isBluetoothEnabled, isScanningBluetooth, pairedDevices, unpairedDevices, printerSettings, isWebMode, checkBluetoothStatus, enableBluetooth, openBluetoothSettings, scanForDevices, connectPrinter, disconnectPrinter, printTicket }}>
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (!context) throw new Error('usePrinter must be used within a PrinterProvider');
  return context;
}