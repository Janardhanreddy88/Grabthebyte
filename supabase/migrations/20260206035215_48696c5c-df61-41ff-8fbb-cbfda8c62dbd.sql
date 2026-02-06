-- Step 1: Drop all blocking triggers and policies
DROP TRIGGER IF EXISTS check_stock_on_order_confirmed ON orders;
DROP POLICY IF EXISTS "Users can update own pending orders only" ON orders;

-- Step 2: Create new enum with only required values
CREATE TYPE order_status_new AS ENUM ('pending', 'confirmed', 'collected', 'expired', 'failed');

-- Step 3: Update the orders table to use new enum
ALTER TABLE orders 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE order_status_new USING (
    CASE status::text
      WHEN 'cancelled' THEN 'failed'::order_status_new
      WHEN 'preparing' THEN 'confirmed'::order_status_new
      WHEN 'ready' THEN 'confirmed'::order_status_new
      ELSE status::text::order_status_new
    END
  ),
  ALTER COLUMN status SET DEFAULT 'pending'::order_status_new;

-- Step 4: Drop old enum and rename new one
DROP TYPE order_status;
ALTER TYPE order_status_new RENAME TO order_status;

-- Step 5: Recreate the RLS policy with new enum
CREATE POLICY "Users can update own pending orders only" 
ON orders FOR UPDATE 
USING ((user_id = auth.uid()) AND (status = 'pending'::order_status))
WITH CHECK ((user_id = auth.uid()) AND (status = 'pending'::order_status));