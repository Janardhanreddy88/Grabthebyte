
-- Create platform_alerts table for notifications system
CREATE TABLE public.platform_alerts (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    type text NOT NULL, -- 'payment_failure', 'low_stock', 'settlement_due', 'campus_inactive', 'system'
    title text NOT NULL,
    message text NOT NULL,
    severity text NOT NULL DEFAULT 'info', -- 'info', 'warning', 'critical'
    campus_id uuid REFERENCES public.campuses(id) ON DELETE CASCADE,
    is_read boolean NOT NULL DEFAULT false,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_alerts ENABLE ROW LEVEL SECURITY;

-- Only super admins can view and manage alerts
CREATE POLICY "Super admins can manage all alerts"
ON public.platform_alerts
FOR ALL
USING (is_super_admin(auth.uid()));

-- Index for fast queries
CREATE INDEX idx_platform_alerts_unread ON public.platform_alerts (is_read, created_at DESC);
CREATE INDEX idx_platform_alerts_type ON public.platform_alerts (type);

-- Function to get campus health stats
CREATE OR REPLACE FUNCTION public.get_campus_health()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_result json;
BEGIN
    SELECT json_agg(row_to_json(t)) INTO v_result
    FROM (
        SELECT 
            c.id,
            c.name,
            c.code,
            c.is_active,
            COALESCE(today.order_count, 0) as orders_today,
            COALESCE(today.revenue, 0) as revenue_today,
            last_order.last_order_at,
            COALESCE(stock.low_stock_count, 0) as low_stock_items
        FROM campuses c
        LEFT JOIN LATERAL (
            SELECT 
                COUNT(*) as order_count,
                COALESCE(SUM(total), 0) as revenue
            FROM orders 
            WHERE campus_id = c.id 
            AND DATE(created_at) = CURRENT_DATE
            AND status != 'failed'
        ) today ON true
        LEFT JOIN LATERAL (
            SELECT created_at as last_order_at
            FROM orders 
            WHERE campus_id = c.id 
            ORDER BY created_at DESC 
            LIMIT 1
        ) last_order ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) as low_stock_count
            FROM menu_items 
            WHERE campus_id = c.id 
            AND is_available = true
            AND stock_quantity IS NOT NULL
            AND stock_quantity <= 5
        ) stock ON true
        ORDER BY c.name
    ) t;
    
    RETURN COALESCE(v_result, '[]'::json);
END;
$$;
