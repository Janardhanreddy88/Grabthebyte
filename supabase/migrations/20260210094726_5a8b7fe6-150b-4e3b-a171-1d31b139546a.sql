-- Fix mark_order_collected to also accept 'completed' payment status
CREATE OR REPLACE FUNCTION public.mark_order_collected(p_order_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_status text;
  v_payment_status text;
begin
  select status, payment_status 
  into v_status, v_payment_status
  from orders 
  where id = p_order_id;

  if not found then
    return json_build_object('success', false, 'message', 'Order not found');
  end if;

  if v_status = 'expired' then
    return json_build_object('success', false, 'message', 'Error: Order has expired (5 hours passed).');
  end if;

  if v_status = 'collected' then
    return json_build_object('success', false, 'message', 'Error: Already collected.');
  end if;

  if v_payment_status NOT IN ('confirmed', 'completed') then
     return json_build_object('success', false, 'message', 'Error: Payment was not confirmed.');
  end if;

  update orders set status = 'collected', is_used = true where id = p_order_id;
  return json_build_object('success', true, 'message', 'Order collected successfully!');
end;
$$;

-- Fix expire_old_orders to also handle 'completed' payment status
CREATE OR REPLACE FUNCTION public.expire_old_orders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  -- 1. PAYMENT TIMEOUT (10 Minutes) -> FAILED
  update orders
  set 
    status = 'failed',
    payment_status = 'not_confirmed',
    rejection_reason = 'Payment timeout - 10 minutes expired (Auto)'
  where 
    status = 'pending' 
    and payment_status = 'pending'
    and created_at < (now() - interval '10 minutes');

  -- 2. COLLECTION TIMEOUT (5 Hours) -> EXPIRED
  update orders
  set 
    status = 'expired',
    rejection_reason = 'Not collected - QR code expired after 5 hours (Auto)'
  where 
    status = 'confirmed'
    and payment_status IN ('confirmed', 'completed')
    and created_at < (now() - interval '5 hours');
end;
$$;