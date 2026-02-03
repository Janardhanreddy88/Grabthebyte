-- CLEANUP: Remove orphaned Pegasus event mode functions
-- These functions reference the removed pegasus_promo_codes table

-- Drop the promo code functions that reference non-existent table
DROP FUNCTION IF EXISTS public.validate_promo_code(text, numeric);
DROP FUNCTION IF EXISTS public.apply_promo_code(text);

-- Verify all tables and functions are properly aligned with codebase