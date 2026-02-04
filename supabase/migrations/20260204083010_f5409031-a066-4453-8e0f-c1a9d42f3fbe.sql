-- Drop the old function that references canteen_id
DROP FUNCTION IF EXISTS public.get_super_admin_stats(uuid, uuid);

-- Recreate with only campus_id parameter
CREATE OR REPLACE FUNCTION public.get_super_admin_stats(p_campus_id uuid DEFAULT NULL)
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
    status != 'cancelled'
    AND (p_campus_id IS NULL OR campus_id = p_campus_id);

  v_pending_payouts := v_total_gmv - v_net_revenue;

  SELECT COUNT(*) INTO v_active_orders
  FROM orders
  WHERE 
    status IN ('confirmed', 'preparing', 'ready', 'pending')
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