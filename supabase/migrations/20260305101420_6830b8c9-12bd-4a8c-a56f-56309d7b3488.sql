
-- 1. Recreate profiles_readable with security_invoker and super_admin check
DROP VIEW IF EXISTS public.profiles_readable;
CREATE VIEW public.profiles_readable
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.user_id,
  p.full_name,
  p.email,
  p.phone,
  p.created_at,
  p.updated_at,
  c.name AS campus_name,
  c.code AS campus_code
FROM public.profiles p
JOIN public.campuses c ON c.id = p.campus_id
WHERE public.is_super_admin(auth.uid());

-- 2. Recreate user_roles_readable with security_invoker and super_admin check
DROP VIEW IF EXISTS public.user_roles_readable;
CREATE VIEW public.user_roles_readable
WITH (security_invoker = true)
AS
SELECT
  ur.id,
  ur.user_id,
  ur.role,
  ur.created_at,
  p.full_name,
  p.email,
  c.name AS campus_name,
  c.code AS campus_code
FROM public.user_roles ur
JOIN public.profiles p ON p.user_id = ur.user_id
JOIN public.campuses c ON c.id = ur.campus_id
WHERE public.is_super_admin(auth.uid());

-- 3. Drop email-based order SELECT policy
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;

-- 4. Drop email-based order UPDATE policy
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;
