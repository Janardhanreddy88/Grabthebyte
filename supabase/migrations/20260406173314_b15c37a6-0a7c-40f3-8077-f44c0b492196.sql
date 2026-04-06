
-- 1. Add orders_paused flag to platform_settings
ALTER TABLE public.platform_settings
ADD COLUMN orders_paused boolean NOT NULL DEFAULT false,
ADD COLUMN orders_paused_at timestamp with time zone,
ADD COLUMN orders_paused_reason text DEFAULT 'Kitchen overwhelmed';

-- 2. Create refund_ledger table for rejected order refund tracking
CREATE TABLE public.refund_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  order_number text NOT NULL,
  campus_id uuid NOT NULL,
  customer_name text,
  customer_email text,
  amount numeric NOT NULL,
  reason text NOT NULL,
  razorpay_payment_id text,
  refund_status text NOT NULL DEFAULT 'pending',
  refunded_at timestamp with time zone,
  refund_reference text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.refund_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage refund ledger"
ON public.refund_ledger FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Campus admins can view their campus refunds"
ON public.refund_ledger FOR SELECT
TO authenticated
USING (campus_id = get_user_campus_id(auth.uid()) AND is_campus_admin(auth.uid()));

-- Index for quick lookups
CREATE INDEX idx_refund_ledger_order_id ON public.refund_ledger(order_id);
CREATE INDEX idx_refund_ledger_campus_id ON public.refund_ledger(campus_id);
CREATE INDEX idx_refund_ledger_status ON public.refund_ledger(refund_status);

-- Trigger for updated_at
CREATE TRIGGER update_refund_ledger_updated_at
BEFORE UPDATE ON public.refund_ledger
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
