export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isVeg: boolean;
  isPopular?: boolean;
  isAvailable: boolean;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

// Simplified token system order status:
// - pending: Awaiting payment (10 min timeout)
// - confirmed: Payment verified, QR code active
// - collected: Scanned at counter, order complete
// - expired: Not collected within 5 hours
// - failed: Payment failed or 10-min timeout exceeded
export type OrderStatus = 'pending' | 'confirmed' | 'collected' | 'expired' | 'failed';

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  qrCode: string;
  createdAt: Date;
  isUsed: boolean;
  customerName?: string;
  customerEmail?: string;
}

export interface TimePeriod {
  id: string;
  name: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  icon: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface College {
  id: string;
  name: string;
  code: string;
}

// Updated role types - includes super_admin for platform-wide access
export type UserRole = 'student' | 'admin' | 'kiosk' | 'super_admin';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  collegeId?: string;
  role: UserRole;
  /** Campus this user belongs to (UUID from public.campuses.id) */
  campusId?: string;
  adminPin?: string; // Hashed PIN for admin access
}
