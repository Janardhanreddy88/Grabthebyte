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

// 🌟 UPDATED TOKEN SYSTEM ORDER STATUSES:
// - pending: Awaiting payment completion
// - confirmed: Payment verified, QR code active for student
// - collected: Scanned at counter, food handed over, order complete
// - expired: Not collected within the 5-hour time limit
// - failed: Payment failed, dropped out, or payment timeout exceeded
// - cancelled: Force-killed by Super Admin (Kill Switch)
// - rejected: Canteen refused the order (Out of stock, closing early, etc.)
// - refunded: Money has been successfully routed back to the student
export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'collected' 
  | 'expired' 
  | 'failed' 
  | 'cancelled' 
  | 'rejected' 
  | 'refunded';

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