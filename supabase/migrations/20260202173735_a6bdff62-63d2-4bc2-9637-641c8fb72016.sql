-- Drop remaining Pegasus functions with correct signatures
DROP FUNCTION IF EXISTS public.increment_pegasus_sold_count(uuid);
DROP FUNCTION IF EXISTS public.check_pegasus_rate_limit(uuid, text);
DROP FUNCTION IF EXISTS public.record_pegasus_purchase(uuid, text);