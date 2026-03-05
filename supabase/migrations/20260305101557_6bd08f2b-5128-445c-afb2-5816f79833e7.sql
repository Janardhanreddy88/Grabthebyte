
-- 1. Simplify profiles INSERT policy to only allow user_id match
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Remove duplicate platform_settings SELECT policy
DROP POLICY IF EXISTS "Allow public read access" ON public.platform_settings;
