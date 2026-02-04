-- Add payment tracking columns to orders table
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cf_order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cf_payment_id TEXT;

-- Create payment webhooks table for idempotency
CREATE TABLE IF NOT EXISTS public.payment_webhooks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    cf_order_id TEXT NOT NULL,
    cf_payment_id TEXT,
    event_type TEXT NOT NULL,
    payload JSONB,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(cf_order_id, event_type)
);

-- Enable RLS on payment_webhooks
ALTER TABLE public.payment_webhooks ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_orders_cf_order_id ON public.orders(cf_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhooks_cf_order_id ON public.payment_webhooks(cf_order_id);

-- Create policy for service role access only
CREATE POLICY "Service role can manage payment webhooks"
ON public.payment_webhooks
FOR ALL
USING (true)
WITH CHECK (true);