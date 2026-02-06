-- Update the update_stock_after_order function to use new enum values
CREATE OR REPLACE FUNCTION public.update_stock_after_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item_record RECORD;
  current_stock INTEGER;
  total_ordered INTEGER;
BEGIN
  -- For each item in the order, check and update stock
  FOR item_record IN 
    SELECT menu_item_id, quantity FROM public.order_items WHERE order_id = NEW.id
  LOOP
    IF item_record.menu_item_id IS NOT NULL THEN
      -- Get the current stock quantity for this menu item
      SELECT stock_quantity INTO current_stock
      FROM public.menu_items
      WHERE id = item_record.menu_item_id;
      
      -- Only process if stock_quantity is set (not null - meaning stock tracking is enabled)
      IF current_stock IS NOT NULL THEN
        -- Calculate total ordered quantity for this item (from confirmed orders only)
        SELECT COALESCE(SUM(oi.quantity), 0) INTO total_ordered
        FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE oi.menu_item_id = item_record.menu_item_id
          AND o.status = 'confirmed'
          AND o.payment_status = 'confirmed';
        
        -- If total ordered >= stock, mark as unavailable (sold out)
        IF total_ordered >= current_stock THEN
          UPDATE public.menu_items
          SET is_available = false, updated_at = now()
          WHERE id = item_record.menu_item_id;
          
          RAISE LOG 'Item % marked as sold out. Stock: %, Ordered: %', 
            item_record.menu_item_id, current_stock, total_ordered;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Update expire_old_orders function to use only valid statuses
CREATE OR REPLACE FUNCTION public.expire_old_orders()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    and payment_status = 'confirmed'
    and created_at < (now() - interval '5 hours');
end;
$function$;