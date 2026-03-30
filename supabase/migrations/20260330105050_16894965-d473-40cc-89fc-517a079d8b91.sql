-- #2 & #3: Secure user_roles_readable view by adding super_admin/campus_admin filter
CREATE OR REPLACE VIEW public.user_roles_readable
WITH (security_invoker = on)
AS
SELECT
    ur.id,
    ur.user_id,
    ur.campus_id,
    c.name AS campus_name,
    c.code AS campus_code,
    ur.role,
    ur.created_at,
    p.full_name,
    p.email
FROM user_roles ur
LEFT JOIN profiles p ON ur.user_id = p.user_id
LEFT JOIN campuses c ON ur.campus_id = c.id
WHERE is_super_admin(auth.uid())
   OR (is_campus_admin(auth.uid()) AND ur.campus_id = get_user_campus_id(auth.uid()));

-- #5: Fix cross-campus data leak via Realtime
-- The "Staff can view all orders" policy allows kiosk/admin to see ALL orders across campuses
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;

CREATE POLICY "Staff can view campus orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  (campus_id = get_user_campus_id(auth.uid())) AND
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('kiosk', 'admin')
    AND user_roles.campus_id = orders.campus_id
  )
);