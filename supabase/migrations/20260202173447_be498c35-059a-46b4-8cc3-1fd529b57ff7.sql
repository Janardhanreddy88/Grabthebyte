-- Remove Pegasus trigger from orders table first
DROP TRIGGER IF EXISTS trg_assign_ticket_id ON public.orders;

-- Remove all legacy Pegasus event functions (BiteOS cleanup)
DROP FUNCTION IF EXISTS public.assign_pegasus_id_instantly();
DROP FUNCTION IF EXISTS public.check_pegasus_rate_limit(text, text);
DROP FUNCTION IF EXISTS public.generate_pegasus_ticket_ids();
DROP FUNCTION IF EXISTS public.generate_pegasus_ticket_number();
DROP FUNCTION IF EXISTS public.generate_pegasus_competition_number();
DROP FUNCTION IF EXISTS public.generate_pegasus_stall_number();
DROP FUNCTION IF EXISTS public.increment_pegasus_sold_count(text);
DROP FUNCTION IF EXISTS public.record_pegasus_purchase(text, text);
DROP FUNCTION IF EXISTS public.is_pegasus_admin(uuid);
DROP FUNCTION IF EXISTS public.pegasus_ticket_security_check();