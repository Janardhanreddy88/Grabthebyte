-- #1: Remove open SELECT on campuses (students use campus_public_info view instead)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.campuses;

-- #6: Scope audit_logs INSERT to the admin's own campus (only policy using is_campus_admin without campus scope)
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;

CREATE POLICY "Admins can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    is_campus_admin(auth.uid())
    AND (campus_id IS NULL OR campus_id = get_user_campus_id(auth.uid()))
  )
);