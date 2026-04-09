
CREATE OR REPLACE FUNCTION public.get_super_admin_stats(p_campus_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_gmv NUMERIC := 0;
  v_active_orders INTEGER := 0;
  v_total_orders_today INTEGER := 0;
BEGIN
  -- GMV: ONLY confirmed + collected orders
  SELECT COALESCE(SUM(total), 0)
  INTO v_total_gmv
  FROM orders
  WHERE status IN ('confirmed', 'collected')
    AND (p_campus_id IS NULL OR campus_id = p_campus_id);

  -- Active orders: pending + confirmed
  SELECT COUNT(*) INTO v_active_orders
  FROM orders
  WHERE status IN ('confirmed', 'pending')
    AND (p_campus_id IS NULL OR campus_id = p_campus_id);

  -- Today's confirmed/collected orders
  SELECT COUNT(*) INTO v_total_orders_today
  FROM orders
  WHERE DATE(created_at) = CURRENT_DATE
    AND status IN ('confirmed', 'collected')
    AND (p_campus_id IS NULL OR campus_id = p_campus_id);

  RETURN json_build_object(
    'total_gmv', v_total_gmv,
    'active_orders', v_active_orders,
    'total_orders_today', v_total_orders_today
  );
END;
$function$;
