-- 1. THE SAFETY NET: Prevent stock from ever going below zero
ALTER TABLE menu_items 
ADD CONSTRAINT stock_not_negative CHECK (stock_quantity >= 0);

-- 2. THE SPEED BOOSTER: Add indexes so "My Orders" loads instantly
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_campus_id ON orders(campus_id);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON orders(razorpay_order_id);

-- 3. THE EXPIRY GUARD: Attach the missing trigger to the orders table
DROP TRIGGER IF EXISTS enforce_late_payments ON orders;
CREATE TRIGGER enforce_late_payments
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION prevent_late_payments();