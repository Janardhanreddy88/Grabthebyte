-- Drop ticket_messages first (references support_tickets)
DROP TABLE IF EXISTS public.ticket_messages CASCADE;

-- Drop support_tickets
DROP TABLE IF EXISTS public.support_tickets CASCADE;

-- Drop the sequence and function
DROP FUNCTION IF EXISTS public.get_ticket_stats() CASCADE;
DROP FUNCTION IF EXISTS public.generate_ticket_number() CASCADE;
DROP SEQUENCE IF EXISTS public.ticket_number_seq CASCADE;