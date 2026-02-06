-- Drop the skip_kitchen_stages trigger since the statuses it references no longer exist
DROP TRIGGER IF EXISTS avoid_kitchen_stages ON orders;

-- Drop the function as well since it's no longer needed
DROP FUNCTION IF EXISTS public.skip_kitchen_stages();