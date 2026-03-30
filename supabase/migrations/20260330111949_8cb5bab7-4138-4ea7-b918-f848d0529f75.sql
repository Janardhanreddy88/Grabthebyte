-- Recreate campus_public_info as SECURITY DEFINER (security_invoker=off)
-- so unauthenticated users can look up campus codes during onboarding
DROP VIEW IF EXISTS public.campus_public_info;

CREATE VIEW public.campus_public_info
WITH (security_barrier=true, security_invoker=off) AS
SELECT 
    id,
    name,
    code,
    address,
    logo_url,
    is_active,
    settings -> 'branding' AS branding,
    jsonb_build_object(
        'currency', (settings -> 'operational') -> 'currency',
        'tax_rate', (settings -> 'operational') -> 'tax_rate',
        'service_charge', (settings -> 'operational') -> 'service_charge'
    ) AS public_operational_settings
FROM campuses
WHERE is_active = true;

-- Grant SELECT to anon and authenticated so the view is accessible
GRANT SELECT ON public.campus_public_info TO anon, authenticated;