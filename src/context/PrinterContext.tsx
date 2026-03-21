import React, { createContext, useContext, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCampus } from '@/context/CampusContext';
import { PrinterSettings } from '@/types/campus';

// Tell TypeScript about the native plugin we just installed
declare const window: any;

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
  printerSettings: PrinterSettings | null;
  connectPrinter: () => Promise<boolean>;
  disconnectPrinter: () => void;
  printTicket: (orderData: OrderData) => Promise<boolean>;
}

const PrinterContext = createContext<PrinterContextType | null>(null);

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;

// 🌟 THE FIX: Set the exact name from your Android Settings screenshot
const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  paper_width: '58mm',
  bluetooth_name_prefix: 'BlueTooth Printer', 
  print_logo: false,
  footer_text: 'Thank you for your order!',
};

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const [isPrinterConnected, setIsPrinterConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();
  const { settings: campusSettings } = useCampus();

  const printerSettings = campusSettings?.printer || DEFAULT_PRINTER_SETTINGS;
  const textEncoder = new TextEncoder();

  // 1. EXACT SAME ESC/POS FORMATTER
  const createESCPOSCommands = useCallback((orderData: OrderData): Uint8Array => {
    const commands: number[] = [];
    const is80mm = printerSettings.paper_width === '80mm';
    const lineWidth = is80mm ? 48 : 32;
    const separator = '-'.repeat(lineWidth);
    
    commands.push(ESC, 0x40); // Initialize
    commands.push(ESC, 0x61, 0x01); // Center
    commands.push(ESC, 0x45, 0x01); // Bold ON
    commands.push(GS, 0x21, 0x11); // Double size
    
    commands.push(...textEncoder.encode(`TOKEN #${orderData.orderNumber}\n`));
    
    commands.push(GS, 0x21, 0x00); // Normal size
    commands.push(ESC, 0x45, 0x00); // Bold OFF
    commands.push(...textEncoder.encode(`${separator}\n`));
    commands.push(ESC, 0x61, 0x00); // Left
    commands.push(...textEncoder.encode(`Customer: ${orderData.customerName}\n\n`));
    
    commands.push(ESC, 0x45, 0x01); // Bold ON
    commands.push(...textEncoder.encode('ITEMS:\n'));
    commands.push(ESC, 0x45, 0x00); // Bold OFF
    
    orderData.items.forEach(item => {
      commands.push(...textEncoder.encode(`${item.quantity}x ${item.name}\n`));
      commands.push(...textEncoder.encode(`   Rs.${item.price * item.quantity}\n`));
    });
    
    commands.push(...textEncoder.encode(`${separator}\n`));
    commands.push(ESC, 0x45, 0x01); // Bold ON
    commands.push(GS, 0x21, 0x01); // Slightly larger
    commands.push(...textEncoder.encode(`TOTAL: Rs.${orderData.totalAmount}\n`));
    commands.push(GS, 0x21, 0x00); // Normal size
    commands.push(ESC, 0x45, 0x00); // Bold OFF
    
    commands.push(ESC, 0x61, 0x01); // Center
    const dateStr = new Date(orderData.createdAt).toLocaleDateString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    commands.push(...textEncoder.encode(`\n${dateStr}\n`));
    commands.push(...textEncoder.encode(`\n${printerSettings.footer_text}\n\n`));
    
    commands.push(ESC, 0x64, 0x04); // Feed 4 lines
    commands.push(GS, 0x56, 0x00); // Full cut
    
    return new Uint8Array(commands);
  }, [printerSettings]);

  // 2. NEW NATIVE BLUETOOTH CONNECTION LOGIC
  const connectPrinter = useCallback(async (): Promise<boolean> => {
    if (!window.bluetoothSerial) {
      toast({
        title: 'Native Plugin Missing',
        description: 'You must run this on an actual Android device.',
        variant: 'destructive',
      });
      return false;
    }

    setIsConnecting(true);

    return new Promise((resolve) => {
      window.bluetoothSerial.list((devices: any[]) => {
        
        // 🌟 THE FIX: Bulletproof Search Logic!
        const prefix = printerSettings.bluetooth_name_prefix || 'BlueTooth Printer';
        
        const targetPrinter = devices.find((d: any) => {
          if (!d.name) return false;
          const upperName = d.name.toUpperCase();
          // Checks for your exact setting, OR common thermal printer names
          return upperName.includes(prefix.toUpperCase()) || 
                 upperName.includes('BLUETOOTH PRINTER') || 
                 upperName.includes('HOIN') || 
                 upperName.includes('MTP');
        });

        if (!targetPrinter) {
          setIsConnecting(false);
          toast({
            title: 'Printer Not Found',
            description: `Could not find a paired printer. Please pair it in Android Bluetooth Settings first!`,
            variant: 'destructive',
          });
          resolve(false);
          return;
        }

        // Connect to the MAC Address
        window.bluetoothSerial.connect(targetPrinter.address, 
          () => {
            setIsPrinterConnected(true);
            setIsConnecting(false);
            toast({
              title: 'Printer Connected!',
              description: `Successfully bridged to ${targetPrinter.name}`,
            });
            resolve(true);
          },
          (error: any) => {
            setIsPrinterConnected(false);
            setIsConnecting(false);
            console.error("Native BT Connect Error:", error);
            toast({
              title: 'Connection Failed',
              description: 'Could not connect. Is the printer turned on?',
              variant: 'destructive',
            });
            resolve(false);
          }
        );
      }, (err: any) => {
        setIsConnecting(false);
        toast({ title: 'Bluetooth Error', description: 'Could not list Bluetooth devices. Make sure Nearby Devices permission is allowed.', variant: 'destructive' });
        resolve(false);
      });
    });
  }, [printerSettings, toast]);

  // 3. NATIVE DISCONNECT LOGIC
  const disconnectPrinter = useCallback(() => {
    if (window.bluetoothSerial) {
      window.bluetoothSerial.disconnect(() => {
        setIsPrinterConnected(false);
        toast({ title: 'Printer Disconnected', description: 'Bluetooth connection closed.' });
      });
    }
  }, [toast]);

  // 4. NATIVE WRITE LOGIC
  const printTicket = useCallback(async (orderData: OrderData): Promise<boolean> => {
    if (!isPrinterConnected || !window.bluetoothSerial) {
      toast({ title: 'Not Connected', description: 'Please connect the printer first.', variant: 'destructive' });
      return false;
    }

    setIsPrinting(true);

    return new Promise((resolve) => {
      const printData = createESCPOSCommands(orderData);
      
      window.bluetoothSerial.write(printData, 
        () => {
          setIsPrinting(false);
          resolve(true);
        },
        (err: any) => {
          setIsPrinting(false);
          console.error("Print Error:", err);
          toast({ title: 'Print Failed', description: 'Failed to send data to printer.', variant: 'destructive' });
          resolve(false);
        }
      );
    });
  }, [isPrinterConnected, createESCPOSCommands, toast]);

  return (
    <PrinterContext.Provider
      value={{
        isPrinterConnected,
        isConnecting,
        isPrinting,
        printerSettings,
        connectPrinter,
        disconnectPrinter,
        printTicket,
      }}
    >
      {children}
    </PrinterContext.Provider>
  );
}

export function usePrinter() {
  const context = useContext(PrinterContext);
  if (!context) throw new Error('usePrinter must be used within a PrinterProvider');
  return context;
}