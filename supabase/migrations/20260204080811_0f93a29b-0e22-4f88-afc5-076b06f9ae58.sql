-- Drop payment-related tables
DROP TABLE IF EXISTS public.payment_webhooks CASCADE;
DROP TABLE IF EXISTS public.payment_audit_log CASCADE;

-- Remove payment-related columns from orders table
ALTER TABLE public.orders 
  DROP COLUMN IF EXISTS payment_status,
  DROP COLUMN IF EXISTS payment_method,
  DROP COLUMN IF EXISTS utr_number,
  DROP COLUMN IF EXISTS verification_status,
  DROP COLUMN IF EXISTS verified_by,
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS rejection_reason;

-- Drop payment-related functions
DROP FUNCTION IF EXISTS public.update_order_from_webhook(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.get_pending_verification_count();