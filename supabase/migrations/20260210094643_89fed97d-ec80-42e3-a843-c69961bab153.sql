CREATE OR REPLACE FUNCTION public.mark_order_collected_secure(p_secret_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_order_id uuid;
  v_status text;
  v_payment_status text;
begin
  select id, status, payment_status 
  into v_order_id, v_status, v_payment_status
  from orders 
  where collection_token = p_secret_token;

  if not found then
    return json_build_object('success', false, 'message', 'Invalid QR Code (Fake or Not Found).');
  end if;

  if v_status = 'expired' then
    return json_build_object('success', false, 'message', 'Error: Order Expired (5 hours passed).');
  end if;

  if v_status = 'collected' then
    return json_build_object('success', false, 'message', 'Error: Already Collected.');
  end if;

  -- Accept both 'confirmed' and 'completed' as valid payment statuses
  if v_payment_status NOT IN ('confirmed', 'completed') then
     return json_build_object('success', false, 'message', 'Error: Payment Not Confirmed.');
  end if;

  update orders set status = 'collected', is_used = true where id = v_order_id;
  
  return json_build_object('success', true, 'message', 'Verified! Deliver Food.');
end;
$$;