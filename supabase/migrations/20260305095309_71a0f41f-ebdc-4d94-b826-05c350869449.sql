-- Fix 1: Replace cleanup_stuck_pending_orders to use 'failed' instead of 'cancelled'
CREATE OR REPLACE FUNCTION public.cleanup_stuck_pending_orders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE orders
  SET 
    status = 'failed',
    payment_status = 'expired',
    rejection_reason = 'Payment timeout - auto cleanup',
    updated_at = now()
  WHERE 
    status = 'pending'
    AND payment_status = 'pending'
    AND created_at < now() - INTERVAL '30 minutes';
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- Fix 2: Drop permissive RLS policy on payment_webhooks and replace with restrictive service-role-only
DROP POLICY IF EXISTS "Service role can manage payment webhooks" ON public.payment_webhooks;

CREATE POLICY "Deny all access to payment_webhooks"
ON public.payment_webhooks
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);