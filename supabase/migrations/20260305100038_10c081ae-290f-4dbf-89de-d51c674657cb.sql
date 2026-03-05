
-- ============================================================
-- FIX: Remove the overly broad campuses SELECT policy.
-- Revert campus_public_info to security_invoker=false (DEFINER)
-- so the view runs as its owner and doesn't need user-level access.
-- This ensures students CANNOT query campuses table directly.
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can view basic campus info" ON public.campuses;

-- Revert campus_public_info to SECURITY DEFINER (default) so it works
-- without needing direct campuses table access for students
ALTER VIEW public.campus_public_info SET (security_invoker = false);

-- ============================================================
-- CLEANUP: Remove duplicate/overlapping SELECT policies on categories
-- ============================================================

DROP POLICY IF EXISTS "Enable read access for all users" ON public.categories;
DROP POLICY IF EXISTS "Public Read Access Categories" ON public.categories;

-- ============================================================
-- CLEANUP: Remove duplicate/overlapping SELECT policies on menu_items
-- ============================================================

DROP POLICY IF EXISTS "Enable read access for all users" ON public.menu_items;
DROP POLICY IF EXISTS "Public Read Access Menu Items" ON public.menu_items;
