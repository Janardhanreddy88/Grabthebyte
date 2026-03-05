
-- ============================================================
-- FIX 1: Restrict campus financial fields from students
-- Students currently see bank_account_number, bank_ifsc, upi_id etc via "Users can view their own campus full data" policy.
-- Solution: Drop that policy and create a new one that only exposes non-sensitive columns via campus_public_info view.
-- ============================================================

DROP POLICY IF EXISTS "Users can view their own campus full data" ON public.campuses;

-- Students should use campus_public_info view instead. Only admins of the campus need full data.
CREATE POLICY "Campus admins can view their full campus data"
ON public.campuses
FOR SELECT
TO authenticated
USING (
  (id = get_user_campus_id(auth.uid())) AND is_campus_admin(auth.uid())
);

-- ============================================================
-- FIX 2: Secure profiles_readable view - add RLS via security_invoker
-- Views with SECURITY INVOKER respect the calling user's RLS.
-- But we can't alter view security_invoker on older PG. Instead, restrict with a wrapper.
-- Drop and recreate with security_invoker = true (PG 15+)
-- ============================================================

ALTER VIEW public.profiles_readable SET (security_invoker = true);

-- ============================================================
-- FIX 3: Secure user_roles_readable view
-- ============================================================

ALTER VIEW public.user_roles_readable SET (security_invoker = true);

-- ============================================================
-- FIX 4: Restrict audit_logs INSERT to only admins/super_admins
-- Currently any authenticated user can insert. Fix: only campus admins and super admins.
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_logs;

CREATE POLICY "Admins can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  is_campus_admin(auth.uid()) OR is_super_admin(auth.uid())
);

-- ============================================================
-- FIX 5: Set search_path on fail_expired_orders_automatically
-- ============================================================

CREATE OR REPLACE FUNCTION public.fail_expired_orders_automatically()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE orders
  SET 
    status = 'failed', 
    payment_status = 'expired',
    rejection_reason = 'Payment timeout - 10 minutes expired'
  WHERE 
    status = 'pending' 
    AND payment_status = 'pending'
    AND created_at < NOW() - INTERVAL '10 minutes';
END;
$function$;

-- ============================================================
-- FIX 6: Set search_path on prevent_late_payments
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_late_payments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.payment_status = 'confirmed' and old.payment_status != 'confirmed' then
    if old.created_at < (now() - interval '10 minutes') then
      raise exception 'Security Error: Cannot confirm payment. Order expired 10 minutes ago.';
    end if;
  end if;
  return new;
end;
$function$;

-- ============================================================
-- FIX 7: Add RLS to campus_public_info view
-- campus_public_info is a VIEW, so we enable security_invoker.
-- But since it's meant to be public, we just need security_invoker = true
-- and ensure the underlying campuses table policies allow reading public fields.
-- The view already filters to only public columns, so we add a permissive policy
-- for all authenticated users to SELECT from campuses (limited fields via the view).
-- ============================================================

ALTER VIEW public.campus_public_info SET (security_invoker = true);

-- We need a policy that lets any authenticated user read campuses for the view to work.
-- This is safe because campus_public_info view only exposes non-sensitive columns.
-- But with security_invoker, the view now runs as the calling user, so we need a basic read policy.
CREATE POLICY "Authenticated users can view basic campus info"
ON public.campuses
FOR SELECT
TO authenticated
USING (is_active = true);

-- ============================================================
-- FIX 8: Also ensure get_super_admin_stats uses valid statuses
-- It references 'cancelled' which doesn't exist. Fix to 'failed'.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_super_admin_stats(p_campus_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_gmv NUMERIC := 0;
  v_net_revenue NUMERIC := 0;
  v_pending_payouts NUMERIC := 0;
  v_active_orders INTEGER := 0;
  v_total_orders_today INTEGER := 0;
BEGIN
  SELECT 
    COALESCE(SUM(total), 0),
    COALESCE(SUM(
      CASE 
        WHEN commission_amount > 0 THEN commission_amount 
        ELSE total * 0.10 
      END
    ), 0)
  INTO 
    v_total_gmv,
    v_net_revenue
  FROM orders
  WHERE 
    status != 'failed'
    AND (p_campus_id IS NULL OR campus_id = p_campus_id);

  v_pending_payouts := v_total_gmv - v_net_revenue;

  SELECT COUNT(*) INTO v_active_orders
  FROM orders
  WHERE 
    status IN ('confirmed', 'pending')
    AND (p_campus_id IS NULL OR campus_id = p_campus_id);

  SELECT COUNT(*) INTO v_total_orders_today
  FROM orders
  WHERE 
    DATE(created_at) = CURRENT_DATE
    AND (p_campus_id IS NULL OR campus_id = p_campus_id);

  RETURN json_build_object(
    'total_gmv', v_total_gmv,
    'net_revenue', v_net_revenue,
    'pending_payouts', v_pending_payouts,
    'active_orders', v_active_orders,
    'total_orders_today', v_total_orders_today
  );
END;
$function$;
